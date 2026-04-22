const express = require("express");
const crypto = require("crypto");
const prisma = require("../db");

const router = express.Router();

const toMUT = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleString("en-MU", {
    timeZone: "Indian/Mauritius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

// Protect all admin routes with a static secret
router.use((req, res, next) => {
  const adminSecret = req.headers["x-admin-secret"];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// POST /admin/users — Create a new user and generate their first API key
router.post("/users", async (req, res) => {
  const { name, ebsId, brn, tan, businessAddr, phone, userName, areaCode} = req.body;

  if (!name || !ebsId || !brn || !userName) {
    return res.status(400).json({
      error: "name, ebsId, brn and userName are required",
    });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { ebsId } });
    if (existing) {
      return res.status(409).json({
        error: "A user with this EBS ID already exists",
      });
    }

    const user = await prisma.user.create({
      data: { name, ebsId, brn, tan, businessAddr, phone, userName, areaCode},
    });

    // Generate API key — raw key returned ONCE, only hash stored
    const rawKey = crypto.randomBytes(32).toString("hex");
    const keyHash = crypto
      .createHash("sha256")
      .update(rawKey)
      .digest("hex");

    await prisma.apiKey.create({
      data: { userId: user.id, keyHash, label: "default" },
    });

    res.status(201).json({
      message: "User created successfully",
      user,
      apiKey: rawKey, // Save this — it will never be shown again
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/users — List all users
router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        apiKeys: {
          select: {
            id: true,
            label: true,
            isActive: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
      },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/users/:id/rotate-key — Issue a new API key for a user
router.post("/users/:id/rotate-key", async (req, res) => {
  const { id } = req.params;
  const { label } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const rawKey = crypto.randomBytes(32).toString("hex");
    const keyHash = crypto
      .createHash("sha256")
      .update(rawKey)
      .digest("hex");

    await prisma.apiKey.create({
      data: { userId: id, keyHash, label: label || "rotated" },
    });

    res.json({
      message: "New API key generated",
      apiKey: rawKey, // Save this — it will never be shown again
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /admin/keys/:id — Deactivate an API key
router.delete("/keys/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ message: "API key deactivated" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/audit — View fiscalization audit log
router.get("/audit", async (req, res) => {
  const { ebsId, status, page = 1, limit = 100 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) where.status = status;
  if (ebsId) where.user = { ebsId };

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip,
        include: {
          user: { select: { name: true, ebsId: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      logs: logs.map((log) => ({
        ...log,
        fiscalisedAt: toMUT(log.fiscalisedAt),
        createdAt: toMUT(log.createdAt),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;