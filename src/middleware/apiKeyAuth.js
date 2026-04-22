const crypto = require("crypto");
const prisma = require("../db");

module.exports = async function apiKeyAuth(req, res, next) {
  const rawKey = req.headers["x-api-key"];

  if (!rawKey) {
    return res.status(401).json({ error: "Missing API key" });
  }

  const keyHash = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  let apiKey;
  try {
    apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });
  } catch (err) {
    console.error("DB error during auth:", err);
    return res.status(500).json({ error: "Internal server error" });
  }

  if (!apiKey || !apiKey.isActive) {
    return res.status(401).json({ error: "Invalid or inactive API key" });
  }

  // Attach user profile to request for downstream use
  req.currentUser = apiKey.user;

  // Update lastUsedAt non-blocking
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  next();
};