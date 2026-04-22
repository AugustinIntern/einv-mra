const express = require("express");
const router = express.Router();
const { processInvoices } = require("../services/mraService");
const { generateSampleInvoice, validateInvoices } = require("../models/invoice");
const apiKeyAuth = require("../middleware/apiKeyAuth"); // ADD THIS
const prisma = require("../db");                        // ADD THIS

// ── POST /api/invoices/submit  (now protected)
router.post("/submit", apiKeyAuth, async (req, res, next) => { // ADD apiKeyAuth
  try {
    const invoices = req.body;
    const user = req.currentUser; // available after auth middleware

    const { valid, errors } = validateInvoices(invoices);
    if (!valid) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const result = await processInvoices(invoices);
    const fiscalised = result.fiscalisedInvoices ?? [];

    // Log each invoice result to audit table
    // for (const inv of fiscalised) {
    //   await prisma.auditLog.create({
    //     data: {
    //       userId: user.id,
    //       invoiceNumber: inv.invoiceIdentifier ?? "unknown",
    //       status: inv.status ?? "unknown",
    //       irn: inv.irn ?? null,
    //       errorMessage: inv.errorMessages
    //         ? inv.errorMessages.map((e) => e.description).join("; ")
    //         : null,
    //     },
    //   }).catch(() => {}); // non-blocking — don't fail the request if logging fails
    // }

    return res.json({
      success: true,
      mraResponse: result,
      fiscalisedInvoices: fiscalised,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/invoices/submit-sample (no auth — for testing only)
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

// ── GET /api/invoices/sample
router.get("/sample", (_req, res) => {
  res.json(generateSampleInvoice());
});

module.exports = router;