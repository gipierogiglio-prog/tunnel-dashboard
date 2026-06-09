const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'dashboard.db');

let db = null;
let SQL = null;

async function initDb() {
  SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Load or create
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tunnel_id TEXT NOT NULL,
    hostname TEXT NOT NULL,
    path TEXT DEFAULT '',
    service TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS apply_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    message TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function execute(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ─── Routes CRUD ───

function getAllRoutes() {
  return query('SELECT * FROM routes ORDER BY tunnel_id, sort_order');
}

function getRoutesByTunnel(tunnelId) {
  return query('SELECT * FROM routes WHERE tunnel_id = ? ORDER BY sort_order', [tunnelId]);
}

function createRoute({ tunnelId, hostname, path, service }) {
  const maxRows = query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM routes WHERE tunnel_id = ?', [tunnelId]);
  const nextOrder = maxRows[0]?.next || 0;
  
  // Insert via exec (raw sql.js API)
  db.run('INSERT INTO routes (tunnel_id, hostname, path, service, sort_order) VALUES (?, ?, ?, ?, ?)',
    [tunnelId, hostname, path || '', service, nextOrder]);
  
  // Get the latest id for this tunnel
  const idRows = query('SELECT MAX(id) as id FROM routes WHERE tunnel_id = ?', [tunnelId]);
  const id = idRows[0]?.id;
  
  saveDb();
  
  if (!id) return null;
  return query('SELECT * FROM routes WHERE id = ?', [id])[0];
}

function updateRoute(id, { hostname, path, service }) {
  execute("UPDATE routes SET hostname=?, path=?, service=?, updated_at=datetime('now') WHERE id=?",
    [hostname, path || '', service, id]);
  return query('SELECT * FROM routes WHERE id = ?', [id])[0] || null;
}

function deleteRoute(id) {
  const existing = query('SELECT id FROM routes WHERE id = ?', [id]);
  if (existing.length === 0) return { changes: 0 };
  execute('DELETE FROM routes WHERE id = ?', [id]);
  return { changes: 1 };
}

// ─── Apply History ───

function createApplyHistory({ status, message, details }) {
  db.run('INSERT INTO apply_history (status, message, details) VALUES (?, ?, ?)',
    [status, message, details ? JSON.stringify(details) : null]);
  const idRows = query('SELECT MAX(id) as id FROM apply_history');
  const id = idRows[0]?.id;
  saveDb();
  if (!id) return null;
  return query('SELECT * FROM apply_history WHERE id = ?', [id])[0];
}

function getLastApplyStatus() {
  const rows = query('SELECT * FROM apply_history ORDER BY id DESC LIMIT 1');
  if (!rows[0]) return null;
  if (rows[0].details) rows[0].details = JSON.parse(rows[0].details);
  return rows[0];
}

function getApplyHistory(limit = 10) {
  const rows = query('SELECT * FROM apply_history ORDER BY id DESC LIMIT ?', [limit]);
  return rows.map(r => {
    if (r.details) r.details = JSON.parse(r.details);
    return r;
  });
}

module.exports = {
  initDb,
  getAllRoutes,
  getRoutesByTunnel,
  createRoute,
  updateRoute,
  deleteRoute,
  createApplyHistory,
  getLastApplyStatus,
  getApplyHistory,
};
