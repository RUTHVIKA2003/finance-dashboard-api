const { Router } = require("express");
const db = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();
router.use(authenticate);
router.use(authorize("admin", "analyst"));

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get total income, expenses, and net balance
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Financial summary }
 *       403: { description: Admin or Analyst only }
 */
router.get("/summary", (req, res) => {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS total_expenses,
      COUNT(*) AS total_records
    FROM financial_records WHERE is_deleted = 0
  `).get();

  res.json({
    total_income: row.total_income,
    total_expenses: row.total_expenses,
    net_balance: row.total_income - row.total_expenses,
    total_records: row.total_records,
  });
});

/**
 * @swagger
 * /api/dashboard/category-summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get totals grouped by category and type
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Category-wise breakdown }
 */
router.get("/category-summary", (req, res) => {
  const rows = db.prepare(`
    SELECT category, type,
      SUM(amount) AS total,
      COUNT(*) AS count
    FROM financial_records WHERE is_deleted = 0
    GROUP BY category, type ORDER BY total DESC
  `).all();
  res.json({ categories: rows });
});

/**
 * @swagger
 * /api/dashboard/monthly-trends:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get monthly income vs expense trends
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: months, schema: { type: integer, default: 6, maximum: 24 } }
 *     responses:
 *       200: { description: Monthly trend data }
 */
router.get("/monthly-trends", (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 24);
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month,
      COALESCE(SUM(CASE WHEN type='income' THEN amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS expenses
    FROM financial_records
    WHERE is_deleted = 0 AND date >= date('now', '-' || ? || ' months')
    GROUP BY month ORDER BY month DESC
  `).all(months);
  res.json({ trends: rows });
});

/**
 * @swagger
 * /api/dashboard/recent:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get recent financial activity
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 50 } }
 *     responses:
 *       200: { description: Recent records }
 */
router.get("/recent", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const records = db.prepare(
    "SELECT * FROM financial_records WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ?"
  ).all(limit);
  res.json({ records });
});

/**
 * @swagger
 * /api/dashboard/audit-log:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get audit log entries (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: Audit log entries }
 *       403: { description: Admin only }
 */
router.get("/audit-log", authorize("admin"), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const logs = db.prepare(`
    SELECT a.*, u.name AS user_name, u.email AS user_email
    FROM audit_log a LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT ?
  `).all(limit);
  res.json({ logs });
});

module.exports = router;
