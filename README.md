# Finance Dashboard API

A backend for a finance dashboard system with role-based access control, financial records management, and summary analytics.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Docs**: Swagger UI (swagger-ui-express + swagger-jsdoc)
- **Logging**: Morgan
- **Tests**: Node.js built-in test runner

## Quick Start

```bash
npm install
npm run seed    # Seeds 3 users + 15 sample records
npm start       # Starts on http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

## API Documentation

Interactive Swagger docs available at: **http://localhost:3000/api/docs**

## Seed Credentials

| Role    | Email                 | Password    |
|---------|-----------------------|-------------|
| Admin   | admin@example.com     | admin123    |
| Analyst | analyst@example.com   | analyst123  |
| Viewer  | viewer@example.com    | viewer123   |

## API Endpoints

### Auth
| Method | Endpoint             | Body                                    | Auth |
|--------|----------------------|-----------------------------------------|------|
| POST   | `/api/auth/register` | `{name, email, password, role?}`        | No   |
| POST   | `/api/auth/login`    | `{email, password}`                     | No   |

### Users (Admin only)
| Method | Endpoint                 | Body         | Description          |
|--------|--------------------------|--------------|----------------------|
| GET    | `/api/users`             | —            | List all users       |
| GET    | `/api/users/:id`         | —            | Get user by ID       |
| PATCH  | `/api/users/:id/role`    | `{role}`     | Update user role     |
| PATCH  | `/api/users/:id/status`  | `{status}`   | Activate/deactivate  |
| DELETE | `/api/users/:id`         | —            | Delete user          |

### Financial Records
| Method | Endpoint            | Auth Roles          | Description                |
|--------|---------------------|---------------------|----------------------------|
| GET    | `/api/records`      | All authenticated   | List records (filterable)  |
| GET    | `/api/records/:id`  | All authenticated   | Get single record          |
| POST   | `/api/records`      | Admin               | Create record              |
| PUT    | `/api/records/:id`  | Admin               | Update record              |
| DELETE | `/api/records/:id`  | Admin               | Soft-delete record         |

**Query Parameters for GET /api/records:**
- `type` — filter by `income` or `expense`
- `category` — filter by category name
- `from` / `to` — date range (YYYY-MM-DD)
- `search` — search in description
- `page` / `limit` — pagination (default: page=1, limit=20)

### Dashboard (Admin + Analyst)
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/api/dashboard/summary`          | Total income/expenses/net|
| GET    | `/api/dashboard/category-summary` | Totals by category       |
| GET    | `/api/dashboard/monthly-trends`   | Monthly income vs expense|
| GET    | `/api/dashboard/recent`           | Recent activity          |
| GET    | `/api/dashboard/audit-log`        | Audit trail (Admin only) |

**Query Parameters:**
- `monthly-trends?months=6` — number of months to look back (max 24)
- `recent?limit=10` — number of recent records (max 50)
- `audit-log?limit=50` — number of audit entries (max 200)

## Access Control Matrix

| Action                  | Viewer | Analyst | Admin |
|-------------------------|--------|---------|-------|
| View records            | ✅     | ✅      | ✅    |
| View dashboard/summary  | ❌     | ✅      | ✅    |
| Create/update records   | ❌     | ❌      | ✅    |
| Delete records          | ❌     | ❌      | ✅    |
| Manage users            | ❌     | ❌      | ✅    |
| View audit log          | ❌     | ❌      | ✅    |

## Running Tests

The server must be running for integration tests:

```bash
npm start &          # Start server in background
npm test             # Run tests
```

## Testing with Swagger UI

1. Open **http://localhost:3000/api/docs** in your browser
2. Login: expand **POST /api/auth/login** → Try it out → use `{"email": "admin@example.com", "password": "admin123"}` → Execute
3. Copy the `token` from the response
4. Click the **🔒 Authorize** button (top right) → paste the token → Authorize
5. Now test any endpoint — the token is sent automatically

To test access control, repeat with `viewer@example.com` / `viewer123` and try creating a record — you'll get 403 Forbidden.

## Project Structure

```
src/
├── index.js              # Express app entry point
├── db.js                 # SQLite setup + schema
├── seed.js               # Sample data seeder
├── swagger.js            # OpenAPI/Swagger configuration
├── index.test.js         # Integration tests
├── middleware/
│   ├── auth.js           # JWT auth + role authorization
│   └── validate.js       # Request body validation
└── routes/
    ├── auth.js           # Register + login
    ├── users.js          # User management (admin)
    ├── records.js        # Financial records CRUD
    └── dashboard.js      # Summary/analytics + audit log
```

## Design Decisions & Assumptions

1. **SQLite** — chosen for zero-config setup. Evaluators can `npm install && npm start` with no external DB.
2. **Soft delete** — financial records use `is_deleted` flag instead of hard delete for audit trail.
3. **Audit log** — all mutations (create, update, delete, login, role changes) are logged to an `audit_log` table with user, action, target, and timestamp. Critical for a finance system.
4. **Password strength** — minimum 6 characters enforced at validation layer. In production, would add complexity rules.
5. **Admin self-protection** — admins cannot change their own role, deactivate themselves, or delete themselves.
6. **Rate limiting** — 100 req/15min general, 20 req/15min on auth endpoints to prevent brute force.
7. **Request logging** — Morgan logs every request for observability.
8. **Role on registration** — role can be passed during registration for demo convenience. In production, this would be admin-only.
9. **Synchronous DB** — `better-sqlite3` is synchronous, which simplifies code and is actually faster for single-server SQLite usage.
10. **No ORM** — raw SQL keeps the data layer transparent and avoids unnecessary abstraction for this scope.
11. **Validation** — lightweight custom validator instead of a library like Joi, keeping dependencies minimal.
12. **JWT expiry** — tokens expire in 24 hours. No refresh token flow implemented.

## Error Response Format

All errors follow a consistent format:
```json
{
  "error": "Human-readable error message",
  "details": ["field-level errors (for validation)"]
}
```

## Environment Variables

| Variable     | Default                                          | Description       |
|-------------|--------------------------------------------------|-------------------|
| `PORT`      | `3000`                                           | Server port       |
| `JWT_SECRET`| `finance-dashboard-secret-key-change-in-production` | JWT signing key |
| `DB_PATH`   | `./data/finance.db`                              | SQLite file path  |
