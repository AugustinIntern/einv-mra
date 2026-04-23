/**
 * MRA API Service
 *
 * Handles all HTTP communication with the MRA e-Invoice endpoints:
 *   1. Authentication  → POST /einvoice-token-service/token-api/generate-token
 *   2. Transmission    → POST /realtime/invoice/transmit
 */

const axios = require("axios");
const https = require("https");
const { v4: uuidv4 } = require("uuid");
const {
  generateAesKey,
  encryptAuthPayload,
  decryptMraKey,
  encryptInvoices,
} = require("./cryptoService");

// Accept self-signed / internal MRA certs (mirrors C# ServicePointManager bypass)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const AUTH_URL =
  process.env.MRA_AUTH_URL ||
  "https://vfisc.mra.mu/einvoice-token-service/token-api/generate-token";
const INVOICE_URL =
  process.env.MRA_INVOICE_URL ||
  "https://vfisc.mra.mu/realtime/invoice/transmit";

// ── Authentication

/**
 * Authenticates with MRA and returns the token + decrypted invoice key.
 *
 * @returns {{ token: string, mraKey: string, expiryDate: string }}
 */
async function authenticate(user = {}) {
  const username = process.env.MRA_USERNAME;
  const ebsMraId = process.env.MRA_EBS_MRA_ID;

  // Use password from authenticated user, fall back to .env
  const password = user.password || process.env.MRA_PASSWORD;

  if (!username || !password || !ebsMraId) {
    throw new Error(
      "Missing MRA credentials. Set MRA_USERNAME, MRA_PASSWORD, MRA_EBS_MRA_ID in environment."
    );
  }

  const { keyBuffer, keyBase64 } = generateAesKey();

  const authPayload = {
    username,
    password,
    encryptKey: keyBase64,
    refreshToken: true,
  };

  const encryptedPayload = encryptAuthPayload(authPayload);

  const authRequest = {
    requestId: uuidv4().replace(/-/g, ""),
    payload: encryptedPayload,
  };

  console.log(`[MRA Auth] Sending authentication request — ebsId: ${user.ebsId ?? "unknown"}`);

  const response = await axios.post(AUTH_URL, authRequest, {
    httpsAgent,
    headers: {
      "Content-Type": "application/json",
      username,
      ebsMraId,
    },
    timeout: 30_000,
  });

  const mraResponse = response.data;

  if (mraResponse.status !== "SUCCESS") {
    throw new Error(
      `MRA authentication failed. Status: ${mraResponse.status}. ` +
      `Response: ${JSON.stringify(mraResponse)}`
    );
  }

  console.log(`[MRA Auth] Success. Token expires: ${mraResponse.expiryDate}`);

  const mraKey = decryptMraKey(keyBuffer, mraResponse.key);

  return {
    token: mraResponse.token,
    mraKey,
    expiryDate: mraResponse.expiryDate,
    responseId: mraResponse.responseId,
    requestId: mraResponse.requestId,
  };
}

// ── Invoice Submission 
/**
 * Submits encrypted invoices to the MRA transmission endpoint.
 *
 * @param {string} token         - Auth token from authenticate()
 * @param {string} encryptedInvoice - Base64 AES-encrypted invoice JSON
 * @returns {object} MRA transmission response
 */
async function submitInvoice(token, encryptedInvoice) {
  const username = process.env.MRA_USERNAME;
  const ebsMraId = process.env.MRA_EBS_MRA_ID;
  const areaCode = process.env.MRA_AREA_CODE || "100";

  const requestPayload = {
    requestId: uuidv4().replace(/-/g, ""),
    requestDateTime: formatDateTime(new Date()),
    encryptedInvoice,
  };

  console.log("[MRA Invoice] Submitting invoice for fiscalisation...");

  const response = await axios.post(INVOICE_URL, requestPayload, {
    httpsAgent,
    headers: {
      "Content-Type": "application/json",
      username,
      ebsMraId,
      areaCode,
      token,
    },
    timeout: 30_000,
  });

  return response.data;
}

// ── Main Orchestrator

/**
 * Full flow: authenticate → encrypt invoices → transmit → return MRA response.
 *
 * @param {Array} invoices - Array of MRAInvoice objects
 * @returns {object} Full fiscalisation response from MRA
 */
async function processInvoices(invoices, user = {}) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    throw new Error("invoices must be a non-empty array.");
  }

  // 1. Auth — pass user so password is taken from DB
  const { token, mraKey } = await authenticate(user);

  // 2. Encrypt invoices with MRA key
  const encryptedInvoice = encryptInvoices(invoices, mraKey);

  // 3. Submit — pass user so areaCode is applied
  const result = await submitInvoice(token, encryptedInvoice, user);

  return result;
}

// ── Helpers

/** Formats a Date as "yyyyMMdd HH:mm:ss" — matches C# DateTime format string */
function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}${mo}${d} ${h}:${mi}:${s}`;
}

module.exports = { authenticate, submitInvoice, processInvoices, formatDateTime };
