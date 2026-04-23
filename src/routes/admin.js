const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../db");

const router = express.Router();

// Protect all admin routes
router.use((req, res, next) => {
  const adminSecret = req.headers["x-admin-secret"];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// POST /admin/users — Create a new user
router.post("/users", async (req, res) => {
  const { name, userName, ebsId, areaCode, password} = req.body;

  if (!name || !userName || !ebsId || !areaCode || !password) {
    return res.status(400).json({
      error: "name, userName, ebsId, areaCode, password",
    });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { ebsId } });
    if (existing) {
      return res.status(409).json({
        error: "A user with this EBS ID already exists",
      });
    }

    // const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        userName,
        ebsId,
        areaCode: parseInt(areaCode),
        password: password,
      },
    });

    const rawKey = crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    await prisma.apiKey.create({
      data: { userId: user.id, keyHash, label: "default" },
    });

    // Never return password in response
    const { password: _, ...safeUser } = user;

    res.status(201).json({
      message: "User created successfully",
      user: safeUser,
      apiKey: rawKey,
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
      select: {
        id: true,
        name: true,
        userName: true,
        ebsId: true,
        areaCode: true,
        createdAt: true,
        password: true,
        mraToken: true,
        mraTokenExpiry: true,
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
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    await prisma.apiKey.create({
      data: { userId: id, keyHash, label: label || "rotated" },
    });

    res.json({
      message: "New API key generated",
      apiKey: rawKey,
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

// Helper to convert UTC to Mauritius Time
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