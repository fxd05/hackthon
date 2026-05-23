import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const STORE_PATH = path.join(process.cwd(), "memorials-store.json");
const USERS_STORE_PATH = path.join(process.cwd(), "users-store.json");
const FRIENDS_STORE_PATH = path.join(process.cwd(), "friends-store.json");

// In-memory session store: token -> userId
const sessions = new Map<string, string>();

// ─── OpenAI-Compatible AI Client ───

const AI_BASE_URL = process.env.AI_BASE_URL || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

function isAIConfigured(): boolean {
  return !!(AI_BASE_URL && AI_API_KEY);
}

async function callAI(prompt: string, options?: { json?: boolean; system?: string }): Promise<string | null> {
  if (!isAIConfigured()) return null;
  const messages: any[] = [];
  if (options?.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: prompt });

  const body: any = { model: AI_MODEL, messages, temperature: 0.8 };
  if (options?.json) {
    body.response_format = { type: "json_object" };
  }

  try {
    const url = AI_BASE_URL.replace(/\/+$/, '') + "/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error(`AI API error: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("AI call failed:", err);
    return null;
  }
}

// ─── Data Store Helpers ───

const MINISTRIES = ['经略阁', '寻乐记', '创意坊'];

const loadJSON = (filePath: string, fallback: any[] = []): any[] => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (error) {
    console.error(`Failed to load ${filePath}:`, error);
  }
  return fallback;
};

const saveJSON = (filePath: string, data: any[]) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Failed to save ${filePath}:`, err);
  }
};

const loadUsers = () => loadJSON(USERS_STORE_PATH);
const saveUsers = (data: any[]) => saveJSON(USERS_STORE_PATH, data);
const loadFriends = () => loadJSON(FRIENDS_STORE_PATH);
const saveFriends = (data: any[]) => saveJSON(FRIENDS_STORE_PATH, data);

// Memorials with seed initialization
const SEED_MEMORIALS = [
  {
    id: "seed-1",
    title: "程序员大兴土木！电脑死循环发热取暖大作",
    url: "https://www.douyin.com",
    rawText: "https://v.douyin.com/xyz1/ 【搞笑】大冬天程序员如何使用超频显卡 and 死循环烤红薯，隔壁工科生看哭了！",
    sender: "工部侍郎 科技达人",
    category: "创意坊",
    summary: "工部司呈递：江宁郡一程序员，于寒冬大雪纷飞之际，写就无限递归天书数卷，引天雷入机。显卡温度飙升至九十度，烤红薯极香。极富科学研发之精神，臣请推广于全军！",
    keywords: ["程序员", "死循环", "烤红薯", "超频"],
    entertainmentRatio: 88,
    severityLevel: "微臣急奏",
    status: "pending",
    createdTime: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: "seed-2",
    title: "震惊！十五斤肥橘猫涉嫌压塌李侍郎家屋顶琉璃瓦被扣押猫粮铺",
    url: "https://www.douyin.com",
    rawText: "https://v.douyin.com/xyz2/ 橘猫以重力服人，居然压裂太傅府的琉璃瓦，已被隔壁扣留要小鱼干赎人！",
    sender: "刑部尚书 铁面无私",
    category: "寻乐记",
    summary: "刑部司急呈：今日正午，太傅府饲养之巨型橘猫（重达十五斤，色若黄金），因飞檐走壁时不幸重力失衡，压垮御赐五彩琉璃瓦三片。目前该猫在隔壁粮铺因索要精神赔付，已被铺主扣押。臣请动用九门兵马前往搭救！",
    keywords: ["橘猫", "瓦片被垮", "小鱼干", "肥猫惹祸"],
    entertainmentRatio: 96,
    severityLevel: "弹劾奏章",
    status: "pending",
    createdTime: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: "seed-3",
    title: "二哈拆迁办大显身手：上古神兽再度肢解御赐龙椅屏风",
    url: "https://www.douyin.com",
    rawText: "https://v.douyin.com/xyz3/ 傻二哈趁主人不在把真皮沙发拆成废布，主人气得想吃红烧哈士奇",
    sender: "兵部侍郎 战力观测",
    category: "寻乐记",
    summary: "兵部统领奏：番邦进贡之雪撬神兽（俗名哈士奇，又称二哈），战力极强，今日于内廷行馆，仅用半个时辰，即将皇家真皮贵妃榻以及屏风一座粉碎成棉。其势震古烁今。微臣恐其有反心，特密陈弹劾之！",
    keywords: ["哈士奇", "龙椅撕碎", "神兽拆迁", "红烧哈士奇"],
    entertainmentRatio: 92,
    severityLevel: "十万火急",
    status: "pending",
    createdTime: new Date(Date.now() - 3600000 * 1).toISOString()
  },
  {
    id: "seed-4",
    title: "两分钱自制米其林烤炉，户部极致省钱秘方",
    url: "https://www.douyin.com",
    rawText: "https://v.douyin.com/xyz4/ 捡易拉罐做成自动炖汤炉，成本两毛，炖肉极香，太省了",
    sender: "户部仓曹 算无遗策",
    category: "创意坊",
    summary: "户部司金奏报：今有市井奇人，用废铜废铁（废旧易拉罐）配以小柴炭，做成旋转自动炙烤炉，炖制大肉极香，造价仅二文。若推行此法，可省军伙柴炭支出八成。臣请嘉奖此人！",
    keywords: ["省钱神技", "易拉罐", "手工达人", "米其林"],
    entertainmentRatio: 78,
    severityLevel: "日常请安",
    status: "approved",
    imperialComment: "朕已阅。此等节俭勤恳兼具口腹之欲的奇思，深得朕心。赏该奇人废铁易拉罐十万个，任其大兴烧烤大业！",
    createdTime: new Date(Date.now() - 3600000 * 5).toISOString(),
    approvedTime: new Date(Date.now() - 3600000 * 4.8).toISOString()
  }
];

const loadMemorials = (): any[] => {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load store, returning default seed:", error);
  }
  saveJSON(STORE_PATH, SEED_MEMORIALS);
  return SEED_MEMORIALS;
};

// ─── Auth Middleware ───

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: "未登录，请先报名登殿。" });
  }
  (req as any).userId = sessions.get(token);
  next();
}

// ─── Gemini Fallback Helpers ───

function cleanUrl(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/;
  const match = text.match(urlRegex);
  return match ? match[0] : "https://www.douyin.com";
}

function fallbackAnalysis(rawText: string): any {
  const douyinUrl = cleanUrl(rawText);
  const isCode = /码|程序员|代码|技术|电脑|算法|软件/.test(rawText);
  const isAnimal = /猫|狗|宠物|橘猫|哈士奇|二哈|萌宠/.test(rawText);
  const isFoodOrMoney = /省钱|美食|做菜|做饭|省|花钱|金币|穷/.test(rawText);
  const isMusicOrCraft = /音乐|艺术|手工|画画|唱歌|乐器|曲子/.test(rawText);
  const isFail = /失败|摔跤|搞笑|沙雕|翻车|撞车|惨/.test(rawText);

  let title = "民间奇闻视频呈递";
  let sender = "地方按察使";
  let category = "经略阁";
  let summary = "御前密呈：近日市井喧嚣，微臣于里弄探得一奇异短剧。百姓争相传看。臣恐其荒废朝政，特抄送御前简报。";
  let keywords = ["民间奇闻", "短视频"];
  let entVal = Math.floor(Math.random() * 30) + 70;
  let severity: any = "日常请安";

  if (isCode) {
    title = "工科匠人夜观天象用代码炼金";
    sender = "工部侍郎 科研总监";
    category = "创意坊";
    summary = "工部密报：有刁钻程序员引天地灵气（死循环）催化计算机，至其极热以御冬寒。此法甚妙，惜废旧电脑甚多。";
    keywords = ["科技", "程序员", "炼金", "死循环"];
    severity = "微臣急奏";
  } else if (isAnimal) {
    title = "番邦灵兽大闹天廷请拨兵解救";
    sender = "御马监 飞禽走兽特使";
    category = "寻乐记";
    summary = "兵部急奏：番邦金丝胖橘（或蠢朋哈狗）身负重力真气，于京城瓦舍摧梁毁栋。因索取金枪鱼与罐头，已被市井扣留，形势万分凶险。";
    keywords = ["灵兽", "拆家", "小鱼干", "超重"];
    severity = "弹劾奏章";
  } else if (isFoodOrMoney) {
    title = "奇人施展两毛钱造熔炉神技";
    sender = "户部仓曹 钱米督办";
    category = "经略阁";
    summary = "户部秉奏：有草根铁匠在瓦舍利用废铜炼气，耗资仅两分即可制作香气四溢之烤炉。民富且会省，实乃社稷之大幸，臣请圣上派太医品尝！";
    keywords = ["省钱", "米其林", "省开支"];
    severity = "日常请安";
  } else if (isMusicOrCraft) {
    title = "乐师合奏惊世骇俗魔性绝音";
    sender = "礼部侍郎 乐府校书";
    category = "经略阁";
    summary = "礼部奏呈：番邦奇才于街头摇骰打击，曲风邪道魅惑，引万千白丁群聚。此等魔音洗脑，臣恐扰乱儒门正乐，特呈圣断。";
    keywords = ["魔性洗脑", "音乐", "民乐大赏"];
    severity = "日常请安";
  } else if (isFail) {
    title = "市井壮士惊天翻车喜剧大赏";
    sender = "刑部郎中 司狱典狱";
    category = "寻乐记";
    summary = "刑部急报：有刁民在街头展现飞天大胯，却不慎倾覆于下水道中。画面悲壮惨烈，引人哄堂大笑。实涉公共治安，然实属好笑，微臣特记。";
    keywords = ["沙雕", "惊天大跨", "下水道"];
    severity = "十万火急";
  }

  const textTitleMatch = rawText.match(/【(.*?)】/);
  if (textTitleMatch && textTitleMatch[1]) {
    title = textTitleMatch[1];
  }

  return {
    id: "mem-" + Date.now(),
    title,
    url: douyinUrl,
    rawText,
    sender,
    category,
    summary,
    keywords,
    entertainmentRatio: entVal,
    severityLevel: severity,
    status: "pending",
    createdTime: new Date().toISOString()
  };
}

function getFallbackComment(title: string, category: string, tone: string): string {
  const pre = `【御笔亲批】 \n`;
  switch (tone) {
    case "pleased":
      return pre + `朕阅毕此《${title}》，深觉此乃国之祥瑞。此等奇人，甚合朕心。准奏！朕今晚便要亲自驾临此视频，赏赐该爱卿大鱼干/猫薄荷万两，退下。`;
    case "angry":
      return pre + `放肆！大不敬！此等荒谬奇葩之事《${title}》，竟也敢公然呈递御前？来人，把这发视频的给朕拉出去，打手板二十大板，罚俸没收其零食包！`;
    case "laugh":
      return pre + `哈哈哈哈！朕生平未见此等离谱绝活。简直让朕笑出龙吟。爱卿此奏立了大功，令整个朝廷蓬荜生辉。朕准奏，今日便赐在座诸爱卿与朕同乐！`;
    case "reward":
      return pre + `大赏！此部视频《${title}》深刻反映了我国当下百姓在搞笑、搞怪、整活领域的高超战力。着户部拨款两文购买罐头，重重有赏！`;
    case "held":
    default:
      return pre + `留中不发。此折描述之《${title}》情节跌宕起伏，朕疑心其中有诈。先发回翰林院等天黑之后再赏，暂且记下，择日复阅。`;
  }
}

function getFallbackBriefing(memorials: any[]): any {
  const pending = memorials.filter(m => m.status === 'pending');
  const approved = memorials.filter(m => m.status === 'approved');
  const stats = MINISTRIES.map(cat => {
    const list = memorials.filter(m => m.category === cat);
    const count = list.length;
    const avg = count ? Math.round(list.reduce((sum: number, m: any) => sum + m.entertainmentRatio, 0) / count) : 0;
    return { category: cat, count, avgEntertainment: avg };
  });
  const senders = Array.from(new Set(memorials.map(m => m.sender.split(' ')[0])));
  return {
    id: "brief-" + Date.now(),
    date: new Date().toISOString().split('T')[0],
    overallHealth: "四海升平，逗趣之风盛行。朝野之中，逗笑恶搞与手工强人成鼎足之势，社稷稳如泰山。",
    imperialReport: `【内阁密奏大典】\n昨日，御书房共裁夺折子 ${memorials.length} 封。待奉朱笔御批者尚余 ${pending.length} 封，已有 ${approved.length} 封奉旨施行。\n\n当前，代表沙雕搞笑之【刑部】与代表民间奇技之【工部】势力活跃，大橘与恶犬在殿前争夺特权，令百官哑然。臣等建议，陛下今晚需加紧督察批阅，以免折子堆积如山，扰乱朝纲。钦此！`,
    categoryStatistics: stats,
    activeSenders: senders.slice(0, 5)
  };
}

// ══════════════════════════════════════════════
//  API Routes
// ══════════════════════════════════════════════

// ─── Auth Routes (no middleware) ───

app.post("/api/register", async (req, res) => {
  const { username, password, displayName, avatarTitle } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "用户名和密码不可空缺。" });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ success: false, error: "用户名须在2-20字之间。" });
  }
  if (password.length < 3) {
    return res.status(400).json({ success: false, error: "口令至少三位。" });
  }
  const users = loadUsers();
  if (users.find((u: any) => u.username === username)) {
    return res.status(409).json({ success: false, error: "此名号已被他人占用。" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: "user-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    username,
    passwordHash,
    displayName: displayName || username,
    avatarTitle: avatarTitle || "布衣百姓",
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);

  // Copy seed memorials for this new user
  const memorials = loadMemorials();
  const userSeeds = SEED_MEMORIALS.map((seed, i) => ({
    ...seed,
    id: `seed-${user.id}-${i + 1}-${Date.now()}`,
    toUserId: user.id,
    fromUserId: null,
    createdTime: new Date(Date.now() - 3600000 * (5 - i)).toISOString()
  }));
  memorials.push(...userSeeds);
  saveJSON(STORE_PATH, memorials);

  const token = "tok-" + Math.random().toString(36).slice(2) + Date.now();
  sessions.set(token, user.id);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ success: true, data: { user: safeUser, token } });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "请填写用户名和口令。" });
  }
  const users = loadUsers();
  const user = users.find((u: any) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, error: "名号或口令有误，不得入宫。" });
  }
  const token = "tok-" + Math.random().toString(36).slice(2) + Date.now();
  sessions.set(token, user.id);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ success: true, data: { user: safeUser, token } });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users.find((u: any) => u.id === (req as any).userId);
  if (!user) return res.status(404).json({ success: false, error: "用户不存在" });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
});

// ─── Friend Routes ───

app.get("/api/users/search", authMiddleware, (req, res) => {
  const q = ((req.query.q as string) || "").toLowerCase();
  const userId = (req as any).userId;
  if (!q) return res.json({ success: true, data: [] });
  const users = loadUsers();
  const results = users
    .filter((u: any) => u.id !== userId && (u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)))
    .map(({ passwordHash, ...safe }: any) => safe)
    .slice(0, 10);
  res.json({ success: true, data: results });
});

app.post("/api/friends/request", authMiddleware, (req, res) => {
  const fromUserId = (req as any).userId;
  const { toUserId } = req.body;
  if (!toUserId || fromUserId === toUserId) {
    return res.status(400).json({ success: false, error: "无效的好友请求。" });
  }
  const users = loadUsers();
  if (!users.find((u: any) => u.id === toUserId)) {
    return res.status(404).json({ success: false, error: "此人不在大内名册中。" });
  }
  const friends = loadFriends();
  const existing = friends.find((f: any) =>
    ((f.fromUserId === fromUserId && f.toUserId === toUserId) ||
     (f.fromUserId === toUserId && f.toUserId === fromUserId)) &&
    f.status !== 'rejected'
  );
  if (existing) {
    return res.status(409).json({ success: false, error: "已有关联请求存在。" });
  }
  const request = {
    id: "fr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  friends.push(request);
  saveFriends(friends);
  res.json({ success: true, data: request });
});

app.get("/api/friends", authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const friends = loadFriends();
  const users = loadUsers();

  const accepted = friends.filter((f: any) => f.status === 'accepted' &&
    (f.fromUserId === userId || f.toUserId === userId));
  const pendingReceived = friends.filter((f: any) => f.status === 'pending' && f.toUserId === userId);
  const pendingSent = friends.filter((f: any) => f.status === 'pending' && f.fromUserId === userId);

  const resolveUser = (uid: string) => {
    const u = users.find((u: any) => u.id === uid);
    if (!u) return null;
    const { passwordHash, ...safe } = u;
    return safe;
  };

  const friendUsers = accepted.map((f: any) => {
    const friendId = f.fromUserId === userId ? f.toUserId : f.fromUserId;
    const user = resolveUser(friendId);
    if (!user) return null;
    return { ...user, friendshipId: f.id };
  }).filter(Boolean);

  const pendingReceivedResolved = pendingReceived.map((f: any) => ({
    ...f,
    fromUser: resolveUser(f.fromUserId)
  }));

  const pendingSentResolved = pendingSent.map((f: any) => ({
    ...f,
    toUser: resolveUser(f.toUserId)
  }));

  res.json({ success: true, data: { friends: friendUsers, pendingReceived: pendingReceivedResolved, pendingSent: pendingSentResolved } });
});

app.post("/api/friends/:id/accept", authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const friends = loadFriends();
  const idx = friends.findIndex((f: any) => f.id === req.params.id && f.toUserId === userId && f.status === 'pending');
  if (idx === -1) return res.status(404).json({ success: false, error: "请求不存在。" });
  friends[idx].status = 'accepted';
  saveFriends(friends);
  res.json({ success: true, data: friends[idx] });
});

app.post("/api/friends/:id/reject", authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const friends = loadFriends();
  const idx = friends.findIndex((f: any) => f.id === req.params.id && f.toUserId === userId && f.status === 'pending');
  if (idx === -1) return res.status(404).json({ success: false, error: "请求不存在。" });
  friends[idx].status = 'rejected';
  saveFriends(friends);
  res.json({ success: true, data: friends[idx] });
});

// ─── Memorial Routes (auth required) ───

// IMPORTANT: /sent must come before /:id routes
app.get("/api/memorials/sent", authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const list = loadMemorials();
  const users = loadUsers();
  const sent = list.filter((m: any) => m.fromUserId === userId);
  const enriched = sent.map((m: any) => {
    const toUser = users.find((u: any) => u.id === m.toUserId);
    return { ...m, toUserDisplayName: toUser?.displayName || "未知" };
  });
  res.json({ success: true, data: enriched });
});

// URL paste → parse video → create memorial (processing placeholder)
// TODO: 对接真实视频解析服务，当前返回占位数据
function processVideoUrl(url: string): any {
  return {
    videoInfo: {
      url,
      title: "待解析视频",
      author: "未知作者",
      description: "视频内容待解析",
      coverUrl: "",
      duration: 0,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0
    },
    memorial: null
  };
}

app.post("/api/memorials/from-url", authMiddleware, async (req, res) => {
  const fromUserId = (req as any).userId;
  const { url } = req.body;
  const toUserId = req.body.toUserId || fromUserId;
  if (!url || !url.trim()) {
    return res.status(400).json({ success: false, error: "视频链接不可为空。" });
  }

  const users = loadUsers();
  const fromUser = users.find((u: any) => u.id === fromUserId);
  const senderName = fromUser ? `${fromUser.avatarTitle} ${fromUser.displayName}` : "御前侍卫";

  // Step 1: Call processing function (placeholder)
  const parsed = processVideoUrl(url.trim());

  // Step 2: If external service already returned memorial data, use it; otherwise use Gemini/fallback
  if (parsed.memorial) {
    const item = {
      id: "mem-" + Date.now(),
      title: parsed.memorial.title,
      url: url.trim(),
      rawText: `[URL粘贴] ${url.trim()} — ${parsed.videoInfo.title || ''}`,
      sender: parsed.memorial.sender || senderName,
      category: parsed.memorial.category || "经略阁",
      summary: parsed.memorial.summary || "此折尚待翰林院详审。",
      keywords: parsed.memorial.keywords || [],
      entertainmentRatio: parsed.memorial.entertainmentRatio || 70,
      severityLevel: parsed.memorial.severityLevel || "日常请安",
      status: "pending",
      createdTime: new Date().toISOString(),
      fromUserId,
      toUserId,
      videoInfo: parsed.videoInfo
    };
    const list = loadMemorials();
    list.unshift(item);
    saveJSON(STORE_PATH, list);
    return res.json({ success: true, source: "external", data: item });
  }

  // Step 3: Use AI or fallback analysis with the URL as raw text
  const rawText = `[视频链接] ${url.trim()} ${parsed.videoInfo.title} ${parsed.videoInfo.description}`;

  const prompt = `你是一个皇宫里的翰林院大学士，负责把抖音视频链接对应的内容翻译成奏折。
目前只有视频链接信息：URL="${url.trim()}"
请根据链接特征（如果有标题则参考标题）生成一封幽默古风奏折。
微臣称呼："${senderName}"
请生成结构化JSON，包含以下字段：
{ "title": "折子标题", "sender": "大臣名号", "category": "经略阁|寻乐记|创意坊 三选一", "summary": "古风正文约120字", "keywords": ["标签数组"], "entertainmentRatio": 搞笑指数1-100, "severityLevel": "日常请安|微臣急奏|十万火急|弹劾奏章 四选一" }`;

  const aiResult = await callAI(prompt, { json: true, system: "你是翰林院大学士，只输出合法JSON。" });

  let item: any;
  if (aiResult) {
    try {
      const result = JSON.parse(aiResult);
      item = {
        id: "mem-" + Date.now(), title: result.title, url: url.trim(), rawText,
        sender: result.sender, category: result.category, summary: result.summary,
        keywords: result.keywords, entertainmentRatio: result.entertainmentRatio,
        severityLevel: result.severityLevel, status: "pending",
        createdTime: new Date().toISOString(), fromUserId, toUserId, videoInfo: parsed.videoInfo
      };
    } catch (parseErr) {
      console.error("AI JSON parse failed for URL memorial:", parseErr);
      item = null;
    }
  }
  if (!item) {
    item = fallbackAnalysis(rawText);
    item.sender = senderName;
    item.fromUserId = fromUserId;
    item.toUserId = toUserId;
    item.url = url.trim();
    item.videoInfo = parsed.videoInfo;
  }
  const list = loadMemorials();
  list.unshift(item);
  saveJSON(STORE_PATH, list);
  res.json({ success: true, source: aiResult ? "ai" : "mock", data: item });
});

// Webhook: external video parsing service callback (no auth required)
app.post("/api/webhook/video-parsed", (req, res) => {
  const { memorialId, videoInfo, memorial: memorialData } = req.body;

  if (memorialId) {
    // Update existing memorial with parsed data
    const list = loadMemorials();
    const idx = list.findIndex((m: any) => m.id === memorialId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: "Memorial not found." });
    }
    if (videoInfo) list[idx].videoInfo = videoInfo;
    if (memorialData) {
      if (memorialData.title) list[idx].title = memorialData.title;
      if (memorialData.summary) list[idx].summary = memorialData.summary;
      if (memorialData.category) list[idx].category = memorialData.category;
      if (memorialData.keywords) list[idx].keywords = memorialData.keywords;
      if (memorialData.entertainmentRatio) list[idx].entertainmentRatio = memorialData.entertainmentRatio;
      if (memorialData.severityLevel) list[idx].severityLevel = memorialData.severityLevel;
      if (memorialData.sender) list[idx].sender = memorialData.sender;
    }
    saveJSON(STORE_PATH, list);
    return res.json({ success: true, action: "updated", data: list[idx] });
  }

  // Create brand new memorial from webhook payload
  if (!memorialData || !videoInfo) {
    return res.status(400).json({ success: false, error: "Must provide videoInfo and memorial fields, or memorialId for update." });
  }
  const item = {
    id: "mem-wh-" + Date.now(),
    title: memorialData.title || "外部呈递奏折",
    url: videoInfo.url || "",
    rawText: `[Webhook] ${videoInfo.title || ''} — ${videoInfo.description || ''}`,
    sender: memorialData.sender || "外部驿站",
    category: memorialData.category || "经略阁",
    summary: memorialData.summary || "此折由外部驿站呈递，尚待详审。",
    keywords: memorialData.keywords || [],
    entertainmentRatio: memorialData.entertainmentRatio || 70,
    severityLevel: memorialData.severityLevel || "日常请安",
    status: "pending",
    createdTime: new Date().toISOString(),
    fromUserId: req.body.fromUserId || null,
    toUserId: req.body.toUserId || null,
    videoInfo
  };
  const list = loadMemorials();
  list.unshift(item);
  saveJSON(STORE_PATH, list);
  res.json({ success: true, action: "created", data: item });
});

app.get("/api/memorials", authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const list = loadMemorials();
  const users = loadUsers();
  const filtered = list.filter((m: any) => m.toUserId === userId);
  const enriched = filtered.map((m: any) => {
    const fromUser = users.find((u: any) => u.id === m.fromUserId);
    return { ...m, fromUserDisplayName: fromUser?.displayName || m.sender };
  });
  res.json({ success: true, data: enriched });
});

app.post("/api/memorials", authMiddleware, async (req, res) => {
  const fromUserId = (req as any).userId;
  const { rawText, customSender } = req.body;
  const toUserId = req.body.toUserId || fromUserId;
  if (!rawText || rawText.trim() === "") {
    return res.status(400).json({ success: false, error: "奏章原文不可为空。" });
  }

  const users = loadUsers();
  const fromUser = users.find((u: any) => u.id === fromUserId);
  const senderName = customSender || (fromUser ? `${fromUser.avatarTitle} ${fromUser.displayName}` : "御前侍卫");

  const prompt = `你是一个皇宫里的翰林院大学士，负责把皇帝的朋友/大臣发过来的抖音搞笑/日常视频分享文案翻译并整理成一封呈递给皇帝的"奏章折子"。
将下方输入的视频文本进行深入解读并分析，归档分类在三个内容分类之一，写成一封幽默、极其搞笑却又保持皇家古物格调的"奏折概要"。

分类准则：
- 经略阁: 知识科普、实用窍门、教程、技能学习、深度分享、生活妙招等。
- 寻乐记: 沙雕爆笑、神仙打架、猫狗宠物整活、大型翻车、惊天大搞笑、无厘头整蛊或幽默奇葩事。
- 创意坊: 奇思妙想的发明、手工达人神奇改造、DIY、程序员自制好玩产品。

输入内容: "${rawText}"
默认微臣称呼："${senderName}"

生成JSON: { "title": "折子标题4-10字", "sender": "幽默古代大臣名称", "category": "经略阁|寻乐记|创意坊", "summary": "半文言半幽默奏本内容约120字", "keywords": ["标签不超过4个"], "entertainmentRatio": 搞笑程度1-100, "severityLevel": "日常请安|微臣急奏|十万火急|弹劾奏章" }`;

  const aiResult = await callAI(prompt, { json: true, system: "你是翰林院大学士，只输出合法JSON，不要Markdown包裹。" });

  let item: any;
  if (aiResult) {
    try {
      const parsed = JSON.parse(aiResult);
      item = {
        id: "mem-" + Date.now(), title: parsed.title, url: cleanUrl(rawText), rawText,
        sender: parsed.sender, category: parsed.category, summary: parsed.summary,
        keywords: parsed.keywords, entertainmentRatio: parsed.entertainmentRatio,
        severityLevel: parsed.severityLevel, status: "pending",
        createdTime: new Date().toISOString(), fromUserId, toUserId
      };
    } catch (parseErr) {
      console.error("AI JSON parse failed for memorial:", parseErr);
      item = null;
    }
  }
  if (!item) {
    item = fallbackAnalysis(rawText);
    item.sender = senderName;
    item.fromUserId = fromUserId;
    item.toUserId = toUserId;
  }
  const list = loadMemorials();
  list.unshift(item);
  saveJSON(STORE_PATH, list);
  res.json({ success: true, source: aiResult ? "ai" : "mock", data: item });
});

app.post("/api/generate-comment", authMiddleware, async (req, res) => {
  const { title, category, sender, tone } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: "折子信息不足，无法批文。" });
  }

  const toneDescription: Record<string, string> = {
    pleased: "龙颜大悦，十分惊喜，觉得此文是国之祥瑞，决定同意",
    angry: "勃然大怒，龙颜震怒，觉得荒谬作死，严厉弹劾",
    laugh: "笑不活了，龙吟哈哈大笑，表示生平未见此等离谱人才",
    reward: "龙心大快，准奏起行，并决定给拍摄作者大肆打赏",
    held: "留中不发，持怀疑保留态度"
  };

  const prompt = `你现在是至高无上的'大华恶搞朝代'当朝极幽默极毒舌也极接地气的万岁爷（皇帝陛下）。你要对大臣刚刚呈递来的奏章做出"御笔朱批（批阅评语）"！

呈递的奏折背景：
- 标题: "${title}"
- 呈递大臣: "${sender}"
- 部门: "${category}"

万岁爷今天此时的情绪状态（批奏语气）: "${toneDescription[tone] || '龙颜甚慰'}"

要求：
1. 必须使用古风皇家语气，以"朕"自称。
2. 语言必须既好笑有梗，又有一种封建帝王的无厘头威严。
3. 篇幅80至130字。
4. 结语要像真正的圣旨批词，比如"钦此！"

直接输出陛下所写的批语，不需要任何多余的前缀和Markdown。`;

  const aiComment = await callAI(prompt);
  const comment = aiComment || getFallbackComment(title, category || '吏部', tone || 'pleased');
  res.json({ success: true, source: aiComment ? "ai" : "mock", comment });
});

app.post("/api/memorials/:id/approve", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status, imperialComment } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: "必需传入批阅决断状态(status)" });
  }

  const list = loadMemorials();
  const index = list.findIndex((m: any) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "未找到该御前折子。" });
  }

  list[index].status = status;
  list[index].imperialComment = imperialComment || "朕已阅，退下。";
  list[index].approvedTime = new Date().toISOString();

  saveJSON(STORE_PATH, list);
  res.json({ success: true, data: list[index] });
});

app.post("/api/memorials/reset", authMiddleware, (req, res) => {
  const userId = (req as any).userId;
  const memorials = loadMemorials();
  const kept = memorials.filter((m: any) => m.toUserId !== userId);
  const userSeeds = SEED_MEMORIALS.map((seed, i) => ({
    ...seed,
    id: `seed-${userId}-${i + 1}-${Date.now()}`,
    toUserId: userId,
    fromUserId: null,
    createdTime: new Date(Date.now() - 3600000 * (5 - i)).toISOString()
  }));
  const updated = [...userSeeds, ...kept];
  saveJSON(STORE_PATH, updated);
  res.json({ success: true, data: userSeeds });
});

app.delete("/api/memorials/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const list = loadMemorials();
  const filtered = list.filter((m: any) => m.id !== id);
  saveJSON(STORE_PATH, filtered);
  res.json({ success: true });
});

app.get("/api/briefing", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const allList = loadMemorials();
  const list = allList.filter((m: any) => m.toUserId === userId);

  if (list.length === 0) {
    const report = getFallbackBriefing(list);
    return res.json({ success: true, source: "mock", data: report });
  }

  const briefTitlesList = list.map((m: any) => `- [${m.category}] ${m.title} (呈递者: ${m.sender}, 严重度: ${m.severityLevel}, 搞笑分: ${m.entertainmentRatio}, 状态: ${m.status})`).join('\n');

  const prompt = `你现在是当朝备受倚重、饱读诗书的内阁首辅大学士。在一天结束之际，你必须要给日理万机的皇帝陛下呈上一份【内阁御书房整顿逗笑朝纲简报】。

今日呈进的搞笑折子名录：
${briefTitlesList}

请生成如下结构的合法JSON：
{ "overallHealth": "用八个字总结今日搞笑江山的状态", "imperialReport": "内阁大学士上疏正文，约150-180字" }`;

  const aiResult = await callAI(prompt, { json: true, system: "你是内阁首辅大学士，只输出合法JSON。" });

  const stats = MINISTRIES.map(cat => {
    const sublist = list.filter((m: any) => m.category === cat);
    const count = sublist.length;
    const avg = count ? Math.round(sublist.reduce((sum: number, m: any) => sum + m.entertainmentRatio, 0) / count) : 0;
    return { category: cat, count, avgEntertainment: avg };
  });
  const senders = Array.from(new Set(list.map((m: any) => m.sender.split(' ')[0])));

  let overallHealth: string;
  let imperialReport: string;
  let source = "mock";

  if (aiResult) {
    try {
      const parsed = JSON.parse(aiResult);
      overallHealth = parsed.overallHealth;
      imperialReport = parsed.imperialReport;
      source = "ai";
    } catch {
      const fb = getFallbackBriefing(list);
      overallHealth = fb.overallHealth;
      imperialReport = fb.imperialReport;
    }
  } else {
    const fb = getFallbackBriefing(list);
    overallHealth = fb.overallHealth;
    imperialReport = fb.imperialReport;
  }

  res.json({
    success: true, source, data: {
      id: "brief-" + Date.now(),
      date: new Date().toISOString().split('T')[0],
      overallHealth, imperialReport,
      categoryStatistics: stats,
      activeSenders: senders.slice(0, 5)
    }
  });
});

// ─── User Profile (AI persona) ───

app.get("/api/profile", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const users = loadUsers();
  const user = users.find((u: any) => u.id === userId);
  if (!user) return res.status(404).json({ success: false, error: "用户不存在" });

  const memorials = loadMemorials().filter((m: any) => m.toUserId === userId);
  const reviewed = memorials.filter((m: any) => m.status !== 'pending');
  const approved = reviewed.filter((m: any) => m.status === 'approved');
  const rejected = reviewed.filter((m: any) => m.status === 'rejected');
  const held = reviewed.filter((m: any) => m.status === 'held');

  const totalReceived = memorials.length;
  const totalReviewed = reviewed.length;
  const approveRate = totalReviewed ? Math.round(approved.length / totalReviewed * 100) : 0;
  const rejectRate = totalReviewed ? Math.round(rejected.length / totalReviewed * 100) : 0;
  const holdRate = totalReviewed ? Math.round(held.length / totalReviewed * 100) : 0;

  const catCounts: Record<string, number> = {};
  memorials.forEach((m: any) => { catCounts[m.category] = (catCounts[m.category] || 0) + 1; });
  const favCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "未知";
  const avgEntertainment = memorials.length
    ? Math.round(memorials.reduce((s: number, m: any) => s + (m.entertainmentRatio || 0), 0) / memorials.length)
    : 0;

  const stats = { totalReceived, totalReviewed, approveRate, rejectRate, holdRate, favCategory, avgEntertainment };

  const sampleComments = reviewed
    .filter((m: any) => m.imperialComment)
    .slice(0, 5)
    .map((m: any) => `「${m.imperialComment.slice(0, 40)}」`);

  const prompt = `你是一位宫廷史官，根据以下皇帝的批阅记录，撰写一段古风人物志（100-150字），评价其执政风格。

皇帝信息：${user.avatarTitle} ${user.displayName}
统计：共收折${totalReceived}封，已批${totalReviewed}封，准奏率${approveRate}%，驳回率${rejectRate}%，留中率${holdRate}%
偏好分类：${favCategory}，平均娱乐指数${avgEntertainment}
代表性朱批：${sampleComments.join('；') || '暂无批语'}

直接输出人物志正文，不要标题和Markdown。`;

  let portrait: string;
  const aiResult = await callAI(prompt);
  if (aiResult) {
    portrait = aiResult;
  } else {
    if (approveRate >= 70) {
      portrait = `${user.displayName}帝，性宽厚仁慈，凡呈折者十之七八皆蒙准奏。朝臣称其为"笑面天子"，最好${favCategory}一脉奇闻。虽偶有留中之折，然终以宽宏大量著称于世。`;
    } else if (rejectRate >= 50) {
      portrait = `${user.displayName}帝，御下甚严，弹劾驳回不留情面。朝中大臣见折必战战兢兢。尤重${favCategory}事务，凡不合心意者一律驳回。史官评曰：铁腕帝王，不怒自威。`;
    } else {
      portrait = `${user.displayName}帝，批阅奏章不急不躁，留中观望居多。偏爱${favCategory}之趣闻，对朝政持审慎态度。群臣莫测圣意，唯知万岁爷深谙帝王心术，从不轻易表态。`;
    }
  }

  const { passwordHash: _, ...safeUser } = user;
  res.json({ success: true, data: { user: safeUser, stats, portrait } });
});

// ─── Vite Integration ───

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[皇帝御书房主服务] 启动成功，启奏港口: http://localhost:${PORT}`);
  });
}

startServer();
