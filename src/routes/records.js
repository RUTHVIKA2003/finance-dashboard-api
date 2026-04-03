const { Router } = require("express");
const db = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = Router();
router.use(authenticate);

const logAudit = db.prepare("INSERT INTO audit_log (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)");

const recordSchema = {
  amount: { required: true, type: "number", min: 0.01 },
  type: { required: true, type: "string", enum: ["income", "expense"] },
  category: { required: true, type: "string" },
  date: { required: true, type: "string", pattern: /^\d{4}-\d{2}-\d{2}$/ },
};

/**
 * @swagger
 * /api/records:
 *   get:
 *     tags: [Records]
 *     summary: List financial records with filtering and pagination
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [income, expense] } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Paginated list of records }
 *       401: { description: Unauthorized }
 */
router.get("/", authorize("admin", "analyst", "viewer"), (req, res) => {
  const { type, category, from, to, search, page = 1, limit = 20 } = req.query;
  const conditions = ["is_deleted = 0"];
  const params = [];

  if (type) { conditions.push("type = ?"); params.push(type); }
  if (category) { conditions.push("category = ?"); params.push(category); }
  if (from) { conditions.push("date >= ?"); params.push(from); }
  if (to) { conditions.push("date <= ?"); params.push(to); }
  if (search) { conditions.push("description LIKE ?"); params.push(`%${search}%`); }

  const where = conditions.join(" AND ");
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  const total = db.prepare(`SELECT COUNT(*) as count FROM financial_records WHERE ${where}`).get(...params).count;
  const records = db.prepare(
    `SELECT * FROM financial_records WHERE ${where} ORDER BY date DESC LIMIT ? OFFSET ?`
  ).all(...params, Number(limit), offset);

  res.json({ records, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
});

/**
 * @swagger
 * /api/records/{id}:
 *   get:
 *     tags: [Records]
 *     summary: Get a single record by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Record found }
 *       404: { description: Record not found }
 */
router.get("/:id", authorize("admin", "analyst", "viewer"), (req, res) => {
  const record = db.prepare("SELECT * FROM financial_records WHERE id = ? AND is_deleted = 0").get(req.params.id);
  if (!record) return res.status(404).json({ error: "Record not found" });
  res.json({ record });
});

/**
 * @swagger
 * /api/records:
 *   post:
 *     tags: [Records]
 *     summary: Create a financial record (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount: { type: number, minimum: 0.01 }
 *               type: { type: string, enum: [income, expense] }
 *               category: { type: string }
 *               date: { type: string, format: date }
 *               description: { type: string }
 *     responses:
 *       201: { description: Record created }
 *       400: { description: Validation error }
 *       403: { description: Admin only }
 */
router.post("/", authorize("admin"), validate(recordSchema), (req, res) => {
  const { amount, type, category, date, description } = req.body;
  const result = db.prepare(
    "INSERT INTO financial_records (user_id, amount, type, category, date, description) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(req.user.id, amount, type, category, date, description || null);

  const record = db.prepare("SELECT * FROM financial_records WHERE id = ?").get(result.lastInsertRowid);
  logAudit.run(req.user.id, "RECORD_CREATED", "record", record.id, `${type}: ${amount} in ${category}`);
  res.status(201).json({ record });
});

/**
 * @swagger
 * /api/records/{id}:
 *   put:
 *     tags: [Records]
 *     summary: Update a financial record (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount: { type: number, minimum: 0.01 }
 *               type: { type: string, enum: [income, expense] }
 *               category: { type: string }
 *               date: { type: string, format: date }
 *               description: { type: string }
 *     responses:
 *       200: { description: Record updated }
 *       404: { description: Record not found }
 */
router.put("/:id", authorize("admin"), validate(recordSchema), (req, res) => {
  const existing = db.prepare("SELECT * FROM financial_records WHERE id = ? AND is_deleted = 0").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Record not found" });

  const { amount, type, category, date, description } = req.body;
  db.prepare(
    "UPDATE financial_records SET amount=?, type=?, category=?, date=?, description=?, updated_at=datetime('now') WHERE id=?"
  ).run(amount, type, category, date, description || null, req.params.id);

  const record = db.prepare("SELECT * FROM financial_records WHERE id = ?").get(req.params.id);
  logAudit.run(req.user.id, "RECORD_UPDATED", "record", record.id, `${type}: ${amount} in ${category}`);
  res.json({ record });
});

/**
 * @swagger
 * /api/records/{id}:
 *   delete:
 *     tags: [Records]
 *     summary: Soft-delete a financial record (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Record soft-deleted }
 *       404: { description: Record not found }
 */
router.delete("/:id", authorize("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM financial_records WHERE id = ? AND is_deleted = 0").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Record not found" });

  db.prepare("UPDATE financial_records SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit.run(req.user.id, "RECORD_DELETED", "record", existing.id, `Soft-deleted ${existing.type}: ${existing.amount}`);
  res.json({ message: "Record deleted" });
});

module.exports = router;
