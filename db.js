// db.js — 使用 Node 22 内置 SQLite(免安装编译)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'korean.db'));
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS word_srs (
  user_id INTEGER NOT NULL, word TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1, due_date TEXT NOT NULL,
  reps INTEGER NOT NULL DEFAULT 0, last_review TEXT,
  PRIMARY KEY (user_id, word)
);
CREATE TABLE IF NOT EXISTS daily (
  user_id INTEGER NOT NULL, date TEXT NOT NULL,
  missions TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  section TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL
);
`);

module.exports = db;
