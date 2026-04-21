/**
 * Invoice Routes
 *
 * POST /api/invoices/submit        → Submit custom invoices
 * POST /api/invoices/submit-sample → Submit the built-in sample invoice
 */

const express = require("express");
const router = express.Router();
const { processInvoices } = require("../services/mraService");
const { generateSampleInvoice, validateInvoices } = require("../models/invoice");

// ── POST /api/invoices/submit ─────────────────────────────────────────────────
/**
 * @body Array of MRAInvoice objects
 * @returns MRA fiscalisation response
 *
 * Example Postman body (raw JSON):
 * [
 *   {
 *     "invoiceCounter": "1",
 *     "transactionType": "B2C",
 *     "invoiceTypeDesc": "STD",
 *     "currency": "MUR",
 *     "invoiceIdentifier": "SI-MY-20241001001",
 *     "previousNoteHash": "0",
 *     "reasonStated": "",
 *     "invoiceRefIdentifier": "",
 *     "totalVatAmount": "15.0",
 *     "totalAmtWoVatCur": "100.0",
 *     "totalAmtWoVatMur": "100.0",
 *     "invoiceTotal": "115.0",
 *     "discountTotalAmount": "0",
 *     "totalAmtPaid": "115.0",
 *     "dateTimeInvoiceIssued": "20241001 10:30:00",
 *     "personType": "VATR",
 *     "salesTransactions": "CASH",
 *     "seller": {
 *       "name": "Your Company Name",
 *       "tradeName": "Trade Name",
 *       "tan": "your_tan",
 *       "brn": "your_brn",
 *       "businessAddr": "Port Louis",
 *       "businessPhoneNo": "2000000",
 *       "ebsCounterNo": "a1"
 *     },
 *     "buyer": {
 *       "name": "Customer Name",
 *       "tan": "",
 *       "brn": "",
 *       "businessAddr": "",
 *       "buyerType": "IND",
 *       "nic": ""
 *     },
 *     "itemList": [
 *       {
 *         "itemNo": "1",
 *         "taxCode": "TC01",
 *         "nature": "GOODS",
 *         "productCodeMra": "pdtCode",
 *         "productCodeOwn": "myCode",
 *         "itemDesc": "Item Description",
 *         "quantity": "1",
 *         "unitPrice": "100",
 *         "discount": "0",
 *         "discountedValue": "0",
 *         "amtWoVatCur": "100",
 *         "amtWoVatMur": "100",
 *         "vatAmt": "15",
 *         "totalPrice": "115"
 *       }
 *     ]
 *   }
 * ]
 */
router.post("/submit", async (req, res, next) => {
  try {
    const invoices = req.body;

    // Validate
    const { valid, errors } = validateInvoices(invoices);
    if (!valid) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const result = await processInvoices(invoices);

    // Surface fiscalised invoice details clearly
    return res.json({
      success: true,
      mraResponse: result,
      fiscalisedInvoices: result.fiscalisedInvoices ?? [],
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/invoices/submit-sample ─────────────────────────────────────────
/**
 * Submits the built-in sample invoice (no body required).
 * Useful for quick Postman smoke-tests.
 */
router.post("/submit-sample", async (req, res, next) => {
  try {
    const sampleInvoices = generateSampleInvoice();
    console.log("[Sample] Invoice payload:", JSON.stringify(sampleInvoices, null, 2));

    const result = await processInvoices(sampleInvoices);

    return res.json({
      success: true,
      note: "Sample invoice submitted",
      mraResponse: result,
      fiscalisedInvoices: result.fiscalisedInvoices ?? [],
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/invoices/sample ──────────────────────────────────────────────────
/**
 * Returns the sample invoice JSON so you can inspect / copy-paste it into
 * the /submit endpoint body in Postman.
 */
router.get("/sample", (_req, res) => {
  res.json(generateSampleInvoice());
});

module.exports = router;
