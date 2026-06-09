# 핑크 한국어 · TOPIK 4급 学习网站(带服务器版)

把原来的单文件网页升级成**真正的应用**:有账号登录,学习进度(每日任务、单词记忆/遗忘曲线、成绩、连续打卡)都存到服务器,**换设备、隔几天回来都能接着学**。

技术栈:Node.js + Express + SQLite(用 Node 22 内置的 `node:sqlite`,**无需编译安装**)。

---

## 一、本地运行(3 步)

需要先装 **Node.js 22.5 或更高版本**(因为用到内置 SQLite)。在 https://nodejs.org 下载安装。

```bash
# 1. 进入项目文件夹
cd korean-server

# 2. 安装依赖(纯 JS,几秒钟)
npm install

# 3. 启动
npm start
```

看到 `✅ 服务器已启动 → http://localhost:3000` 后,浏览器打开 **http://localhost:3000** 即可。

右上角点「登录/注册 存进度」,注册一个账号,之后每天的学习就会自动保存。

---

## 二、它会保存什么

| 数据 | 说明 |
|---|---|
| 每日任务 | 当天勾选的任务,刷新/换设备都还在 |
| 单词记忆 | 背单词页「✓记住了 / ↺再来」按钮,按**遗忘曲线**(Leitner 1→5格)安排下次复习时间 |
| 成绩 | 试卷交卷分数 |
| 连续打卡 | 连续学习天数(🔥) |

遗忘曲线复习间隔(天):box1→1, box2→3, box3→7, box4→16, box5→35。答对升一格、答错回第一格。

---

## 三、API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/register` | 注册 `{username,password}` → `{token}` |
| POST | `/api/login` | 登录 → `{token}` |
| GET | `/api/progress` | 进度总览(需 token) |
| POST | `/api/mission` | 保存今日任务 `{done:[0,1,2]}` |
| POST | `/api/word/review` | 复习 `{word,result:'good'|'again'}` |
| GET | `/api/word/due` | 今天该复习的词 |
| POST | `/api/score` | 存成绩 `{section,score,total}` |
| GET | `/api/scores` | 最近成绩 |

带 token 的请求要加请求头:`Authorization: Bearer <token>`。

---

## 四、上线成正式网址(让手机随时能用)

最省事的免费/低价方案(都支持 Node):

1. **Render**(https://render.com)/ **Railway**(https://railway.app)
   - New → Web Service → 连你的 GitHub 仓库(把本项目传上去)
   - Build Command: `npm install`;Start Command: `npm start`
   - 加一个环境变量 `JWT_SECRET` = 一长串随机字符
   - 注意:这类平台磁盘是临时的,SQLite 文件可能重启丢失 → 需要时挂载持久磁盘,或改用它们的 PostgreSQL。

2. **自己的 VPS**(阿里云/腾讯云/Vultr 等):
   ```bash
   npm install -g pm2
   pm2 start server.js --name korean
   pm2 save
   ```
   再用 Nginx 反代 + 域名 + HTTPS。

### 上线前务必:
- 设置环境变量 `JWT_SECRET`(别用代码里的默认值)。
- 密码已用 bcrypt 加密存储;但仍建议加 HTTPS。

---

## 五、怎么加更多单词/语法/题

目前词库、语法、题目都写在 `public/index.html` 里(搜 `const lv4`、`const grammar`、`const testQs`)。
想做成「在后台加词、前端自动更新」,下一步可以:
1. 把词库存进 SQLite 的一张 `words` 表;
2. 加一个 `GET /api/words` 接口返回词库;
3. 前端启动时 `fetch('/api/words')` 动态加载。
需要的话我可以帮你改成这种「内容也走数据库」的版本。

---

## 文件结构
```
korean-server/
├── server.js        后端主程序(API + 静态托管)
├── db.js            数据库建表
├── package.json     依赖与启动脚本
├── public/
│   ├── index.html   前端网页(原网站)
│   └── sync.js      前端同步层(登录+保存进度)
└── README.md
```
