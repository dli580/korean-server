/* sync.js — 把静态网页接到后端:登录后自动保存进度。未登录时网页照常离线可用。 */
(function () {
  const API = location.origin;
  const LS = 'kr_token', LSU = 'kr_user';
  let token = localStorage.getItem(LS) || '';
  let username = localStorage.getItem(LSU) || '';

  async function api(path, body) {
    const opt = { headers: {} };
    if (body) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    if (token) opt.headers['Authorization'] = 'Bearer ' + token;
    const r = await fetch(API + path, opt);
    return r.json();
  }

  // 账号栏(右上角)
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:8px;right:8px;z-index:50;display:flex;gap:6px;align-items:center;font-family:Quicksand,sans-serif';
  document.body.appendChild(bar);

  function render() {
    if (token) {
      bar.innerHTML = `<span id="acctstats" style="background:#fff;border:2px solid #ffd1e8;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:700;color:#ff2e86;box-shadow:0 3px 0 rgba(120,60,140,.12)">👤 ${username}</span><button id="logoutBtn" style="background:#fff;border:2px solid #ffd1e8;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;color:#ff2e86;cursor:pointer">退出</button>`;
      document.getElementById('logoutBtn').onclick = () => { token = ''; username = ''; localStorage.removeItem(LS); localStorage.removeItem(LSU); render(); };
      loadProgress();
    } else {
      bar.innerHTML = `<button id="loginBtn" style="background:linear-gradient(180deg,#ff7ab4,#ff2e86);color:#fff;border:none;border-radius:20px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 0 #ff2e86">登录/注册 存进度</button>`;
      document.getElementById('loginBtn').onclick = openModal;
    }
  }

  function openModal() {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(58,43,82,.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px';
    m.innerHTML = `<div style="background:#fff;border-radius:22px;padding:24px;max-width:340px;width:100%;box-shadow:0 16px 40px rgba(120,60,140,.3)">
      <h3 style="font-family:'Baloo 2',sans-serif;color:#ff2e86;margin:0 0 4px;font-size:20px">登录 / 注册</h3>
      <p style="color:#8579a0;font-size:13px;margin:0 0 12px">登录后,每日任务、单词记忆、成绩都会存到服务器,换设备也能继续。</p>
      <input id="luser" placeholder="用户名" autocomplete="username" style="width:100%;box-sizing:border-box;margin:5px 0;padding:11px;border:2px solid #ffd1e8;border-radius:12px;font-size:15px">
      <input id="lpass" type="password" placeholder="密码(至少4位)" autocomplete="current-password" style="width:100%;box-sizing:border-box;margin:5px 0;padding:11px;border:2px solid #ffd1e8;border-radius:12px;font-size:15px">
      <div id="lerr" style="color:#ff2e86;font-size:13px;min-height:18px"></div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button id="doLogin" style="flex:1;background:linear-gradient(180deg,#ff7ab4,#ff2e86);color:#fff;border:none;border-radius:12px;padding:11px;font-weight:700;cursor:pointer">登录</button>
        <button id="doReg" style="flex:1;background:#fff;color:#ff2e86;border:2px solid #ff5fa2;border-radius:12px;padding:11px;font-weight:700;cursor:pointer">注册</button>
      </div>
      <button id="closeM" style="width:100%;margin-top:8px;background:none;border:none;color:#8579a0;cursor:pointer;font-size:13px">取消</button></div>`;
    document.body.appendChild(m);
    document.getElementById('closeM').onclick = () => m.remove();
    async function go(path) {
      const u = document.getElementById('luser').value.trim();
      const p = document.getElementById('lpass').value;
      try {
        const res = await api(path, { username: u, password: p });
        if (res.token) { token = res.token; username = res.username; localStorage.setItem(LS, token); localStorage.setItem(LSU, username); m.remove(); render(); }
        else document.getElementById('lerr').textContent = res.error || '失败';
      } catch (e) { document.getElementById('lerr').textContent = '连不上服务器'; }
    }
    document.getElementById('doLogin').onclick = () => go('/api/login');
    document.getElementById('doReg').onclick = () => go('/api/register');
  }

  async function loadProgress() {
    try {
      const p = await api('/api/progress');
      if (p.error) return;
      if (typeof done !== 'undefined' && Array.isArray(p.missionsDone)) {
        done.clear(); p.missionsDone.forEach(i => done.add(i));
        if (typeof renderMissions === 'function') renderMissions();
      }
      const s = document.getElementById('acctstats');
      if (s) s.innerHTML = `👤 ${username} · 🔥${p.streak}天 · 学过${p.learned}词 · 待复习${p.dueCount}`;
    } catch (e) {}
  }

  // 复习按钮(遗忘曲线):记录当前卡片到服务器并翻到下一张
  window.krRev = function (result) {
    try { if (token && typeof curDeck !== 'undefined') api('/api/word/review', { word: curDeck[mi].kr, result }); } catch (e) {}
    if (typeof nextCard === 'function') nextCard();
  };

  function hook() {
    if (typeof window.toggleM === 'function') {
      const o = window.toggleM;
      window.toggleM = function (i) { o(i); if (token) { try { api('/api/mission', { done: [...done] }); } catch (e) {} setTimeout(loadProgress, 200); } };
    }
    if (typeof window.submitTest === 'function') {
      const o = window.submitTest;
      window.submitTest = function () { o(); if (token) { const el = document.getElementById('testScore'); const t = el && el.textContent.match(/(\d+)\s*\/\s*(\d+)/); if (t) try { api('/api/score', { section: 'reading', score: +t[1], total: +t[2] }); } catch (e) {} } };
    }
    const flash = document.querySelector('#memo .flash');
    if (flash && !document.getElementById('srsbar')) {
      const b = document.createElement('div');
      b.id = 'srsbar'; b.style.cssText = 'text-align:center;margin:8px 0';
      b.innerHTML = `<span style="font-size:12px;color:#8579a0;display:block;margin-bottom:2px">登录后,下面两个按钮会按「遗忘曲线」安排复习</span>
      <button onclick="krRev('again')" style="background:#fff;color:#ff2e86;border:2px solid #ff5fa2;border-radius:14px;padding:9px 16px;font-weight:700;cursor:pointer;margin:0 4px">↺ 再来</button>
      <button onclick="krRev('good')" style="background:linear-gradient(180deg,#a6ecd8,#3fc9a3);color:#0d5a45;border:none;border-radius:14px;padding:9px 16px;font-weight:700;cursor:pointer;margin:0 4px">✓ 记住了</button>`;
      flash.parentNode.insertBefore(b, flash.nextSibling);
    }
  }

  if (document.readyState !== 'loading') { render(); hook(); }
  else document.addEventListener('DOMContentLoaded', () => { render(); hook(); });
})();
