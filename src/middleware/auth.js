const jwt = require("jsonwebtoken");
const db = require("../db");

const SECRET = process.env.JWT_SECRET || "finance-dashboard-secret-key-change-in-production";

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "Authentication required" });

  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    const user = db.prepare("SELECT id, name, email, role, status FROM users WHERE id = ?").get(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.status !== "active") return res.status(403).json({ error: "Account is inactive" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(" or ")}` });
    next();
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "24h" });
}

module.exports = { authenticate, authorize, signToken };
