const swaggerJsdoc = require("swagger-jsdoc");

module.exports = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Finance Dashboard API",
      version: "1.0.0",
      description: "Backend API for finance dashboard with role-based access control, financial records management, and summary analytics.",
    },
    servers: [{ url: "http://localhost:3000", description: "Local" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["admin", "analyst", "viewer"] },
            status: { type: "string", enum: ["active", "inactive"] },
            created_at: { type: "string" },
          },
        },
        Record: {
          type: "object",
          properties: {
            id: { type: "integer" },
            user_id: { type: "integer" },
            amount: { type: "number" },
            type: { type: "string", enum: ["income", "expense"] },
            category: { type: "string" },
            date: { type: "string", format: "date" },
            description: { type: "string" },
            is_deleted: { type: "integer" },
            created_at: { type: "string" },
            updated_at: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
});
