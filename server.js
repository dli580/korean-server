// server.js — 핑크 한국어 后端
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
// 生产环境请在系统环境变量里设置一个长随机串:JWT_SECRET
const SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 工具 ----------
const today = () => new Date().toISOString().slice(0, 10);
const SRS_INTERVALS = [0, 1, 3, 7, 16, 35]; // box 1..5 复习间隔(天)
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: '未登录' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ error: '登录已失效,请重新登录' }); }
}

// ---------- 账号 ----------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 4)
    return res.status(400).json({ error: '用户名必填,密码至少4位' });
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (exists) return res.status(409).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users(username,pass_hash) VALUES(?,?)').run(username, hash);
  const token = jwt.sign({ id: info.lastInsertRowid, username }, SECRET, { expiresIn: '30d' });
  res.json({ token, username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!u || !bcrypt.compareSync(password || '', u.pass_hash))
    return res.status(401).json({ error: '用户名或密码错误' });
  const token = jwt.sign({ id: u.id, username: u.username }, SECRET, { expiresIn: '30d' });
  res.json({ token, username: u.username });
});

// ---------- 进度总览 ----------
app.get('/api/progress', auth, (req, res) => {
  const uid = req.user.id;
  const d = db.prepare('SELECT missions FROM daily WHERE user_id=? AND date=?').get(uid, today());
  const dueCount = db.prepare('SELECT COUNT(*) n FROM word_srs WHERE user_id=? AND due_date<=?').get(uid, today()).n;
  const learned = db.prepare('SELECT COUNT(*) n FROM word_srs WHERE user_id=?').get(uid).n;
  const mastered = db.prepare('SELECT COUNT(*) n FROM word_srs WHERE user_id=? AND box>=5').get(uid).n;
  // 连续打卡:从今天往回数有记录的天数
  const days = db.prepare('SELECT date FROM daily WHERE user_id=? ORDER BY date DESC').all(uid).map(r => r.date);
  let streak = 0, cur = today();
  for (const dt of days) { if (dt === cur) { streak++; cur = addDays(cur, -1); } else break; }
  res.json({
    today: today(),
    missionsDone: d ? JSON.parse(d.missions) : [],
    dueCount, learned, mastered, streak,
    username: req.user.username
  });
});

// ---------- 每日任务 ----------
app.post('/api/mission', auth, (req, res) => {
  const uid = req.user.id;
  const done = Array.isArray(req.body.done) ? req.body.done : [];
  db.prepare(`INSERT INTO daily(user_id,date,missions) VALUES(?,?,?)
              ON CONFLICT(user_id,date) DO UPDATE SET missions=excluded.missions`)
    .run(uid, today(), JSON.stringify(done));
  res.json({ ok: true });
});

// ---------- 单词复习(遗忘曲线)----------
// result: 'good'(记住了,升一格) | 'again'(没记住,回第1格)
app.post('/api/word/review', auth, (req, res) => {
  const uid = req.user.id;
  const { word, result } = req.body || {};
  if (!word) return res.status(400).json({ error: '缺少 word' });
  const row = db.prepare('SELECT box,reps FROM word_srs WHERE user_id=? AND word=?').get(uid, word);
  let box = row ? row.box : 1;
  const reps = (row ? row.reps : 0) + 1;
  box = result === 'again' ? 1 : Math.min(box + 1, 5);
  const due = addDays(today(), SRS_INTERVALS[box]);
  db.prepare(`INSERT INTO word_srs(user_id,word,box,due_date,reps,last_review) VALUES(?,?,?,?,?,?)
              ON CONFLICT(user_id,word) DO UPDATE SET box=excluded.box,due_date=excluded.due_date,reps=excluded.reps,last_review=excluded.last_review`)
    .run(uid, word, box, due, reps, today());
  res.json({ ok: true, word, box, due });
});

// 今天到期需要复习的单词
app.get('/api/word/due', auth, (req, res) => {
  const rows = db.prepare('SELECT word,box,due_date FROM word_srs WHERE user_id=? AND due_date<=? ORDER BY due_date').all(req.user.id, today());
  res.json({ due: rows });
});

// ---------- 成绩 ----------
app.post('/api/score', auth, (req, res) => {
  const { section, score, total } = req.body || {};
  db.prepare('INSERT INTO scores(user_id,section,score,total) VALUES(?,?,?,?)')
    .run(req.user.id, String(section || 'quiz'), Number(score) || 0, Number(total) || 0);
  res.json({ ok: true });
});

app.get('/api/scores', auth, (req, res) => {
  const rows = db.prepare('SELECT ts,section,score,total FROM scores WHERE user_id=? ORDER BY ts DESC LIMIT 50').all(req.user.id);
  res.json({ scores: rows });
});

app.listen(PORT, () => console.log(`✅ 핑크 한국어 服务器已启动 → http://localhost:${PORT}`));
