const { Router } = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { signToken } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = Router();
const logAudit = db.prepare("INSERT INTO audit_log (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)");

const registerSchema = {
  name: { required: true, type: "string" },
  email: { required: true, type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { required: true, type: "string", minLength: 6 },
};

const loginSchema = {
  email: { required: true, type: "string" },
  password: { required: true, type: "string" },
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string, minLength: 6 }
 *               role: { type: string, enum: [admin, analyst, viewer] }
 *     responses:
 *       201: { description: User created with JWT token }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 */
router.post("/register", validate(registerSchema), (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const hash = bcrypt.hashSync(password, 10);
  const validRole = ["admin", "analyst", "viewer"].includes(role) ? role : "viewer";
  const result = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
  ).run(name, email, hash, validRole);

  const user = db.prepare("SELECT id, name, email, role, status FROM users WHERE id = ?").get(result.lastInsertRowid);
  logAudit.run(user.id, "USER_REGISTERED", "user", user.id, `Role: ${validRole}`);
  res.status(201).json({ user, token: signToken(user) });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful with JWT token }
 *       401: { description: Invalid credentials }
 *       403: { description: Account inactive }
 */
router.post("/login", validate(loginSchema), (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    if (user) logAudit.run(user.id, "LOGIN_FAILED", "user", user.id, "Invalid password");
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (user.status !== "active")
    return res.status(403).json({ error: "Account is inactive" });

  logAudit.run(user.id, "LOGIN_SUCCESS", "user", user.id, null);
  const { password_hash, ...safe } = user;
  res.json({ user: safe, token: signToken(user) });
});

module.exports = router;
