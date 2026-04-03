const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("short"));

// Rate limiting: 100 requests per 15 minutes per IP
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests, please try again later" } }));
// Stricter limit on auth endpoints to prevent brute force
app.use("/api/auth/", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many auth attempts, please try again later" } }));

// Swagger docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/records", require("./routes/records"));
app.use("/api/dashboard", require("./routes/dashboard"));

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}\nAPI docs: http://localhost:${PORT}/api/docs`));

module.exports = app;
