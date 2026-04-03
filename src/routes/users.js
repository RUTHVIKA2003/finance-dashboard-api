const { Router } = require("express");
const db = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = Router();
router.use(authenticate);

const logAudit = db.prepare("INSERT INTO audit_log (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)");

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of users }
 *       403: { description: Admin only }
 */
router.get("/", authorize("admin"), (req, res) => {
  const users = db.prepare("SELECT id, name, email, role, status, created_at FROM users").all();
  res.json({ users });
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: User found }
 *       404: { description: User not found }
 */
router.get("/:id", authorize("admin"), (req, res) => {
  const user = db.prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: Update user role (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [admin, analyst, viewer] }
 *     responses:
 *       200: { description: Role updated }
 *       400: { description: Cannot change own role }
 *       404: { description: User not found }
 */
router.patch("/:id/role", authorize("admin"), validate({
  role: { required: true, type: "string", enum: ["admin", "analyst", "viewer"] }
}), (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) return res.status(400).json({ error: "Cannot change your own role" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.role, id);
  const updated = db.prepare("SELECT id, name, email, role, status FROM users WHERE id = ?").get(id);
  logAudit.run(req.user.id, "ROLE_CHANGED", "user", Number(id), `Role changed to ${req.body.role}`);
  res.json({ user: updated });
});

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Activate or deactivate user (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Cannot change own status }
 *       404: { description: User not found }
 */
router.patch("/:id/status", authorize("admin"), validate({
  status: { required: true, type: "string", enum: ["active", "inactive"] }
}), (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) return res.status(400).json({ error: "Cannot change your own status" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.status, id);
  const updated = db.prepare("SELECT id, name, email, role, status FROM users WHERE id = ?").get(id);
  logAudit.run(req.user.id, "STATUS_CHANGED", "user", Number(id), `Status changed to ${req.body.status}`);
  res.json({ user: updated });
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: User deleted }
 *       400: { description: Cannot delete yourself }
 *       404: { description: User not found }
 */
router.delete("/:id", authorize("admin"), (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  logAudit.run(req.user.id, "USER_DELETED", "user", Number(id), null);
  res.json({ message: "User deleted" });
});

module.exports = router;
