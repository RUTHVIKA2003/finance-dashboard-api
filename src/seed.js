const bcrypt = require("bcryptjs");
const db = require("./db");

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Seed users
const insertUser = db.prepare("INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)");
const seedUsers = db.transaction(() => {
  insertUser.run("Admin User", "admin@example.com", hash("admin123"), "admin");
  insertUser.run("Analyst User", "analyst@example.com", hash("analyst123"), "analyst");
  insertUser.run("Viewer User", "viewer@example.com", hash("viewer123"), "viewer");
});
seedUsers();

// Seed financial records
const adminId = db.prepare("SELECT id FROM users WHERE email = 'admin@example.com'").get().id;
const insertRecord = db.prepare(
  "INSERT INTO financial_records (user_id, amount, type, category, date, description) VALUES (?, ?, ?, ?, ?, ?)"
);

const records = [
  [adminId, 5000, "income", "Salary", "2025-01-15", "Monthly salary"],
  [adminId, 1200, "income", "Freelance", "2025-01-20", "Web dev project"],
  [adminId, 800, "expense", "Rent", "2025-01-01", "Monthly rent"],
  [adminId, 150, "expense", "Utilities", "2025-01-05", "Electricity bill"],
  [adminId, 200, "expense", "Groceries", "2025-01-10", "Weekly groceries"],
  [adminId, 5000, "income", "Salary", "2025-02-15", "Monthly salary"],
  [adminId, 850, "expense", "Rent", "2025-02-01", "Monthly rent"],
  [adminId, 300, "expense", "Transport", "2025-02-08", "Fuel and maintenance"],
  [adminId, 2000, "income", "Investment", "2025-02-20", "Stock dividends"],
  [adminId, 500, "expense", "Entertainment", "2025-02-14", "Dining out"],
  [adminId, 5000, "income", "Salary", "2025-03-15", "Monthly salary"],
  [adminId, 100, "expense", "Subscriptions", "2025-03-01", "Streaming services"],
  [adminId, 400, "expense", "Groceries", "2025-03-10", "Monthly groceries"],
  [adminId, 750, "income", "Freelance", "2025-03-22", "Design project"],
  [adminId, 900, "expense", "Rent", "2025-03-01", "Monthly rent"],
];

const seedRecords = db.transaction(() => { for (const r of records) insertRecord.run(...r); });
seedRecords();

console.log("Seed complete: 3 users, 15 financial records");
console.log("Credentials:");
console.log("  admin@example.com / admin123");
console.log("  analyst@example.com / analyst123");
console.log("  viewer@example.com / viewer123");
