/**
 * Auth Routes
 *
 * POST /api/auth/token → Authenticate with MRA and return the token
 *
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../services/mraService");

router.post("/token", async (req, res, next) => {
  try {
    const authResult = await authenticate();
    res.json({
      success: true,
      token: authResult.token,
      expiryDate: authResult.expiryDate,
      responseId: authResult.responseId,
      requestId: authResult.requestId,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
