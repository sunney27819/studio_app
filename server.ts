import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("material_life.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS material_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time REAL,
    strength REAL,
    strain REAL,
    strain_rate REAL,
    user_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed Admin if not exists
const seedAdmin = db.prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)");
seedAdmin.run("admin", "admin", "admin");
// Force update admin password for this request
db.prepare("UPDATE users SET password = ? WHERE username = 'admin'").run("admin");
seedAdmin.run("user1", "password123", "user");

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // --- API Routes ---

  // Auth
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).json({ success: false, message: "用户名或密码错误" });
    }
  });

  // Admin: Manage Users
  app.get("/api/admin/users", (req, res) => {
    const users = db.prepare("SELECT id, username, password, role FROM users").all();
    res.json(users);
  });

  app.post("/api/admin/users", (req, res) => {
    const { username, password, role } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password, role || 'user');
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ success: false, message: "用户名已存在" });
    }
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    db.prepare("DELETE FROM users WHERE id = ? AND role != 'admin'").run(req.params.id);
    res.json({ success: true });
  });

  // Data Management
  app.get("/api/data", (req, res) => {
    const data = db.prepare("SELECT * FROM material_data ORDER BY time ASC").all();
    res.json(data);
  });

  app.post("/api/data", (req, res) => {
    const points = Array.isArray(req.body) ? req.body : [req.body];
    const insert = db.prepare("INSERT INTO material_data (time, strength, strain, strain_rate) VALUES (?, ?, ?, ?)");
    const transaction = db.transaction((data) => {
      for (const p of data) {
        insert.run(p.time, p.strength, p.strain, p.strain_rate);
      }
    });
    transaction(points);
    res.json({ success: true, count: points.length });
  });

  app.delete("/api/data/clear", (req, res) => {
    db.prepare("DELETE FROM material_data").run();
    res.json({ success: true });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
