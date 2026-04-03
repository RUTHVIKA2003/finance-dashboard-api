const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

const BASE = "http://localhost:3000/api";
let adminToken, analystToken, viewerToken, recordId;

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

describe("Finance API", () => {
  describe("Auth", () => {
    it("should register a new user", async () => {
      const email = `test-${Date.now()}@test.com`;
      const { status, data } = await api("/auth/register", {
        method: "POST",
        body: { name: "Test", email, password: "test123" },
      });
      assert.strictEqual(status, 201);
      assert.ok(data.token);

      // same email should be rejected
      const { status: s2 } = await api("/auth/register", {
        method: "POST",
        body: { name: "Test", email, password: "test123" },
      });
      assert.strictEqual(s2, 409);
    });

    it("should login admin", async () => {
      const { status, data } = await api("/auth/login", {
        method: "POST",
        body: { email: "admin@example.com", password: "admin123" },
      });
      assert.strictEqual(status, 200);
      adminToken = data.token;
    });

    it("should login analyst", async () => {
      const { data } = await api("/auth/login", {
        method: "POST",
        body: { email: "analyst@example.com", password: "analyst123" },
      });
      analystToken = data.token;
    });

    it("should login viewer", async () => {
      const { data } = await api("/auth/login", {
        method: "POST",
        body: { email: "viewer@example.com", password: "viewer123" },
      });
      viewerToken = data.token;
    });

    it("should reject invalid credentials", async () => {
      const { status } = await api("/auth/login", {
        method: "POST",
        body: { email: "admin@example.com", password: "wrong" },
      });
      assert.strictEqual(status, 401);
    });

    it("should reject missing fields", async () => {
      const { status } = await api("/auth/register", {
        method: "POST",
        body: { name: "X" },
      });
      assert.strictEqual(status, 400);
    });
  });

  describe("Access Control", () => {
    it("viewer cannot create records", async () => {
      const { status } = await api("/records", {
        method: "POST",
        token: viewerToken,
        body: { amount: 100, type: "income", category: "Test", date: "2025-01-01" },
      });
      assert.strictEqual(status, 403);
    });

    it("analyst cannot create records", async () => {
      const { status } = await api("/records", {
        method: "POST",
        token: analystToken,
        body: { amount: 100, type: "income", category: "Test", date: "2025-01-01" },
      });
      assert.strictEqual(status, 403);
    });

    it("viewer cannot access user management", async () => {
      const { status } = await api("/users", { token: viewerToken });
      assert.strictEqual(status, 403);
    });

    it("viewer cannot access dashboard", async () => {
      const { status } = await api("/dashboard/summary", { token: viewerToken });
      assert.strictEqual(status, 403);
    });

    it("unauthenticated request is rejected", async () => {
      const { status } = await api("/records");
      assert.strictEqual(status, 401);
    });
  });

  describe("Records CRUD (admin)", () => {
    it("should create a record", async () => {
      const { status, data } = await api("/records", {
        method: "POST",
        token: adminToken,
        body: { amount: 999, type: "income", category: "Bonus", date: "2025-04-01", description: "Test record" },
      });
      assert.strictEqual(status, 201);
      recordId = data.record.id;
    });

    it("should list records with pagination", async () => {
      const { status, data } = await api("/records?page=1&limit=5", { token: adminToken });
      assert.strictEqual(status, 200);
      assert.ok(data.pagination);
      assert.ok(data.records.length <= 5);
    });

    it("should filter by type", async () => {
      const { data } = await api("/records?type=income", { token: adminToken });
      assert.ok(data.records.every((r) => r.type === "income"));
    });

    it("should filter by date range", async () => {
      const { data } = await api("/records?from=2025-02-01&to=2025-02-28", { token: adminToken });
      assert.ok(data.records.every((r) => r.date >= "2025-02-01" && r.date <= "2025-02-28"));
    });

    it("should update a record", async () => {
      const { status, data } = await api(`/records/${recordId}`, {
        method: "PUT",
        token: adminToken,
        body: { amount: 1500, type: "expense", category: "Updated", date: "2025-04-02" },
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.record.amount, 1500);
    });

    it("should soft-delete a record", async () => {
      const { status } = await api(`/records/${recordId}`, { method: "DELETE", token: adminToken });
      assert.strictEqual(status, 200);
      const { status: s2 } = await api(`/records/${recordId}`, { token: adminToken });
      assert.strictEqual(s2, 404);
    });

    it("should reject invalid record data", async () => {
      const { status } = await api("/records", {
        method: "POST",
        token: adminToken,
        body: { amount: -5, type: "invalid", category: "", date: "bad-date" },
      });
      assert.strictEqual(status, 400);
    });
  });

  describe("Dashboard (analyst)", () => {
    it("should return summary", async () => {
      const { status, data } = await api("/dashboard/summary", { token: analystToken });
      assert.strictEqual(status, 200);
      assert.ok("total_income" in data);
      assert.ok("total_expenses" in data);
      assert.ok("net_balance" in data);
    });

    it("should return category summary", async () => {
      const { status, data } = await api("/dashboard/category-summary", { token: analystToken });
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.categories));
    });

    it("should return monthly trends", async () => {
      const { status, data } = await api("/dashboard/monthly-trends", { token: analystToken });
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.trends));
    });

    it("should return recent activity", async () => {
      const { status, data } = await api("/dashboard/recent", { token: analystToken });
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.records));
    });
  });

  describe("User Management (admin)", () => {
    it("should list users", async () => {
      const { status, data } = await api("/users", { token: adminToken });
      assert.strictEqual(status, 200);
      assert.ok(data.users.length >= 3);
    });

    it("should update user role", async () => {
      const { data: list } = await api("/users", { token: adminToken });
      const viewer = list.users.find((u) => u.role === "viewer");
      const { status, data } = await api(`/users/${viewer.id}/role`, {
        method: "PATCH",
        token: adminToken,
        body: { role: "analyst" },
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.user.role, "analyst");
      // revert
      await api(`/users/${viewer.id}/role`, { method: "PATCH", token: adminToken, body: { role: "viewer" } });
    });

    it("should deactivate a user", async () => {
      const { data: list } = await api("/users", { token: adminToken });
      const viewer = list.users.find((u) => u.role === "viewer");
      const { status, data } = await api(`/users/${viewer.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: { status: "inactive" },
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.user.status, "inactive");
      // revert
      await api(`/users/${viewer.id}/status`, { method: "PATCH", token: adminToken, body: { status: "active" } });
    });
  });
});
