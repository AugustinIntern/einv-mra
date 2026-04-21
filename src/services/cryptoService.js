/**
 * MRA Crypto Service
 *
 * Mirrors the cryptography logic:
 *  - AES-256-ECB key generation (sent to MRA inside the auth payload)
 *  - RSA-PKCS1v1.5 encryption of the auth payload with the MRA public key
 *  - AES-256-ECB decryption of the key returned by MRA
 *  - AES-256-ECB encryption of the invoice JSON before transmission
 */

const crypto = require("crypto");
const forge = require("node-forge");
const fs = require("fs");

// ── AES Key Generation

/**
 * Generates a random 256-bit AES key (matches C# Aes.Create() + GenerateKey())
 * Mode: ECB, Padding: PKCS7
 * @returns {{ keyBuffer: Buffer, keyBase64: string }}
 */
function generateAesKey() {
  const keyBuffer = crypto.randomBytes(32); // 256 bits
  return {
    keyBuffer,
    keyBase64: keyBuffer.toString("base64"),
  };
}

// ── RSA Encryption (Auth Payload)

/**
 * Loads the MRA public certificate and encrypts the auth payload JSON
 * using RSA PKCS1 v1.5 padding — mirrors C# RSACryptoServiceProvider.Encrypt(..., false)
 *
 * Supports two ways to supply the cert:
 *   1. File path  → MRA_PUBLIC_KEY_PATH env var
 *   2. PEM string → MRA_PUBLIC_KEY_CONTENT env var (preferred for Vercel/serverless)
 *
 * @param {object} authPayload
 * @returns {string} base64-encoded encrypted payload
 */
function encryptAuthPayload(authPayload) {
  const payloadJson = JSON.stringify(authPayload);

  let certPem;

  if (process.env.MRA_PUBLIC_KEY_CONTENT) {
    // Env var: replace literal \n with real newlines
    certPem = process.env.MRA_PUBLIC_KEY_CONTENT.replace(/\\n/g, "\n");
  } else {
    const keyPath = process.env.MRA_PUBLIC_KEY_PATH || "./PublicKey.crt";
    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `MRA public key not found at "${keyPath}". ` +
          "Set MRA_PUBLIC_KEY_PATH or MRA_PUBLIC_KEY_CONTENT environment variable."
      );
    }
    certPem = fs.readFileSync(keyPath, "utf8");
  }

  // node-forge handles both .crt (DER/PEM) and raw PEM certificates
  let publicKey;
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    publicKey = cert.publicKey;
  } catch {
    // Maybe it was provided as a raw RSA public key PEM, not a certificate
    publicKey = forge.pki.publicKeyFromPem(certPem);
  }

  // RSA PKCS#1 v1.5 — matches C# false flag on Encrypt()
  const encrypted = publicKey.encrypt(payloadJson, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted);
}

// ── AES Decryption (MRA Key) 

/**
 * Decrypts the base64-encoded key returned by MRA using our AES key.
 * Mirrors C# ICryptoTransform decryptor with ECB + PKCS7.
 *
 * The decrypted result is itself a base64 string representing the real
 * invoice-encryption key bytes (as produced by DecryptDataWithAesKey in C#).
 *
 * @param {Buffer} aesKeyBuffer  - The original 32-byte AES key we generated
 * @param {string} mraKeyBase64  - The encrypted key from MRA's auth response
 * @returns {string} base64 string of the decrypted MRA key (ready to use for invoice encryption)
 */
function decryptMraKey(aesKeyBuffer, mraKeyBase64) {
  const encryptedKey = Buffer.from(mraKeyBase64, "base64");

  // Step 1: AES-256-ECB decrypt (matches decryptKeyReceivedFromMRA in C#)
  const decipher1 = crypto.createDecipheriv("aes-256-ecb", aesKeyBuffer, null);
  decipher1.setAutoPadding(true); // PKCS7
  const step1 = Buffer.concat([
    decipher1.update(encryptedKey),
    decipher1.final(),
  ]);
  // step1 is a base64 string (the intermediate output)
  const step1Base64 = step1.toString("utf8");

  // Step 2: The C# code does a second decryption (DecryptDataWithAesKey)
  // which decodes step1Base64 from base64 and decrypts it again with the same key,
  // then re-encodes to base64.  The result is the actual invoice key.
  try {
    const encryptedKeyBytes = Buffer.from(step1Base64, "base64");
    const decipher2 = crypto.createDecipheriv(
      "aes-256-ecb",
      aesKeyBuffer,
      null
    );
    decipher2.setAutoPadding(true);
    const step2 = Buffer.concat([
      decipher2.update(encryptedKeyBytes),
      decipher2.final(),
    ]);
    return step2.toString("base64");
  } catch {
    // Some MRA environments only do the single-step decryption; fall back
    return step1Base64;
  }
}

// ── AES Encryption (Invoice) 

/**
 * Encrypts the invoice JSON list using the decrypted MRA key.
 * Mirrors C# encryptInvoice() — AES-256-ECB, PKCS7.
 *
 * @param {Array}  invoices      - Array of invoice objects
 * @param {string} mraKeyBase64  - base64 key returned from decryptMraKey()
 * @returns {string} base64-encoded encrypted invoice payload
 */
function encryptInvoices(invoices, mraKeyBase64) {
  const invoiceJson = JSON.stringify(invoices);
  const keyBuffer = Buffer.from(mraKeyBase64, "base64");

  const cipher = crypto.createCipheriv("aes-256-ecb", keyBuffer, null);
  cipher.setAutoPadding(true); // PKCS7
  const encrypted = Buffer.concat([
    cipher.update(invoiceJson, "utf8"),
    cipher.final(),
  ]);

  return encrypted.toString("base64");
}

module.exports = {
  generateAesKey,
  encryptAuthPayload,
  decryptMraKey,
  encryptInvoices,
};
