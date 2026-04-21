require('dotenv').config();
const express = require("express");
const app = express();

// ── Middleware 
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Basic request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Routes 
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/auth", require("./routes/auth"));

// Health check
app.get("/", (_req, res) => {
  res.json({
    service: "MRA e-Invoice Fiscalisation API",
    status: "running",
    version: "1.0.0",
    endpoints: {
      "POST /api/invoices/submit": "Submit invoices for fiscalisation",
      "POST /api/invoices/submit-sample": "Submit the built-in sample invoice",
      "POST /api/auth/token": "Authenticate with MRA and get a token",
    },
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ── Start 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MRA Invoice API listening on port ${PORT}`);
});

// Required by Vercel (serverless export)
module.exports = app;
