/* ============================================================================
 * NodeEventScene.js —— 非战斗节点事件（得偿所愿 / 商店 / 失与得）
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 处理地图上除"战斗"以外的交互节点。第一版把三种都做成"能用"的简单版本，
 * 细节后续再改：
 *   得偿所愿(reward)：从事件库里挑一个，给玩家回复 / 残页 / 藏品。
 *   商店(shop)：消耗残页购买藏品。
 *   失与得(exchange)：用一件藏品交换一件随机藏品。
 *
 * 【结构】
 * 一个场景根据 this.type 分别渲染不同内容；做完后点「完成」回地图。
 * ========================================================================== */

window.Babel = window.Babel || {};

/* 选项序号配色（E3：序号用唯一红） */
function okKeyColor() { return '#8c1d1d'; }

/* 本地打乱数组 */
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

class NodeEventScene extends Phaser.Scene {
  constructor() { super('NodeEvent'); }

  init(data) {
    this.nodeId = data.nodeId;
    this.node = Babel.RunState.getFloorGraph().nodes.find(n => n.id === this.nodeId);
    this.type = this.node.type;
    this.done = false; // 是否已完成本次交互
  }

  create() {
    const C = Babel.COLORS.DARK;
    this.cameras.main.setBackgroundColor(C.bg);
    Babel.UI.atmosphere(this);   // 深色图书馆 + 烛光 + 暗角 + 纸纹
    this.width = this.scale.width;
    this.height = this.scale.height;
    this._sc = Math.max(1, Math.min(this.width / 1280, this.height / 720));   // 与战斗页同一套缩放约定
    Babel.PlayMusic(this);       // 进事件节点继续/恢复 BGM（避免场景切换时音乐断了）

    // 右上角"退出"键 → 回主菜单（下次点「开始探索」即开新局）
    // ★ 必须 setDepth：页眉（editorHeader）是后画的，同层级会把返回键压在下面
    const _s0 = this._sc;
    Babel.UI.button(this, this.width - 76 * _s0, 26 * _s0, 104 * _s0, 32 * _s0, '退出',
      () => { Babel.UI.confirmQuit(this, () => { Babel.PlayMusic(this, Babel.LayerBGM()); this.scene.start('Start'); }); },
      { font: Babel.FONTS.body, size: Math.round(13 * _s0) + 'px', fill: 0xffffff, stroke: Babel.COLORS.LINE_N, lineW: 1, hover: 0xfafafa, color: '#111111', marker: false }).setDepth(80);

    const nt = Babel.NODE_TYPES[this.type];
    Babel.UI.text(this, this.width / 2, 60 * _s0, nt.sceneTitle || nt.desc,   // ★ 场景标题：商店等节点可单独指定（地图仍读 desc，不受影响）
      { font: Babel.FONTS.heading, size: Math.round(30 * _s0) + 'px', color: '#24252a', origin: [0.5, 0.5] });
    this.statusText = Babel.UI.text(this, this.width / 2, 100 * _s0, '目标生命 ' + Babel.RunState.targetHP + '   残页 ' + Babel.RunState.currency,
      { size: Math.round(16 * _s0) + 'px', color: C.muted, origin: [0.5, 0.5] });

    // 按类型渲染
    if (this.type === 'reward') this._renderReward();
    else if (this.type === 'shop') this._renderShop();
    else if (this.type === 'exchange') this._renderExchange();
    else if (this.type === 'encounter') this._renderEncounter();   // ★ 不期而遇（占位：领一个藏品就走）

    // 底部「完成」按钮
    // ★ 「完成」放右下角（与右上「返回」对称）：不再占屏幕底部中央，商店三阶段的排版不被它挤压
    this.backBtn = Babel.UI.button(this, this.width - 104 * _s0, this.height - 54 * _s0, 168 * _s0, 46 * _s0, '完成',
      () => { this._completePendingExchange(); this._leave(); },
      { color: C.muted, size: Math.round(18 * _s0) + 'px' });
    // ★ 失与得：流程全部走完（结算屏）才给「完成」→ 建好就先藏起来
    //   （必须写在这里 ✗ 不能写在 _renderExchange 里 —— 那时这个按钮还没被创建 ✗）
    // ★ 失与得 / 得偿所愿：都要走完自己的流程才给「完成」（必须写在这里 ✗ 那时按钮才刚创建 ✓）
    if ((this.type === 'exchange' || this.type === 'reward') && this.backBtn) this.backBtn.setVisible(false);
    // ★★ 不期而遇·辨析卡（2026-09-25）：**答题期间不给走** ✓ 答完（收下奖励）才给 ✓
    //   ★ 必须写在 **这里**（创建 backBtn 的那一刻 ✗ 写在 _renderEncounter 里会因它尚未创建而静默失效 ✓）
    //   ★ 题库为空时会退回旧占位 → 那条分支自己会调 _encSettle() 把按钮放出来 ✓ 不会卡死 ✓
    if (this.type === 'encounter' && this.backBtn) this.backBtn.setVisible(false);
    // ★★ 失与得：**一件藏品都没有** → 本节点无流程可走 → **必须立刻给「完成」**，否则玩家被卡死 ✗
    // ★ 必须写在 **这里**（创建 backBtn 的那一刻）✗ 写在 _renderExchange 里会因它尚未创建而静默失效 ✗（skill §20.3 / §31.5）
    //   判断口径与渲染一致：过滤掉 FindCollectible 查不到的废 id ✓
    if (this.type === 'exchange' && this.backBtn) {
      const _own = (Babel.RunState.ownedCollectibles || []).map(function (id) { return Babel.FindCollectible(id); }).filter(Boolean);
      if (!_own.length) this.backBtn.setVisible(true);
    }

    // 窗口/画布尺寸变化 → 重排
    Babel.UI.autoResize(this);
  }

  /* 完成：标记节点已走过，回地图（始终允许离开；温汤匙：离开+1残页） */
  _leave() {
    if (Babel.TotalEffect('leaveCurrency') > 0) Babel.RunState.addCurrency(Babel.TotalEffect('leaveCurrency')); // #20 温汤匙
    Babel.RunState.completeNode(this.nodeId);
    this.scene.start('Map');
  }

  /* ================= 得偿所愿 · 拆句许愿（2026-09-18 重做） =================
   * 玩法：许愿（小/中/大三档 ✓ 愿望越大、句子越绕）→ 判断**划线部分在句中作什么成分**
   *      （固定 7 个标签 ✓ 从句也落进这 7 个里 ✗ 不引入从句标签）→ 判对全额兑现 ✓ 判错降一档 ✓
   * 数据：Babel.SENTENCE_ROLES { easy, mid, hard }（最小可用集 12 条 ✓ 扩量看 _sentence/_BRIEF.md）
   * ★★ 清理方式：**自带对象登记表**（_wishAdd / _wishWipe）——
   *    不再复用商店的 _shopClear ✗（那是"清到基线"的机制、跨节点复用两次都残留 ✗）
   *    本节点每次新建对象都登记 ✓ 翻屏时精确销毁 ✓ 不依赖任何基线 ✓
   * ⚠️「完成」按钮的隐藏写在 create() 里 ✗（那时它才刚创建 ✓ 见 skill §20.3） */
  _wishAdd(o) { (this._wishObjs = this._wishObjs || []).push(o); return o; }
  _wishWipe() {
    (this._wishObjs || []).forEach(function (o) { try { o.destroy(); } catch (e) {} });
    this._wishObjs = [];
  }
  /* ★ 画一句带「“它”」的话：复用失与得的 _exSay（“它”红加粗 ✓）并把新建的对象登记进清理表 ✓ */
  _wishSay(cx, y, size, pre, post, mid, color) {
    const before = this.children.list.length;
    this._exSay(cx, y, size, pre, post, mid, color);
    for (let i = before; i < this.children.list.length; i++) this._wishAdd(this.children.list[i]);
  }

  /* ① 许愿屏 */
  _renderReward() {
    this._wishWipe();
    this._wishPhase = 'wish';
    this._wishQ = null;
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const P = (x) => Math.round(x * s) + 'px';
    const T = (x, y, txt, o) => this._wishAdd(Babel.UI.text(this, x, y, txt, o));
    const R = (x, y, w, h, c) => this._wishAdd(this.add.rectangle(x, y, w, h, c));

    // ★「它」带双引号 + 加粗 + 变红（用户要求 ✓ 与失与得同款处理 ✓）
    this._wishSay(cx, cy - 176 * s, 26, '你想要什么，说出来 —— 用', '的语言。', '“它”', '#111111');

    const TIERS = [
      { key: 'easy', wish: '+1 生命上限（并回复 1）', cost: '判断一个简单句的成分' },
      { key: 'mid', wish: '+4 残页', cost: '判断一个主从复合句的成分' },
      { key: 'hard', wish: '一件随机藏品', cost: '判断一个复杂长句的成分' },
    ];
    const lh = Math.max(1, Math.round(1 * s));
    TIERS.forEach((t, i) => {
      const y = cy - 60 * s + i * 116 * s;
      T(cx, y - 24 * s, t.wish,
        { font: Babel.FONTS.body, size: P(24), color: '#111111', origin: [0.5, 0.5], bold: true });
      T(cx, y + 6 * s, t.cost, { size: P(14), color: '#9b9fa5', origin: [0.5, 0.5] });
      const line = R(cx, y + 36 * s, 460 * s, lh, Babel.COLORS.LINE_N);
      const hit = this._wishAdd(this.add.rectangle(cx, y, 460 * s, 100 * s, 0x000000, 0)
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerover', () => line.setFillStyle(0xe2231a));
      hit.on('pointerout', () => line.setFillStyle(Babel.COLORS.LINE_N));
      hit.on('pointerup', () => {
        if (this._wishPhase !== 'wish') return;
        this._wishPhase = 'quiz';
        this._wishQuiz(t.key);
      });
    });
  }

  /* ② 拆句屏 */
  _wishQuiz(tier) {
    this._wishWipe();
    this._wishPhase = 'quiz';
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const P = (x) => Math.round(x * s) + 'px';
    const T = (x, y, txt, o) => this._wishAdd(Babel.UI.text(this, x, y, txt, o));
    const R = (x, y, w, h, c) => this._wishAdd(this.add.rectangle(x, y, w, h, c));

    const bank = (Babel.SENTENCE_ROLES || {})[tier] || [];
    if (!bank.length) { this._wishSettle(tier, true, null); return; }
    let q = null;
    for (let k = 0; k < 12; k++) {
      const c = bank[Math.floor(Math.random() * bank.length)];
      if (c && c.sentence !== this._wishLast) { q = c; break; }
    }
    if (!q) q = bank[0];
    this._wishLast = q.sentence;
    this._wishQ = q;

    /* 句子：**逐词**渲染 + 自己折行（这样跨行划线才做得出来 ✗ 三段文字方案一折行就废 ✓）
       · 每个单词一个 Text（origin [0,0.5]）✓ 先全部建好、量出各自宽度 ✓
       · 按 1180×s 的宽度上限折行 ✓ 每行再按实测总宽整体居中 ✓
       · 划线：**逐行**画红线 —— 取该行上被划到的词的 x 起止 ✓（长句跨行时每行各一段 ✓ 视觉连续 ✓）
       · 位置：块顶 cy−230×s（用户要求"句子放上面"✓）字号 34×s ✓ 行高 1.5 倍 ✓ */
    const words = q.sentence.split(' ');
    const SIZE = 34;
    const LH = SIZE * 1.5;                             // 行高
    const MAXW = 1180 * s;                             // 行宽上限（屏宽 1280 ✓ 两侧留 50）
    const isMark = (i) => (i >= q.markStart && i <= q.markEnd);
    const wObjs = words.map((t, i) => T(0, -9999, t, {
      font: Babel.FONTS.mixed, size: P(SIZE), color: '#111111', origin: [0, 0.5], bold: isMark(i),
    }));
    const spTmp = Babel.UI.text(this, 0, -9999, ' ', { font: Babel.FONTS.mixed, size: P(SIZE) });
    const SP = (spTmp.width || SIZE * 0.3);            // 空格宽度（英文必须自己补 ✗ 中文才不用 ✓）
    spTmp.destroy();
    /* 折行：逐词累加宽度 ✓ 超上限就换行 ✓ */
    const lines = [[]];
    let curW = 0;
    words.forEach((t, i) => {
      const wid = wObjs[i].width;
      const last = lines[lines.length - 1];
      const add = (last.length ? SP : 0) + wid;
      if (last.length && curW + add > MAXW) { lines.push([]); curW = 0; }
      const ln = lines[lines.length - 1];
      ln.push({ i: i, w: wid });
      curW += (ln.length > 1 ? SP : 0) + wid;
    });
    /* 排布 + 逐行画红线 */
    // ★ 句子块**在"顶栏之下、题干之上"这段里垂直居中**（用户：放中间 ✓）
    //   这段可用区 ≈ cy−245×s（=115，标题/状态行之下）到 cy−65×s（=295，题干上沿）→ 中点 cy−155×s（=205）
    //   块高＝行数×行高 → 顶 = 中点 − 块高/2（1 行落 179 ✓ 2 行落 154 ✓ 3 行落 128 ✓ 无论几行都居中 ✓）
    const topY = (cy - 155 * s) - (lines.length * LH * s) / 2;
    lines.forEach((ln, li) => {
      if (!ln.length) return;
      const y = topY + li * LH * s;
      let total = 0;
      ln.forEach((it, k) => { total += (k ? SP : 0) + it.w; });
      let x = cx - total / 2;
      const pos = {};
      ln.forEach((it, k) => {
        const o = wObjs[it.i];
        o.setPosition(x, y);
        pos[it.i] = x;
        x += it.w + SP;
      });
      const mk = ln.filter((it) => isMark(it.i));
      if (mk.length) {
        const x1 = pos[mk[0].i];
        const lastMk = mk[mk.length - 1];
        const x2 = pos[lastMk.i] + lastMk.w;
        R((x1 + x2) / 2, y + SIZE * 0.62 * s, x2 - x1, Math.max(2, Math.round(2 * s)), 0xe2231a);
      }
    });

    // ★ 题干：放在"句子与选项之间"的正中空隙（原写 cy-18×s 会落到选项分隔线下方 → 挤进第一行 ✗）
    //   19×s + body 字体（Novecento 没有中文字形 ✗ 之前又细又怪）+ #3f4145（够深但不抢选项）
    T(cx, cy - 55 * s, '划线部分在句中作什么成分？',
      { font: Babel.FONTS.body, size: P(19), color: '#3f4145', origin: [0.5, 0.5] });

    /* 四个选项：从固定 7 个标签里抽 ✓ 中英并列 ✓ 自绘分隔线 + 悬停变红 ✓ */
    const others = Babel.ROLE_LABELS.filter((l) => l.zh !== q.role);
    const picks = shuffleArr(others.slice()).slice(0, 3);
    const opts = shuffleArr([{ zh: q.role, en: q.roleEn }].concat(picks));
    const oy0 = cy;
    const lh = Math.max(1, Math.round(1 * s));
    const seps = [];
    for (let k = 0; k <= opts.length; k++) {
      seps.push(R(cx, oy0 - 38 * s + k * 76 * s, 440 * s, lh, Babel.COLORS.LINE_N).setDepth(5));
    }
    opts.forEach((o, i) => {
      const y = oy0 + i * 76 * s;
      T(cx, y, o.zh + '　' + o.en,
        { font: Babel.FONTS.body, size: P(26), color: '#111111', origin: [0.5, 0.5] });
      const hit = this._wishAdd(this.add.rectangle(cx, y, 440 * s, 76 * s, 0x000000, 0)
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerover', () => seps[i + 1].setFillStyle(0xe2231a));
      hit.on('pointerout', () => seps[i + 1].setFillStyle(Babel.COLORS.LINE_N));
      hit.on('pointerup', () => {
        if (this._wishPhase !== 'quiz') return;
        this._wishPhase = 'done';
        this._wishSettle(tier, o.zh === q.role, o);
      });
    });
  }

  /* ③ 兑现屏 */
  _wishSettle(tier, ok, chosen) {
    this._wishWipe();
    this._wishPhase = 'done';
    if (this.backBtn) this.backBtn.setVisible(true);
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const P = (x) => Math.round(x * s) + 'px';
    const T = (x, y, txt, o) => this._wishAdd(Babel.UI.text(this, x, y, txt, o));
    const DOWN = { hard: 'mid', mid: 'easy', easy: null };
    const at = ok ? tier : DOWN[tier];
    let txt = '';
    if (at === 'easy') { Babel.RunState.maxHP += 1; Babel.RunState.heal(1); txt = '+1 生命上限（回复 1）'; }
    else if (at === 'mid') { Babel.RunState.addCurrency(4); txt = '+4 残页'; }
    else if (at === 'hard') {
      const c = Babel.PickCollectible();
      if (c) { Babel.GrantCollectible(c); txt = '藏品『' + c.name + '』'; }
      else { Babel.RunState.addCurrency(4); txt = '+4 残页'; }
    }
    this._refreshStatus();
    this.done = true;

    T(cx, cy - 70 * s, at ? ('你得到了 ' + txt) : '你什么也没有得到',
      { font: Babel.FONTS.body, size: P(30), color: at ? '#e2231a' : '#9b9fa5', origin: [0.5, 0.5], bold: true });
    if (this._wishQ) {
      T(cx, cy + 2 * s, '正确答案：' + this._wishQ.role + '　' + this._wishQ.roleEn,
        { size: P(16), color: '#6f6f6f', origin: [0.5, 0.5] });
      if (!ok && chosen) {
        T(cx, cy + 36 * s, '你判成了 ' + chosen.zh, { size: P(14), color: '#9b9fa5', origin: [0.5, 0.5] });
      }
    }
    /* "它"的一句叙述（“它”红加粗 ✓ 走 _wishSay → 自动登记 ✓ 翻屏不会残留 ✓） */
    if (ok) this._wishSay(cx, cy + 108 * s, 17, '你把这句话拆开了。', '看懂了 —— 愿望成了。');
    else if (at) this._wishSay(cx, cy + 108 * s, 17, '你拆错了。', '只肯给你一半。');
    else this._wishSay(cx, cy + 108 * s, 17, '', '把东西收了回去。你没损失什么。');
  }

  /* ================= 不期而遇 · 辨析卡（2026-09-25 用户定稿实装） =================
   * 用户口径：
   *   "答对给一个随机池子里的藏品，答错给（+2 残页 +2 临时生命）"
   *   "这种题目建立300个形成不期而遇题库"  → `Babel.ENCOUNTER_QUIZ`（306 条 ✓）
   *   "记住每个词都要讲解（错在哪对在哪）"  → 每题四个选项**逐条**讲解 ✓
   *
   * 流程（三屏，同一场景内切换 ✓）：
   *   ① 出题：左＝题面大字＋释义；右＝四个选项（**只给英文** ✓ 与失与得一致 ✓）
   *   ② 揭晓：正确项标 ✓、选错的标 ✗；下方**逐条**列出四个选项的讲解
   *   ③ 结算：报奖励（藏品 / 残页＋临时生命）→ 常驻「完成」可离开
   *
   * ★ 出题：从 `Babel.ENCOUNTER_QUIZ`（306 条）随机抽 ✓
   *   ★★ 用户 2026-09-25："每局游戏都不能重复" → 一局内按 `en` 去重、抽空也不重置 ✓
   *   ★★ 用户 2026-09-25："每次遇到改时间都是随机抽一题" → 每次进本节点现抽 ✓
   *   ★★ 用户 2026-09-25："不要错题，做起来太复杂" → **不做错题本** ✗ 纯随机抽题 ✓
   * ★ 奖励（2026-09-26 用户纠正口径）：
   *     ★★★ 用户原话："不期而遇就是答对给藏品，答错给残页的，你自己理解错了"
   *     · **答对 → 一件藏品** ✓（每次答对都给 ✗ **没有**"一局只一件"的限制 ✗）
   *       → 走「收下」那一步发放（`_encReceive` ✓ 玩家能看到藏品描述 ✓）
   *       → 池子抽空（69 件全拿过）时才兜底给 +4 残页 ✓
   *     · **答错 → 残页 ＋ 临时生命**（+2 / +2 ✓ 临时生命不可囤积 → 故意答错滚不出雪球 ✓）
   *     · **跳过 → 什么也没有** ✓
   *   ★★ 我此前的错解（已废 ✗）：`RunState.encDone` 那套"一局只给一件、之后改给残页"
   *     是**我自己加的防刷限制** ✗ 用户从没提过 ✓ 已删除该分支 ✓
   *     （`RunState.encDone` 字段本身保留 ✗ —— `_encReceive` 里还在置位 ✓ 只是不再拦奖励 ✓）
   * ★ 清理：自带对象登记表（`_encAdd` / `_encWipe` ✓ 与得偿所愿同一套路 ✓）
   *   ⚠️「完成」按钮的隐藏写在 create() 里 ✗（那时它才刚创建 ✓） */
  _encAdd(o) { (this._encObjs = this._encObjs || []).push(o); return o; }
  _encWipe() {
    (this._encObjs || []).forEach(function (o) { try { o.destroy(); } catch (e) {} });
    this._encObjs = [];
    this._encOpts = [];
  }
  /* 画一段文字并登记清理 ✓ */
  _encText(x, y, txt, o) { return this._encAdd(Babel.UI.text(this, x, y, txt, o)); }
  /* ★★ 带「它」的叙述： **“它” 加粗 + 变红** ✓（用户要求 ✓ 与失与得／得偿所愿同款处理 ✓）
   *   复用 `_exSay`（三段拼接 + 居中 ✓）再把新建对象登记进本节点的清理表 ✓
   *   ★ 用法：`_encSay(cx, y, 18, '前段', '后段', '“它”', '#111111')` */
  _encSay(cx, y, size, pre, post, mid, color) {
    const before = this.children.list.length;
    this._exSay(cx, y, size, pre, post, mid, color);
    for (let i = before; i < this.children.list.length; i++) this._encAdd(this.children.list[i]);
  }
  /* 画一个矩形并登记清理 ✓ */
  _encRect(x, y, w, h, color, alpha) {
    return this._encAdd(this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0.5, 0.5));
  }
  /* ★★ 居中画一段文字（**位置给中心点 + origin 设 (0.5,0.5)** ✓）
   *   踩过的坑：`Babel.UI.text` 只认 `origin:[0,0.5]` 左对齐 ✗ 长题面顶出面板右边 ✓
   *   → 自己把 origin 改成 (0.5,0.5) ✓ 位置直接给中心点 ✓ 文本变了也不会偏 ✓
   *   （比"按实测宽度反算左边界"稳 ✗ 那个在宽度变化后会失准 ✓） */
  _encTextC(cx, y, txt, o) {
    const oo = Object.assign({}, o || {}, { origin: [0.5, 0.5] });
    const obj = this._encText(cx, y, txt, oo);
    const w = (obj && obj.width) || 0;
    return { obj: obj, w: w };
  }
  /* ★★ 字号自适应 ＋ 超长自动折行 ✓
   *   踩过的坑：`either ... or` 在 56px 下实测就顶出了面板 ✓（回退字体比 Space Grotesk 宽 ✓
   *   只有**画出来量**才准 ✗ 不能估算 ✓）
   *   ① 先量宽度 → 超了就按比例缩字号（下限 24px ✓ 再小看不清 ✓）
   *   ② 缩到下限还装不下 → **打开折行** ✓（`setWordWrapWidth` ✓ Phaser 会自动换行 ✓）
   *   ③ origin 已是 (0.5,0.5) → 折行后整块仍以 cx 居中 ✓ */
  _encTextFit(cx, y, txt, o, maxW, size) {
    const r = this._encTextC(cx, y, txt, o);
    const w0 = r.w;
    if (w0 > maxW && w0 > 0) {
      const sc0 = (typeof this._sc === 'number' && this._sc > 0) ? this._sc : 1;
      const ns = Math.max(24, Math.floor(size * maxW / w0));
      try { r.obj.setFontSize((ns * sc0) + 'px'); } catch (e) {}
      const w1 = (r.obj && r.obj.width) || 0;
      if (w1 > maxW) {                       // 缩到下限还不行 → 折行 ✓
        try { r.obj.setWordWrapWidth(maxW, true); } catch (e) {}
      }
    }
    return r.obj;
  }

  /* 抽一道辨析题（从 306 题库里**随机**抽 ✓）
   * ★★ 2026-09-25 用户定：
   *   "每局游戏都不能重复"        → `RunState.usedSyn` 一局内**只增不减** ✗ 抽空也**不重置** ✓
   *   "每次遇到改时间都是随机抽一题" → 每次进本节点都是新场景实例 → 每次现抽 ✓（不复用上一次那题 ✓）
   * ★ 抽空时返回 `null` → `_renderEncounter` 退回旧占位（领一件藏品就走 ✓ 不让节点变空/卡死 ✓）
   *   （一局最多遇到 ~5 次遭遇 ✗ 306 条根本抽不空 ✓ 这条只是兜底 ✓）
   * ★ 2026-09-25 用户："不要错题，做起来太复杂" → **不做错题本** ✗ 纯随机抽题 ✓ */
  _encPick() {
    const bank = Babel.ENCOUNTER_QUIZ || [];
    if (!bank.length) return null;
    const RS = Babel.RunState;
    const used = RS.usedSyn || (RS.usedSyn = []);
    const pool = bank.filter(function (x) { return used.indexOf(x.en) < 0; });
    if (!pool.length) return null;                    // ★ 抽空 → 不重置 ✓ 交给兜底分支 ✓
    const q = pool[Math.floor(Math.random() * pool.length)];
    if (used.indexOf(q.en) < 0) used.push(q.en);
    return q;
  }

  _renderEncounter() {
    const A = this._shopArea();
    const s = A.s, cx = A.cx;
    const P = (x) => Math.round(x * s) + 'px';
    const q = this._encPick();

    this._encPhase = 'quiz';
    this._encQ = q;
    this._encPicked = -1;

    // 题库空了 → 退回旧占位（领一件藏品就走 ✓ 不让节点变空 ✓）
    if (!q) {
      const pool = Babel.AvailableCollectibles();
      const c = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      this._encSay(cx, A.msgY, 17, '有什么东西在你脚边停住了 —— ', '等了一会儿，没有走。',
        '“它”', '#111111');
      if (!c) {
        this._encText(cx, A.mid, '（它空着手，什么也没留下）',
          { font: Babel.FONTS.body, size: P(18), color: '#9b9fa5', origin: [0.5, 0.5] });
        this._encAdd(Babel.UI.button(this, cx, A.mid + 70 * s, 200 * s, 50 * s, '离开',
          () => this._finish('你没有停留。'), { color: Babel.COLORS.DARK.muted, size: P(19) }));
        return;
      }
      this.done = true;
      this._encDrawRevealCard(c, A);
      return;
    }

    // ★ 台词由 `_encDrawQuiz` 里画（带红字「它」✓）—— 这里**不要**再 _msg 一条 ✗ 会被 wipe 掉 ✓
    this._encDrawQuiz();
  }

  /* ---- ① 出题屏 ---- */
  _encDrawQuiz() {
    const A = this._shopArea();
    const s = A.s, cx = A.cx;
    const P = (x) => Math.round(x * s) + 'px';
    const q = this._encQ;
    this._encWipe();
    this._encPhase = 'quiz';
    this._encPicked = -1;

    // ★ 台词：**“它” 加粗变红** ✓ 神秘一点 ✓（用户 2026-09-25 要求 ✓）
    this._encSay(cx, A.msgY, 17, '有什么东西停在你面前，没有出声 —— ', '递来一张纸条。',
      '“它”', '#111111');

    const colW = 520 * s, optW = 530 * s, gap = 50 * s;
    const totalW = colW + gap + optW;
    const L = cx - totalW / 2, R = L + colW + gap;
    const top = A.mid - 176 * s;

    // 左：题面（★ 英文与中文**都在面板里居中** ✓ 用户要求；长题面自动缩字号 ✓）
    this._encAdd(Babel.UI.panel(this, L, top, colW, 300 * s, 0xffffff, 0x8b2635, 4));
    const LC = L + colW / 2;                       // 面板水平中心 ✓
    const innerW = colW - 56 * s;                  // 可用内宽（左右各留 28 ✓）
    this._encTextC(LC, top + 24 * s, 'DISCRIMINATION · 辨析',
      { font: Babel.FONTS.display, size: P(11), color: '#8b2635', origin: [0, 0.5] });
    this._encTextFit(LC, top + 100 * s, q.en,
      { font: Babel.FONTS.mixed, size: P(56), color: '#0a0b0d', origin: [0, 0.5] }, innerW, 56 * s);
    this._encTextC(LC, top + 162 * s, q.zh,
      { font: Babel.FONTS.body, size: P(22), color: '#3f4145', origin: [0, 0.5] });
    /* ★ 2026-09-25 用户："这条线没用" → **删掉分隔线** ✗ */
    this._encTextC(LC, top + 224 * s, '选出意思最接近的一个',
      { font: Babel.FONTS.body, size: P(14), color: '#6b6f76', origin: [0, 0.5] });

    // 右：四个选项（题干面板的垂直中心对齐 ✓）
    const oy0 = top + 30 * s;
    this._encOpts = [];
    const self = this;
    q.opts.forEach(function (o, i) {
      const y = oy0 + i * 62 * s;
      const btn = Babel.UI.button(self, R + optW / 2, y + 26 * s, optW, 52 * s, o,
        function () { self._encChoose(i); },
        { size: P(24), font: Babel.FONTS.mixed, color: '#141414' });
      self._encAdd(btn);
      self._encOpts.push(btn);
    });
  }

  /* ---- 点选项 ---- */
  _encChoose(i) {
    if (this._encPhase !== 'quiz') return;
    const q = this._encQ;
    if (!q || i < 0 || i >= q.opts.length) return;
    this._encPicked = i;
    this._encDrawReveal(q.opts[i] === q.syn);
  }

  /* ---- ② 揭晓屏 ---- */
  _encDrawReveal(ok) {
    const A = this._shopArea();
    const s = A.s, cx = A.cx;
    const P = (x) => Math.round(x * s) + 'px';
    const q = this._encQ;
    this._encWipe();
    this._encPhase = 'reveal';

    // ★ 台词：**“它” 加粗变红** ✓
    if (ok) {
      this._encSay(cx, A.msgY, 17, '', '把纸条翻了过来 —— 背面写着为什么。', '“它”', '#111111');
    } else {
      this._encSay(cx, A.msgY, 17, '', '没有把纸条收回去，反而翻过来给你看。', '“它”', '#111111');
    }

    const colW = 520 * s, optW = 530 * s, gap = 50 * s;
    const totalW = colW + gap + optW;
    const L = cx - totalW / 2, R = L + colW + gap;
    const top = A.mid - 176 * s;

    // 左：答案 + 逐条讲解（★ 答案中英**居中** ✓ 长答案缩字号 ✓）
    this._encAdd(Babel.UI.panel(this, L, top, colW, 300 * s, 0xffffff, ok ? 0x2f7d3a : 0xc0392b, 4));
    const LC = L + colW / 2;
    const innerW = colW - 56 * s;
    this._encTextC(LC, top + 24 * s, ok ? 'ANSWER · 答对' : 'ANSWER · 答错',
      { font: Babel.FONTS.display, size: P(11), color: ok ? '#2f7d3a' : '#c0392b', origin: [0, 0.5] });
    this._encTextFit(LC, top + 70 * s, q.syn,
      { font: Babel.FONTS.mixed, size: P(40), color: ok ? '#2f7d3a' : '#c0392b', origin: [0, 0.5] }, innerW, 40 * s);
    this._encTextC(LC, top + 110 * s, q.synZh,
      { font: Babel.FONTS.body, size: P(18), color: '#3f4145', origin: [0, 0.5] });
    /* ★ 2026-09-25 用户："这条线没用" → **删掉分隔线** ✗ */
    this._encTextC(LC, top + 148 * s, '四个选项分别为什么对／错 ——',
      { font: Babel.FONTS.body, size: P(14), color: '#0a0b0d', origin: [0, 0.5], bold: true });
    const why = q.why || [];
    for (let k = 0; k < 4; k++) {
      const yy = top + 180 * s + k * 28 * s;
      const right = (k === 0);
      this._encText(L + 28 * s, yy, (right ? '✓ ' : '✗ ') + q.opts[k] + '：',
        { font: Babel.FONTS.mixed, size: P(14), color: right ? '#2f7d3a' : '#c0392b', origin: [0, 0.5] });
      this._encText(L + 148 * s, yy, why[k] || '',
        { font: Babel.FONTS.body, size: P(13), color: '#3f4145', origin: [0, 0.5] });
    }

    // 右：四个选项（标出对错 + 释义）
    const oy0 = top + 30 * s;
    for (let i = 0; i < q.opts.length; i++) {
      const y = oy0 + i * 62 * s;
      const isRight = (i === 0), isPick = (i === this._encPicked);
      const col = isRight ? 0x2f7d3a : (isPick ? 0xc0392b : 0xc9c6bd);
      const bg = isRight ? 0xf3fbec : (isPick ? 0xfff0ef : 0xfffdf9);
      this._encRect(R + optW / 2, y + 26 * s, optW, 52 * s, bg, 1);
      this._encAdd(this.add.rectangle(R + optW / 2, y + 26 * s, optW, 52 * s, col, 0)
        .setStrokeStyle(Math.max(2, Math.round(2 * s)), col, 1));
      this._encText(R + 22 * s, y + 26 * s, q.opts[i],
        { font: Babel.FONTS.mixed, size: P(22), color: isRight ? '#2f7d3a' : (isPick ? '#c0392b' : '#141414'), origin: [0, 0.5] });
      this._encText(R + optW - 70 * s, y + 26 * s, (q.optZh || [])[i] || '',
        { font: Babel.FONTS.body, size: P(14), color: '#6b6f76', origin: [1, 0.5] });
      this._encText(R + optW - 18 * s, y + 26 * s, isRight ? '✓' : (isPick ? '✗' : ''),
        { font: Babel.FONTS.body, size: P(18), color: isRight ? '#2f7d3a' : '#c0392b', origin: [0.5, 0.5] });
    }

    // 下方：两条按钮（答对／答错各不同 ✓）
    const by = top + 340 * s;
    const self = this;
    if (ok) {
      this._encAdd(Babel.UI.button(this, cx + 130 * s, by, 240 * s, 50 * s, '收下', function () {
        self._encRewardCorrect(A);
      }, { size: P(19) }));
    } else {
      this._encAdd(Babel.UI.button(this, cx + 130 * s, by, 240 * s, 50 * s, '收下这些', function () {
        self._encRewardWrong(A);
      }, { size: P(19) }));
    }
  }

  /* ---- ③a 答对 → **一件藏品** ✓（2026-09-26 用户纠正口径）----
   *   ★★★ 用户原话："不期而遇就是答对给藏品，答错给残页的，你自己理解错了"
   *   ★★ 我此前的错解（已废 ✗）：做成了"**一局只给一件**，之后答对改给 +4 残页" ✓
   *     那是**我自己加的防刷限制** ✗ 用户从没要过 ✓
   *     表现就是用户截的那张图：「本局第 2 次答对」＋「+4 残页」✗ 该给藏品 ✓
   *   ★ 正确口径 = **按对错分**：
   *       · **答对 → 藏品**（每次答对都给 ✗ 无上限 ✗）
   *       · **答错 → 残页 ＋ 临时生命**（见 ③b ✓）
   *   ★★ 发放路径复用**现成的** `_encDrawRevealCard(c, A)` ✗ —— 它就是
   *     「藏品卡（稀有度 / 名字 / 效果描述）＋『收下』按钮」那一屏 ✓
   *     点「收下」→ `GrantCollectible` ＋ `encDone=true` ＋ 一行确认 ＋ `_encSettle()` ✓
   *     （原来只在"题库抽空"时走它 ✓ 现在答对是常态路径 ✓ 让奖励**看得见** ✓）
   *   ★ 只有池子抽空（69 件全拿过）才退回 +4 残页 ✓ 那是**兜底**不是规则 ✓ */
  _encRewardCorrect(A) {
    const s = A.s, cx = A.cx;
    const P = (x) => Math.round(x * s) + 'px';
    const RS = Babel.RunState;
    RS.encRight = (RS.encRight || 0) + 1;

    const pool = Babel.AvailableCollectibles();
    if (pool.length) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      /* ★ 不 wipe ✗ —— `_encWipe` 会把揭晓屏（含四选项讲解）全删掉 ✓
       *   而用户要的流程是"**看完讲解** → 它才把手里的东西递过来" ✓
       *   `_encDrawRevealCard` 自己只追加不清理 ✓ 正好保留讲解 ✓ */
      this.done = true;
      this._encDrawRevealCard(c, A);
    } else {
      /* ★★ 2026-09-26 修的**真 bug**（`_renderer.log` 抓到的）✗✗
       *   症状：`TypeError: Cannot read properties of undefined (reading 'setText')`
       *         `at De._encRewardCorrect` ✓ 玩家表现＝**这不期而遇卡死**
       *   病因：`this._msgText` **只在 `_msg()` 里创建** ✗（商店/失与得用 ✓）
       *     而**辨析卡这一路从不调 `_msg()`** ✓ → `_msgText` 是 undefined ✓
       *     → `.setText('')` 直接抛 ✓ 而这一抛发生在 `_encSettle()` 之后、按钮放出来之前
       *       ⇒「完成」按钮永远不显示 ⇒ **卡死** ✓
       *   ★ 顺带修**顺序**：原来是「先 `_encSettle()` 再画这三行字」✗
       *     那三行字**没进 `_encObjs` 清理表** ✓ 会漏出到下一屏 ✓
       *     正解：**先画 ✓ 再 `_encSettle()`** ✓（settle 只放按钮、不清对象 ✓）*/
      RS.addCurrency(4);
      this._encText(cx, A.mid - 62 * s, '你答对了 —— 它摸出四张残页，压在纸条下面。',
        { font: Babel.FONTS.body, size: P(20), color: '#3f4145', origin: [0.5, 0.5] });
      this._encText(cx, A.mid - 12 * s, '+4 残页',
        { font: Babel.FONTS.body, size: P(30), color: '#e2231a', origin: [0.5, 0.5], bold: true });
      this._encText(cx, A.mid + 38 * s, '（辨析卡：本局第 ' + RS.encRight + ' 次答对）',
        { font: Babel.FONTS.body, size: P(14), color: '#9b9fa5', origin: [0.5, 0.5] });
      this._encSay(cx, A.msgY, 17, '你答对了 —— ', '才把手里的东西递过来。', '“它”', '#111111');
      this._encSettle();
      this._refreshStatus();
      if (this._msgText) this._msgText.setText('');      // ★ 守卫：辨析卡没有 _msgText ✓
    }
  }

  /* ---- ③b 答错 → 残页 ＋ 临时生命（不惩罚 ✓ 防刷 ✓）----
   *   ★★ 2026-09-26 一并修两处（与 ③a 同源 ✗）：
   *     ① 顺序：原来「先 `_encSettle()` 再画四行字」✗ → 那四行字**没进清理表** ✓ 会漏到下一屏 ✓
   *        改成「先画（走 `_encText` 会登记 ✓）→ 最后 `_encSettle()`」✓
   *     ② `this._msgText.setText('')` **没有守卫** ✗ —— `_msgText` 只在 `_msg()` 里建 ✓
   *        辨析卡这一路从不调 `_msg()` ✓ → undefined ✓ 会抛 ✓（`_renderer.log` 里那条同款 ✓）*/
  _encRewardWrong(A) {
    const s = A.s, cx = A.cx;
    const P = (x) => Math.round(x * s) + 'px';
    const RS = Babel.RunState;
    RS.addCurrency(2);
    RS.tempHP = (RS.tempHP || 0) + 2;

    this._encPhase = 'settle';
    this._encText(cx, A.mid - 62 * s, '你指错了 —— 但它没把东西收回去。',
      { font: Babel.FONTS.body, size: P(20), color: '#3f4145', origin: [0.5, 0.5] });
    this._encText(cx, A.mid - 12 * s, '+2 残页　＋2 临时生命',
      { font: Babel.FONTS.body, size: P(30), color: '#e2231a', origin: [0.5, 0.5], bold: true });
    this._encText(cx, A.mid + 38 * s, '纸条背面写着四个选项各自的理由 —— 那才是它真正要给的。',
      { font: Babel.FONTS.body, size: P(15), color: '#6b6f76', origin: [0.5, 0.5] });
    this._encText(cx, A.mid + 66 * s, '答错不罚 —— 东西照给，解释也归你。',
      { font: Babel.FONTS.body, size: P(13), color: '#9b9fa5', origin: [0.5, 0.5] });
    /* ★ 神秘收尾：**“它” 加粗变红** ✓ */
    this._encSay(cx, A.msgY, 17, '你指错了 —— ', '却把纸条翻过来，让你看背面。', '“它”', '#111111');
    this._encSettle();                                   // ★ 挪到最后 ✗ 先画后收 ✓
    this._refreshStatus();
    if (this._msgText) this._msgText.setText('');        // ★ 守卫 ✓
    this.done = true;
  }

  /* ---- 结算屏公共收尾：wipe + 给「完成」---- */
  _encSettle() {
    this._encWipe();
    this._encPhase = 'done';
    if (this.backBtn) this.backBtn.setVisible(true);
  }

  /* 题库空时的退回分支（沿用旧占位 ✓） */
  _encDrawRevealCard(c, A) {
    const s = A.s, cx = A.cx;
    const P = (x) => Math.round(x * s) + 'px';
    const rcS = Babel.RARITY_COLOR[c.rarity] || Babel.COLORS.MUTED;
    const rcN = Babel.RARITY_COLOR_NUM[c.rarity] || 0x9b9fa5;
    const w = 720 * s, h = 236 * s, x0 = cx - w / 2;
    const top = A.mid - h / 2 - 26 * s;
    this._encAdd(Babel.UI.panel(this, x0, top, w, h, 0xffffff, rcN, 4));
    this._encText(x0 + 26 * s, top + 30 * s, (Babel.RARITY_LABEL[c.rarity] || '') + ' · 一件东西',
      { font: Babel.FONTS.display, size: P(11), color: rcS, origin: [0, 0.5] });
    this._encText(x0 + 26 * s, top + 78 * s, c.name,
      { font: Babel.FONTS.body, size: P(30), color: '#111111', origin: [0, 0.5], bold: true });
    this._encText(x0 + 26 * s, top + 132 * s, c.desc || '',
      { font: Babel.FONTS.body, size: P(16), color: '#3f4145', origin: [0, 0] });
    const by = top + h + 46 * s;
    const self = this;
    this._encAdd(Babel.UI.button(this, cx, by, 200 * s, 50 * s, '收下', function () {
      Babel.GrantCollectible(c);
      Babel.RunState.encDone = true;
      self._refreshStatus();
      self._encSettle();
      self._msg('你收下了【' + (Babel.RARITY_LABEL[c.rarity] || '') + '】' + c.name + '。那件东西不见了。',
        cx, self._shopArea().msgY);
    }, { size: P(19) }));
  }

  /* ================= 商店：词缀教学 → 猜义题 → 货架（本店折扣） =================
   * 2026-09-16 实装（用户定稿口径）：
   *   ① 先教**一个**词缀（含义 + 记忆要点 + 3 个例词），每店只教一个、本局内不重复
   *   ② 再出一道**带该词缀的词**，4 个中文选项（正确 + 3 个形近/义近干扰），**不限时**
   *   ③ 猜对 → **本店八折**（价格按 0.8 四舍五入，只影响这一家店）；猜错 → 原价
   * 数据：src/data/affixes.js。全部只在本文件内，不动其它节点类型/场景。 */
  _renderShop() {
    const sc = this._sc || 1;       // ★ 本方法内没有 cx/cy，坐标必须自己算（曾用 cx 导致 create 抛错 = 进店卡死）
    const cx0 = this.width / 2;
    this._shopOff = false;          // 本店折扣（局部，只在这一次商店里生效）
    this._shopPhase = 'teach';
    // ★ 基线：进店这一刻已有的对象（页眉/返回/完成…）。之后每次切阶段只销毁"基线之后"的对象，
    //   否则教学卡不会消失、猜义题会直接叠上去（踩过）。
    // ★ 常驻场景描述（A1）：放在 _shopBase **之前**创建，所以三个阶段切换都不会清掉它
    Babel.UI.text(this, cx0, 132 * sc, '残页浮在半空，一枚一枚翻着面。',
      { font: Babel.FONTS.body, size: Math.round(15 * sc) + 'px', color: '#9b9fa5', origin: [0.5, 0.5] });
    this._shopBase = this.children.list.length;
    const a = this._pickAffix();
    if (a) this._shopTeach(a);
    else this._shopShelf();         // 兜底：词缀库为空时直接开货架
  }

  /* 清掉"本阶段及其之后"新建的对象（保留进店时已有的页眉/返回/完成） */
  _shopClear() {
    if (this._shopBase == null) return;
    // ★ 必须先把名单拷出来再删：destroy() 会立刻从 children.list 移除元素，
    //   边遍历边删会跳着删、留下一半对象（旧提示文字残留在屏上叠字 —— 踩过）。
    const self = this;
    const victims = this.children.list.slice(this._shopBase);
    victims.forEach(function (o) {
      if (o === self.backBtn) return;      // ★ 跳过底部「完成」按钮（它是在 _renderShop 之后创建的，落在基线之内会连它一起删）
      try { o.destroy(); } catch (e) {}
    });
    if (this._msgText) { try { this._msgText.destroy(); } catch (e) {} }
    this._msgText = null;          // 旧提示文字已销毁，避免僵尸引用
  }

  /* 取一个本店要教的词缀（本局内尽量不重复；6 个都教过了就允许重复） */
  _pickAffix() {
    const all = Babel.AFFIXES || [];
    if (!all.length) return null;
    if (!Babel.RunState.taughtAffixes) Babel.RunState.taughtAffixes = [];
    const taught = Babel.RunState.taughtAffixes;
    const fresh = all.filter(x => taught.indexOf(x.id) < 0);
    const pool = fresh.length ? fresh : all;
    const a = pool[Math.floor(Math.random() * pool.length)];
    taught.push(a.id);
    return a;
  }

  /* ① 教学卡（E3 展签：细线分区 + 唯一红强调） */
  _shopTeach(a) {
    this._shopClear();
    const A = this._shopArea();              // ★ 可用区（自适应屏高）
    const s = A.s, cx = A.cx;
    const P = (n) => Math.round(n * s) + 'px';
    const w = 800 * s, h = 366 * s;
    const btnH = 48 * s, gapB = 24 * s;
    const top = A.mid - (h + gapB + btnH) / 2;     // ★ 卡片+按钮作为整块，在内容区里居中
    const x = cx - w / 2;
    this._msg('一枚残页飘到你面前，上面浮起一行字 ——「记住它。」', cx, A.msgY);   // ★ 固定贴在描述行下方
    Babel.UI.panel(this, x, top, w, h, 0xffffff, Babel.COLORS.LINE_N, 4);
    Babel.UI.text(this, x + 24 * s, top + 22 * s, 'AFFIX · ' + (a.kind === 'prefix' ? 'PREFIX 前缀' : 'SUFFIX 后缀'),
      { font: Babel.FONTS.display, size: P(11), color: '#9b9fa5', origin: [0, 0.5] });
    Babel.UI.text(this, x + 24 * s, top + 82 * s, a.affix,
      { font: Babel.FONTS.mixed, size: P(60), color: '#111111', origin: [0, 0.5] });   // ★ 用有真正小写的字体（Novecento 只有大写字形）
    Babel.UI.text(this, x + 24 * s, top + 128 * s, a.zh,
      { font: Babel.FONTS.body, size: P(20), color: '#111111', origin: [0, 0.5], bold: true });
    Babel.UI.text(this, x + 24 * s, top + 162 * s, a.note,
      { font: Babel.FONTS.body, size: P(14), color: '#3f4145', origin: [0, 0], wrap: w - 48 * s });
    Babel.UI.text(this, x + 24 * s, top + 222 * s, 'EXAMPLES',
      { font: Babel.FONTS.display, size: P(10.5), color: '#9b9fa5', origin: [0, 0.5] });
    (a.examples || []).slice(0, 3).forEach((e, i) => {
      const ex = x + 24 * s + i * 252 * s;
      Babel.UI.text(this, ex, top + 258 * s, e.en, { font: Babel.FONTS.mixed, size: P(24), color: '#24252a', origin: [0, 0.5] });   // ★ 小写
      Babel.UI.text(this, ex, top + 286 * s, e.zh, { font: Babel.FONTS.body, size: P(14), color: Babel.COLORS.DARK.muted, origin: [0, 0.5] });
    });
    Babel.UI.text(this, x + 24 * s, top + 328 * s, '记住它 —— 答对那个词，此处的价码会低三分。',
      { font: Babel.FONTS.body, size: P(14), color: '#e2231a', origin: [0, 0.5] });

    const by = top + h + gapB + btnH / 2;
    Babel.UI.button(this, cx - 100 * s, by, 210 * s, btnH, '开始', () => this._shopQuiz(a), { size: P(19) });
    Babel.UI.button(this, cx + 120 * s, by, 160 * s, btnH, '略过', () => this._shopShelf(),
      { color: Babel.COLORS.DARK.muted, size: P(19) });
  }

  /* 舞台缩放（与战斗页同一约定） */
  _s() { return Math.max(1, Math.min(this.width / 1280, this.height / 720)); }

  /* 商店"可用区"：描述行（132*s）之下 → 屏底留白之上。
     三个阶段的内容块都在这个区间里**垂直居中** → 不管窗口多高都不会贴底/悬空（自适应）。 */
  _shopArea() {
    const s = this._s();
    // 固定纵向层：常驻描述 132*s → 阶段台词 168*s → 内容区上边界 208*s
    // （档台词与描述行都定死，内容块只在 [top, bottom] 里居中 → 三者永不重叠）
    const descY = 132 * s;
    const msgY = 168 * s;
    const top = 196 * s;
    const bottom = this.height - 64 * s;
    return { s: s, cx: this.width / 2, descY: descY, msgY: msgY, top: top, bottom: bottom, mid: (top + bottom) / 2 };
  }

  /* ② 猜义题（不限时；**甲配方**：与战斗页同规格 —— 题面 80×s、选项 23×s/84 行高/2×2 两列） */
  _shopQuiz(a) {
    this._shopClear();                         // ★ 切阶段先清掉教学卡
    this._shopPhase = 'quiz';
    const A = this._shopArea();                // ★ 可用区
    const s = A.s, cx = A.cx;
    const P = (n) => Math.round(n * s) + 'px';
    const q = (a.quiz || [])[Math.floor(Math.random() * (a.quiz || []).length)];
    if (!q) { this._shopShelf(); return; }

    /* 与战斗页同一套比例：词条 80×s / 选项 23×s（行 320×84×s，2×2 两列，列距 24×s） */
    const RW = 320 * s, RH = 84 * s, GAPX = 24 * s;
    const colX = [cx - (RW + GAPX) / 2, cx + (RW + GAPX) / 2];
    const rowsTop = 124 * s;                   // 相对块顶：题面(80)+间距(44)
    const btnZone = 92 * s;                    // 下方留给「去看货架」
    const blockH = rowsTop + RH * 2 + btnZone;
    const T = A.mid - blockH / 2;              // ★ 整块居中
    this._msg('那枚残页翻了个面，只留下一个词：「这个，是什么意思？」', cx, A.msgY);

    Babel.UI.text(this, cx, T + 40 * s, q.en,
      { font: Babel.FONTS.mixed, size: P(76), color: '#111111', origin: [0.5, 0.5] });   // ★ 小写显示（Novecento 会强制大写）
    // 副行：作答后会被"结果"顶替（同一位置 → 不留空、不跳版）
    let subText = Babel.UI.text(this, cx, T + 96 * s, '它带上了 ' + a.affix + '（' + a.zh + '）—— 顺着词缀推一推',
      { font: Babel.FONTS.body, size: P(15), color: Babel.COLORS.DARK.muted, origin: [0.5, 0.5] });

    /* 分隔线：组顶 1 条（整幅宽）+ 每项下沿 1 条（行宽），自绘 + d=5 保证可见，并随悬停变红 */
    const seps = [];
    const lh = Math.max(1, Math.round(1 * s));
    seps.push(this.add.rectangle(cx, T + rowsTop, RW * 2 + GAPX, lh, Babel.COLORS.LINE_N).setOrigin(0.5, 0.5).setDepth(5));
    const ACCENT_N = 0x8c1d1d;
    const rows = [];
    const opts = shuffleArr([q.zh].concat((q.near || []).slice(0, 3)));
    opts.forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const rx = colX[col], ry = T + rowsTop + RH / 2 + row * RH;
      const r = Babel.UI.row(this, rx, ry, RW, RH, '0' + (i + 1), t,
        () => {
          if (this._shopPhase !== 'quiz') return;
          this._shopPhase = 'result';
          const ok = (t === q.zh);
          rows.forEach((rr, j) => { if (j !== i) this._disableButton(rr); });
          const txt = ok
            ? '答对了：' + q.en + ' = ' + q.zh + '　—— 残页停住不动了。此处的价码，为你低三分。'
            : '正确答案是 ' + q.zh + '。残页转开了。此处的价码，照旧。';
          if (ok) this._shopOff = true;
          if (subText) { try { subText.destroy(); } catch (e) {} subText = null; }   // ★ 副行让位给结果
          this._msg(txt, cx, T + 96 * s);
          Babel.UI.button(this, cx, T + rowsTop + RH * 2 + 44 * s, 230 * s, 50 * s, '走近些',
            () => this._shopShelf(), { size: P(19) });
        },
        { noKey: false, size: P(23), keyColor: okKeyColor(i) });
      rows.push(r);
      const line = this.add.rectangle(rx, ry + RH / 2 + 2 * s, RW, lh, Babel.COLORS.LINE_N).setOrigin(0.5, 0.5).setDepth(5);
      seps.push(line);
      const rHit = r && r.list && r.list[0];
      if (rHit && line) {
        rHit.on('pointerover', function () { line.setFillStyle(ACCENT_N); });
        rHit.on('pointerout', function () { line.setFillStyle(Babel.COLORS.LINE_N); });
      }
    });
    if (this._msgText) this._msgText.setDepth(6);
  }

  /* ③ 货架（含本店折扣；购买逻辑与原来一致） */
  _shopShelf() {
    const self = this;
    this._shopClear();                         // ★ 切阶段先清掉猜义题
    this._shopPhase = 'shelf';
    const A = this._shopArea();                // ★ 可用区
    const s = A.s, cx = A.cx;
    const P = (n) => Math.round(n * s) + 'px';
    const shelfTop = A.mid - (this._shopOff ? 165 : 145) * s;   // 三件东西（+折扣行）整块居中
    const avail = Babel.AvailableCollectibles();
    // ★ 商店改为**按权重抽取**（2026-09-18 用户：商店 epic 概率太高 ✗）
    //   原来是等概率洗牌取 3 件 ✗ → 每店 40% 出 epic ✗；现在与战斗掉落同一套 weight ✓ → ≈14.8% ✓
    //   （`avail` 仍用于别处 ✓ 这里只换「取哪几件」的方式 ✓ 卖炭人的 shopExtra 照旧 ✓）
    const goods = Babel.PickCollectibles(3 + Math.round(Babel.TotalEffect('shopExtra')));
    const price = { common: 6, rare: 9, epic: 12 };        // 稀有度定价：越强越贵
    this._msg(this._shopOff ? '残页还浮在原处 —— 它记得你答对的那个词。' : '剩下的残页散开，三件东西悬在下面，等你伸手。', cx, A.msgY);   // ★ 固定贴在描述行下方
    if (this._shopOff) {
      // E3 展签式：发丝线 + 左对齐小标签（不再用居中的大红字）
      const lw2 = 560 * s, lx = cx - lw2 / 2;
      this.add.rectangle(cx, shelfTop - 26 * s, lw2, Math.max(1, Math.round(1 * s)), Babel.COLORS.LINE_N)
        .setOrigin(0.5, 0.5).setDepth(4);
      Babel.UI.text(this, lx, shelfTop - 2 * s, '价码已低三分 · 八折',
        { font: Babel.FONTS.display, size: P(11), color: '#9b9fa5', origin: [0, 0.5] });
    }
    if (!goods.length) { this._msg('（这里已经空了）', cx, A.mid); return; }
    goods.forEach((g, i) => {
      const base = price[g.rarity] || 8;
      const cost = this._shopOff ? Math.round(base * 0.8) : base;    // ★ 本店八折（四舍五入）
      const rcN = Babel.RARITY_COLOR_NUM[g.rarity] || 0x9b9fa5;  // 图形用数值色
      const rcS = Babel.RARITY_COLOR[g.rarity] || Babel.COLORS.MUTED;     // 文字用字符串色
      const w = 560 * s, h = 66 * s, by = shelfTop + 44 * s + i * 90 * s, x = cx - w / 2;
      // ★ 一件"悬着的"东西 = 一个容器（面板+文字+命中区都在里面）
      const card = this.add.container(0, 0);
      card.add(Babel.UI.panel(this, x, by - h / 2, w, h, 0xffffff, rcN, 4));
      card.add(Babel.UI.text(this, x + 18 * s, by - 26 * s, (Babel.RARITY_LABEL[g.rarity] || ''),
        { size: P(12), color: rcS, origin: [0, 0.5], bold: true }));
      card.add(Babel.UI.text(this, x + 18 * s, by, g.name, { font: Babel.FONTS.body, size: P(20), color: '#24252a', origin: [0, 0.5] }));
      card.add(Babel.UI.text(this, x + w - 18 * s, by + (this._shopOff ? 10 * s : 0), '残页x' + cost,
        { size: P(16), color: this._shopOff ? '#e2231a' : Babel.COLORS.MUTED, origin: [1, 0.5] }));
      if (this._shopOff) {
        // ★ 原价：只写数字 + 压一条等宽灰线（删除线）→ 打折的通用视觉
        const baseTxt = Babel.UI.text(this, x + w - 18 * s, by - 15 * s, String(base),
          { font: Babel.FONTS.num, size: P(15), color: '#b9b9b5', origin: [1, 0.5] });
        card.add(baseTxt);
        const tw = (baseTxt.width || 12 * s);
        card.add(this.add.rectangle(x + w - 18 * s - tw / 2, by - 15 * s, tw + 5 * s,
          Math.max(1, Math.round(1.4 * s)), 0xb9b9b5).setOrigin(0.5, 0.5));
      }
      const hit = this.add.rectangle(cx, by, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
      card.add(hit);
      // 悬停浮动（容器整体上下，错相位；命中区随之移动 → 点击位置不漂）
      this.tweens.add({ targets: card, y: 4 * s, duration: 1600 + i * 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 300 });
      hit.on('pointerover', function () { self._shopHoverCard = card; card.y -= 3 * s; });
      hit.on('pointerout', function () { if (self._shopHoverCard === card) { card.y += 3 * s; self._shopHoverCard = null; } });
      const buy = () => {
        if (Babel.RunState.currency >= cost) {
          Babel.RunState.addCurrency(-cost);
          Babel.GrantCollectible(g);
          if (Babel.TotalEffect('buyRefund') > 0) Babel.RunState.addCurrency(Babel.TotalEffect('buyRefund')); // #13 亚麻书脊
          this.done = true;                 // 节点已交互（等同原 _finish 的语义）
          this._refreshStatus();
          // ★ 提示放在货架下方、**3 秒后自动消失**（原来走 _finish 会永久停留并压在卡片上）
          const self3 = this;
          this._msg('你收下了【' + (Babel.RARITY_LABEL[g.rarity] || '') + '】' + g.name + '。残页合上了。',
            cx, shelfTop + 44 * s + goods.length * 90 * s + 26 * s);
          this.time.delayedCall(3000, function () {
            if (self3._msgText) { try { self3._msgText.destroy(); } catch (e) {} self3._msgText = null; }
          });
          // ★ 这件东西从货架上消失（连同它的浮动 tween）
          try { self3.tweens.killTweensOf(card); } catch (e) {}
          try { card.destroy(); } catch (e) {}
        } else {
          this._msg('残页不够 —— 那枚残页没有动。', cx, A.msgY);
        }
      };
      // ★ 点卡片先弹"藏品效果浮层"（完整效果 + 折后价），点「收下」才真扣残页 → 不再误买
      hit.on('pointerup', () => {
        if (this._shopPopup && this._shopPopup.close) { try { this._shopPopup.close(); } catch (e) {} }
        const self2 = this;
        this._shopPopup = Babel.UI.collectiblePopup(self2, g, cx, by - 20 * s, {
          s: s,
          depth: 40,
          note: '残页x' + cost + (self2._shopOff ? '（未减时 ' + base + '）' : ''),
          buttons: [
            { label: '收下（×' + cost + '）', primary: true, onClick: function () { if (self2._shopPopup) { self2._shopPopup.close(); self2._shopPopup = null; } buy(); } },
            { label: '先不拿', onClick: function () { if (self2._shopPopup) { self2._shopPopup.close(); self2._shopPopup = null; } } },
          ],
        });
      });
    });
  }

  /* ================= 失与得（交换藏品；换出的放回池） ================= */
  _renderExchange() {
    // ★ 基线只在"第一次进本节点"时设（返回首屏重渲染时不要覆盖，否则清理范围会漂 ✗）
    if (this._shopBase == null) this._shopBase = this.children.list.length;
    this._shopPhase = 'expick';
    this._exGive = null;
    this._exPage = null;
    if (this.backBtn) this.backBtn.setVisible(false);      // ★ 首屏不给「完成」
    if (this.statusText) this.statusText.setVisible(false); // ★ 本节点不显示「目标生命/残页」（用户要求删掉 ✓ 其它节点类型照旧 ✓）
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const L = cx - 300 * s, R = cx + 300 * s;     // 左栏 / 右栏中心线（栏宽 440×s）
    const P = (x) => Math.round(x * s) + 'px';
    this._exSpine(s);

    // ★ 原来这里有"两条横线 + 两个「——」"的占位装饰 ✗
    //   现在天平的两只空托盘已经把"两边都空着"表达清楚了 ✓ 故删除（用户 2026-09-17）
    // ★ 首屏文案（2026-09-17 用户定稿：⑥ + B）—— 先写"一进来感到的那股力量"，再说交换的规矩
    this._exSay(cx, cy - 18 * s, 23, '你感到一股', '，正从四面缓缓收拢过来。', '莫名的力量', '#3f4145');
    Babel.UI.text(this, cx, cy + 30 * s, '放下一件，换回一件 —— 这里的规矩只有这一条。',
      { font: Babel.FONTS.body, size: P(26), color: '#111111', origin: [0.5, 0.5], bold: true });

    const owned = (Babel.RunState.ownedCollectibles || []).map((id) => Babel.FindCollectible(id)).filter(Boolean);
    if (!owned.length) {
      Babel.UI.text(this, cx, cy + 96 * s, '（你还没有藏品）', { size: P(15), color: '#9b9fa5', origin: [0.5, 0.5] });
      if (this.backBtn) this.backBtn.setVisible(true);     // ★ 没东西可换 → 立刻给「完成」，否则卡死 ✗
      return;
    }
    Babel.UI.button(this, cx, cy + 96 * s, 240 * s, 54 * s, '交换一件藏品', () => {
      if (this._shopPhase !== 'expick') return;
      this._exchangePick(owned);
    }, { size: P(18) });
  }

  /* ★ 兜底：玩家在三选一屏**没点【就换这件】就直接点「完成」**时，替他把这次交换收尾
     （已选中 → 拿走它 ✓ 未选 → 随机一件 ✓）—— 否则会出现"交了东西却什么都没拿到"✗
     （用户 2026-09-17 实测：交出的那件在答完题时已放回池里，不兜底就是净亏一件 ✗） */
  _completePendingExchange() {
    if (this._shopPhase !== 'expick2b') return;          // 只有"已交出、未拿到"这一步有风险
    const cands = this._exCands || [];
    if (!cands.length) return;
    const c = cands.filter((x) => x.id === this._exSel2)[0] || cands[Math.floor(Math.random() * cands.length)];
    try {
      Babel.GrantCollectible(c);
      this._refreshStatus();
      this.done = true;
    } catch (e) {}
  }

  /* ★ 失与得的"一句话"渲染：把「“它”」拆出来加粗变红，其余灰——先建后量宽再整体居中
     用法：this._exSay(cx, y, 17, '你没认出那个词。于是', '替你挑了一件 —— 不由你选。') */
  _exSay(cx, y, size, pre, post, mid, color) {
    const s = this._shopArea().s;
    const P = (x) => Math.round(x * s) + 'px';
    const opt = { font: Babel.FONTS.body, size: P(size), color: color || '#6f6f6f', origin: [0, 0.5] };
    const a = Babel.UI.text(this, 0, y, pre, opt);
    const b = Babel.UI.text(this, 0, y, mid || '“它”',
      { font: Babel.FONTS.body, size: P(size), color: '#e2231a', origin: [0, 0.5], bold: true });
    const c = Babel.UI.text(this, 0, y, post, opt);
    const total = (a.width || 0) + (b.width || 0) + (c.width || 0);
    a.x = cx - total / 2;
    b.x = a.x + (a.width || 0);
    c.x = b.x + (b.width || 0);
  }

  /* ★ 对开装饰：中缝 + 左「失」右「得」（各自在**本栏中心线**上 ✓） */
  _exSpine(s) {
    const cx = this.width / 2, cy = this.height / 2;
    const P = (v) => Math.round(v * s) + 'px';
    const LINE = 0xcfcfcb;                                   // 中缝（保持原来的浅灰 ✓）
    const DARK = 0x111111;                                   // 秤：墨黑（加重 ✓）
    const TICK = 0x9b9fa5;                                   // 刻度：中间灰
    const LW = Math.max(1, Math.round(1 * s));
    const HW = Math.max(2, Math.round(2 * s));               // 横梁/吊线：2×s
    const TW = Math.max(1, Math.round(1 * s));               // 刻度：1×s
    const beamY = cy - 270 * s;
    const chY = cy - 244 * s;
    const panY = cy - 228 * s;
    const armX = 460 * s;
    const panX = 300 * s;
    // ① 中缝（竖轴）
    this.add.rectangle(cx, cy, LW, 580 * s, LINE);
    // ② 支点
    this.add.rectangle(cx, beamY, Math.max(2, Math.round(4 * s)), Math.max(6, Math.round(18 * s)), DARK);
    // ③ 横梁（两段 2×s 墨黑）
    this.add.rectangle(cx - armX / 2, beamY, armX, HW, DARK);
    this.add.rectangle(cx + armX / 2, beamY, armX, HW, DARK);
    // ④ 刻度（站在横梁上方 ✓ 12 个 ✓ 位置与预览 E 逐值一致）
    const ticks = [-420, -380, -340, -220, -180, -140, 180, 220, 260, 380, 420, 460];
    for (let i = 0; i < ticks.length; i++) {
      this.add.rectangle(cx + ticks[i] * s, beamY - 4 * s, TW, Math.max(2, Math.round(6 * s)), TICK);
    }
    // ⑤ 吊绳：**每侧两条**，夹住中间的字
    //    · 单条吊线正好在字心 → 竖穿「失」会看成「朱」✗（用户 2026-09-17 指出）
    //    · 改成两根（字心左右各 30×s）→ 不再穿字，且更像真秤 ✓
    const hg = 30 * s;
    const hy = (beamY + panY) / 2;
    const hh = Math.max(4, panY - beamY);
    [-1, 1].forEach(function (side) {
      [-hg, hg].forEach(function (off) {
        this.add.rectangle(cx + side * panX + off, hy, HW, hh, DARK);
      }, this);
    }, this);
    // ⑥ 两只托盘（88×s × 3×s）
    this.add.rectangle(cx - panX, panY, 88 * s, Math.max(2, Math.round(3 * s)), DARK);
    this.add.rectangle(cx + panX, panY, 88 * s, Math.max(2, Math.round(3 * s)), DARK);
    // ⑦ 「失」「得」34×s 墨黑加粗
    Babel.UI.text(this, cx - panX, chY, '失',
      { font: Babel.FONTS.body, size: P(34), color: '#111111', origin: [0.5, 0.5], bold: true });
    Babel.UI.text(this, cx + panX, chY, '得',
      { font: Babel.FONTS.body, size: P(34), color: '#111111', origin: [0.5, 0.5], bold: true });
  }

  /* ② 背包屏：左栏＝收藏清单（名称 + 稀有度居中，左侧**小方框**勾选）／右栏＝你挑中的那件 */
  _exchangePick(owned) {
    this._shopClear();
    this._shopPhase = 'expick2';
    if (this.backBtn) this.backBtn.setVisible(false);      // ★ 背包屏不给「完成」
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const L = cx - 300 * s, R = cx + 300 * s;
    const P = (x) => Math.round(x * s) + 'px';
    this._exSpine(s);

    const PER = 5, STEP = 78;
    const pages = Math.max(1, Math.ceil(owned.length / PER));
    if (this._exPage == null || this._exPage >= pages) this._exPage = 0;
    const page = this._exPage;
    const list = owned.slice(page * PER, page * PER + PER);
    const y0 = cy + 6 * s - ((list.length - 1) / 2) * STEP * s;     // ★ 整列以 cy 垂直居中

    Babel.UI.text(this, L, cy - 200 * s,
      '你的收藏　·　' + owned.length + ' 件　·　第 ' + (page + 1) + ' / ' + pages + ' 页',
      { font: Babel.FONTS.display, size: P(11), color: '#9b9fa5', origin: [0.5, 0.5] });

    this._exFrames = [];
    this._exSel = null;
    this._exConfirmReady = false;
    const RED_S = '#e2231a', RED_N = 0xe2231a, INK_S = '#111111';

    list.forEach((c, i) => {
      const y = y0 + i * STEP * s;
      const name = Babel.UI.text(this, L, y, c.name,
        { font: Babel.FONTS.body, size: P(21), color: INK_S, origin: [0.5, 0.5], bold: true });
      Babel.UI.text(this, L, y + 22 * s, (Babel.RARITY_LABEL[c.rarity] || ''),
        { size: P(11.5), color: '#9b9fa5', origin: [0.5, 0.5] });
      // ★ 小方框（照"藏品测试"：8×s，未选白底红描边／选中填红 ✓）
      const dot = this.add.rectangle(L - 168 * s, y - 6 * s, 8 * s, 8 * s, 0xffffff)
        .setStrokeStyle(Math.max(1, Math.round(1 * s)), RED_N).setOrigin(0.5, 0.5);
      this.add.rectangle(L, y + 48 * s, 440 * s, Math.max(1, Math.round(1 * s)), Babel.COLORS.LINE_N);
      const hit = this.add.rectangle(L, y + 16 * s, 440 * s, 68 * s, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this._shopPhase !== 'expick2') return;
        this._exSel = c.id;
        (this._exFrames || []).forEach((f) => {
          const on = (f.id === c.id);
          if (f.name) f.name.setColor(on ? RED_S : INK_S);
          if (f.dot) f.dot.setFillStyle(on ? RED_N : 0xffffff);
        });
        this._exConfirmReady = true;
        if (this._exRight) { this._exRight.setText(c.name); this._exRight.setColor(RED_S); }
        if (this._exRightDesc) this._exRightDesc.setText(c.desc || '');
        if (this._exConfirm) {
          this._exConfirm.setAlpha(1);
          const t = this._exConfirm.list && this._exConfirm.list[1];
          if (t && t.setText) t.setText('就交这件：' + c.name);
        }
      });
      this._exFrames.push({ id: c.id, name: name, dot: dot });
    });

    this._exRight = Babel.UI.text(this, R, cy - 30 * s, '',
      { font: Babel.FONTS.body, size: P(30), color: '#e2231a', origin: [0.5, 0.5], bold: true });
    this._exRightDesc = Babel.UI.text(this, R, cy + 22 * s, '',
      { size: P(13), color: '#6f6f6f', origin: [0.5, 0.5] });

    Babel.UI.button(this, L, this.height - 54 * s, 160 * s, 46 * s, '返回',
      () => { this._shopClear(); this._exPage = null; this._renderExchange(); },
      { color: Babel.COLORS.DARK.muted, size: P(18) });
    this._exConfirm = Babel.UI.button(this, R, this.height - 118 * s, 300 * s, 50 * s, '先选一件',
      () => {
        if (!this._exConfirmReady || this._shopPhase !== 'expick2') return;
        const c = owned.filter((x) => x.id === this._exSel)[0];
        if (!c) return;
        this._shopPhase = 'exquiz';
        this._exGive = c;
        this._exchangeQuiz(c);
      }, { size: P(18) });
    this._exConfirm.setAlpha(0.35);

    if (pages > 1) {
      Babel.UI.button(this, L - 86 * s, this.height - 118 * s, 150 * s, 46 * s, '上一页',
        () => { this._exPage = (page - 1 + pages) % pages; this._shopClear(); this._exchangePick(owned); },
        { color: Babel.COLORS.DARK.muted, size: P(17) });
      Babel.UI.button(this, L + 86 * s, this.height - 118 * s, 150 * s, 46 * s, '下一页',
        () => { this._exPage = (page + 1) % pages; this._shopClear(); this._exchangePick(owned); },
        { color: Babel.COLORS.DARK.muted, size: P(17) });
    }
  }

  /* ③ 出题屏：左栏＝交出的那件 + 题面大词／右栏＝四个英文选项（两侧内容块都以 cy 居中） */
  _exchangeQuiz(given) {
    this._shopClear();
    this._shopPhase = 'exquiz';
    if (this.backBtn) this.backBtn.setVisible(false);      // ★ 出题屏不给「完成」
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const L = cx - 300 * s, R = cx + 300 * s;
    const P = (x) => Math.round(x * s) + 'px';
    this._exSpine(s);

    const bank = Babel.SYNONYM_QUIZ || [];
    let q = null;
    for (let t = 0; t < 16 && bank.length; t++) {
      const c = bank[Math.floor(Math.random() * bank.length)];
      if (c && c.en && c.syn && (c.near || []).length >= 3 && c.en !== this._exLast) { q = c; break; }
    }
    if (!q) { this._exchangeDo(given, true, null); return; }
    this._exLast = q.en;

    Babel.UI.text(this, L, cy - 200 * s, '交出的',
      { font: Babel.FONTS.display, size: P(11), color: '#9b9fa5', origin: [0.5, 0.5] });
    Babel.UI.text(this, L, cy - 150 * s, given ? given.name : '——',
      { font: Babel.FONTS.body, size: P(28), color: '#b9b9b5', origin: [0.5, 0.5], bold: true });
    this.add.rectangle(L, cy - 104 * s, 100 * s, Math.max(2, Math.round(2 * s)), 0xe2231a);
    Babel.UI.text(this, L, cy - 20 * s, q.en,
      { font: Babel.FONTS.mixed, size: P(104), color: '#111111', origin: [0.5, 0.5] });
    // ★ 大字下面的中文释义（2026-09-17 用户要求：放在题面英文下面，用来看/学 ✓）
    //   右侧四个选项**仍然只显示英文**（用户要求 ✗ 不要给选项配中文）
    Babel.UI.text(this, L, cy + 58 * s, q.zh || '',
      { font: Babel.FONTS.body, size: P(26), color: '#3f4145', origin: [0.5, 0.5] });

    Babel.UI.text(this, R, cy - 200 * s, '选出意思最接近的一个',
      { font: Babel.FONTS.display, size: P(11), color: '#9b9fa5', origin: [0.5, 0.5] });
    const opts = shuffleArr([q.syn].concat(q.near.slice(0, 3)));
    const rows = [];
    const oy0 = cy - ((opts.length - 1) / 2) * 76 * s;              // ★ 四个选项整块以 cy 居中
    // ★ 分隔线自己画：组顶 1 条 + 每项下沿 4 条（row 内部那条**第一行看不见** ✗ 踩过两次）
    const lh = Math.max(1, Math.round(1 * s));
    const seps = [];
    for (let k = 0; k <= opts.length; k++) {
      const yy = oy0 - 38 * s + k * 76 * s;
      seps.push(this.add.rectangle(R, yy, 440 * s, lh, Babel.COLORS.LINE_N).setDepth(5));
    }
    const RED_N = 0xe2231a;
    opts.forEach((t, i) => {
      const y = oy0 + i * 76 * s;
      const r = Babel.UI.row(this, R, y, 440 * s, 76 * s, '', t, () => {
        if (this._shopPhase === 'exres') return;
        this._shopPhase = 'exres';
        rows.forEach((rr, j) => { if (j !== i) this._disableButton(rr); });
        this._exchangeDo(given, t === q.syn, q, t);      // ★ 把玩家点的词传下去（答错要解释）
      }, { noKey: true, center: true, size: P(30) });
      // ★ 悬停 → 该行**下沿线**变红（接到自绘线上 ✓ 第一行也有 ✓）
      const rh = r && r.list && r.list[0];
      const myLine = seps[i + 1];
      if (rh && myLine) {
        rh.on('pointerover', function () { myLine.setFillStyle(RED_N); });
        rh.on('pointerout', function () { myLine.setFillStyle(Babel.COLORS.LINE_N); });
      }
      rows.push(r);
    });
  }

  /* ④ 答对 → 三选一；答错 → 随机换一件（都不惩罚玩家 ✓） */
  _exchangeDo(given, ok, q, picked) {
    try {
      const givenId = given ? given.id : null;
      if (givenId) Babel.ReturnCollectible(givenId);
      const rarity = (given && given.rarity) || 'common';
      const avail = Babel.AvailableCollectibles().filter((c) => c.id !== givenId);
      const same = avail.filter((c) => c.rarity === rarity);
      const pool = same.length ? same : avail;
      const RANK = { common: 0, rare: 1, epic: 2, boss: 3 };
      const rk = (r) => (RANK[r] == null ? 0 : RANK[r]);

      // ★ 近义词本（29）：在失与得**答对**时额外获得残页（一次性 ✓ 在进入三选一之前结算 ✓）
      if (ok) {
        const _yb = Babel.TotalEffect('exchangeBonus');
        if (_yb > 0) Babel.RunState.addCurrency(_yb);
      }
      if (ok && pool.length) {
        const cands = shuffleArr(same.slice()).slice(0, 3);
        if (cands.length < 3) {
          // ★ 同级别不够 → 只用**更低**档补（绝不往上补 ✗ 免得白赚一档）
          const rk0 = rk(rarity);
          let rest = avail.filter((c) => c.rarity !== rarity && rk(c.rarity) < rk0)
            .sort((a, b) => rk(b.rarity) - rk(a.rarity));
          if (cands.length + rest.length < 3 && rk0 <= 0) {
            rest = rest.concat(avail.filter((c) => rk(c.rarity) > rk0).sort((a, b) => rk(a.rarity) - rk(b.rarity)));
          }
          for (let i = 0; i < rest.length && cands.length < 3; i++) {
            if (cands.indexOf(rest[i]) < 0) cands.push(rest[i]);
          }
        }
        this._exchangeChoose(given, cands, q);
        return;
      }
      const newC = pool.length ? pool[Math.floor(Math.random() * pool.length)] : Babel.PickCollectible();
      if (newC) Babel.GrantCollectible(newC);
      this._refreshStatus();
      this.done = true;
      this._exchangeSettle(given, newC, q, picked, ok);
    } catch (e) { this._finish('（交换出了点问题，点「完成」离开即可）'); }
  }

  /* ⑤a 三选一：**点卡片只选中（小方框填红）**，按【就换这件】才真正交换 ✓ */
  _exchangeChoose(given, cands, q) {
    this._shopClear();
    this._shopPhase = 'expick2b';
    if (this.backBtn) this.backBtn.setVisible(false);      // ★ 三选一屏不给「完成」
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const L = cx - 300 * s, R = cx + 300 * s;
    const P = (x) => Math.round(x * s) + 'px';
    this._exSpine(s);

    Babel.UI.text(this, L, cy - 200 * s, '交出的',
      { font: Babel.FONTS.display, size: P(11), color: '#9b9fa5', origin: [0.5, 0.5] });
    Babel.UI.text(this, L, cy - 120 * s, given ? given.name : '——',
      { font: Babel.FONTS.body, size: P(28), color: '#b9b9b5', origin: [0.5, 0.5], bold: true });
    if (q) {
      Babel.UI.text(this, L, cy - 62 * s, q.en + ' = ' + q.syn,
        { font: Babel.FONTS.mixed, size: P(15), color: '#9b9fa5', origin: [0.5, 0.5] });   // ★ mixed：真小写（Novecento 会强制大写 ✗）
    }
    // ★ 选对 → 左栏下方解释"为什么这次能自己挑"（与答错那句对称 ✓ 用户要求）
    this._exSay(L, cy - 6 * s, 15, '你认出了那个词。于是', '让你自己挑 —— 三件里任选一件。');
    Babel.UI.text(this, R, cy - 200 * s, 'TAKE ONE',
      { font: Babel.FONTS.display, size: P(11), color: '#9b9fa5', origin: [0.5, 0.5] });

    this._exCands = cands;                  // ★ 供「完成」兜底使用
    this._exFrames2 = [];
    this._exSel2 = null;
    this._exReady2 = false;
    const RED_S = '#e2231a', RED_N = 0xe2231a, INK_S = '#111111';
    const STEP = 116;                                                // ★ 压缩行距：腾出抬头那一行 ✓
    const y0 = cy - 18 * s - ((cands.length - 1) / 2) * STEP * s;   // ★ K=18 → 三块中心 226/342/458（首块编号 204，避开抬头 166 与天平 131 ✓）   // ★ 三块整体下移，避开 cy−200 的抬头

    cands.forEach((c, i) => {
      const y = y0 + i * STEP * s;
      const name = Babel.UI.text(this, R, y, c.name,
        { font: Babel.FONTS.body, size: P(26), color: INK_S, origin: [0.5, 0.5], bold: true });
      Babel.UI.text(this, R, y + 30 * s, (Babel.RARITY_LABEL[c.rarity] || ''),
        { size: P(11.5), color: '#9b9fa5', origin: [0.5, 0.5] });
      Babel.UI.text(this, R, y + 54 * s, c.desc || '',
        { size: P(13), color: '#6f6f6f', origin: [0.5, 0.5], wrap: 400 * s, align: 'center' });
      const dot = this.add.rectangle(R - 208 * s, y - 4 * s, 8 * s, 8 * s, 0xffffff)
        .setStrokeStyle(Math.max(1, Math.round(1 * s)), RED_N).setOrigin(0.5, 0.5);
      this.add.rectangle(R, y + 92 * s, 440 * s, Math.max(1, Math.round(1 * s)), Babel.COLORS.LINE_N);
      const hit = this.add.rectangle(R, y + 24 * s, 440 * s, 100 * s, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this._shopPhase !== 'expick2b') return;
        this._exSel2 = c.id;
        (this._exFrames2 || []).forEach((f) => {
          const on = (f.id === c.id);
          if (f.name) f.name.setColor(on ? RED_S : INK_S);
          if (f.dot) f.dot.setFillStyle(on ? RED_N : 0xffffff);
        });
        this._exReady2 = true;
        if (this._exConfirm2) {
          this._exConfirm2.setAlpha(1);
          const t = this._exConfirm2.list && this._exConfirm2.list[1];
          if (t && t.setText) t.setText('就换这件：' + c.name);
        }
      });
      this._exFrames2.push({ id: c.id, name: name, dot: dot });
    });

    // ★ 与背包屏同款：先选中 → 按【就换这件】才真正交换（点卡片不再直接成交 ✗）
    this._exConfirm2 = Babel.UI.button(this, R, this.height - 118 * s, 300 * s, 50 * s, '先选一件',
      () => {
        if (!this._exReady2 || this._shopPhase !== 'expick2b') return;
        const c = cands.filter((x) => x.id === this._exSel2)[0];
        if (!c) return;
        this._shopPhase = 'exdone';
        try {
          Babel.GrantCollectible(c);
          this._refreshStatus();
          this.done = true;
          this._exchangeSettle(given, c);
        } catch (e) { this._finish('（交换出了点问题，点「完成」离开即可）'); }
      }, { size: P(18) });
    this._exConfirm2.setAlpha(0.35);
  }

  /* ⑤b 结算屏：左＝交出的（灰）／右＝换得的（红）；两栏内容以 cy 居中 */
  _exchangeSettle(gave, took, q, picked, ok) {
    this._shopClear();
    this._shopPhase = 'exdone';
    if (this.backBtn) this.backBtn.setVisible(true);       // ★ 结算后才给「完成」
    const A = this._shopArea();
    const s = A.s, cx = A.cx, cy = this.height / 2;
    const L = cx - 300 * s, R = cx + 300 * s;
    const P = (x) => Math.round(x * s) + 'px';
    this._exSpine(s);
    Babel.UI.text(this, L, cy - 30 * s, gave ? gave.name : '——',
      { font: Babel.FONTS.body, size: P(32), color: '#b9b9b5', origin: [0.5, 0.5], bold: true });
    Babel.UI.text(this, L, cy + 22 * s, gave ? (gave.desc || '') : '',
      { size: P(13), color: '#6f6f6f', origin: [0.5, 0.5], wrap: 400 * s, align: 'center' });
    this.add.rectangle(L, cy + 80 * s, 440 * s, Math.max(1, Math.round(1 * s)), Babel.COLORS.LINE_N);
    Babel.UI.text(this, R, cy - 30 * s, took ? took.name : '——',
      { font: Babel.FONTS.body, size: P(32), color: '#e2231a', origin: [0.5, 0.5], bold: true });
    Babel.UI.text(this, R, cy + 22 * s, took ? (took.desc || '') : '',
      { size: P(13), color: '#6f6f6f', origin: [0.5, 0.5], wrap: 400 * s, align: 'center' });
    this.add.rectangle(R, cy + 80 * s, 440 * s, Math.max(2, Math.round(2 * s)), 0xe2231a);
    // ★ 答错 → 用**剧情叙述**解释"为什么只能随机给你一件"（用户定稿口径 ✓）
    //   本作里"它"是无形、不说话、只用动作的非人存在 → 所以用"它替你挑了"这种动作句 ✓
    if (ok === false) {
      this._exSay(cx, cy + 130 * s, 17, '你没认出那个词。于是', '替你挑了一件 —— 不由你选。');
      // ★ 答错 → 也要给正确答案（用户要求：xx = xx ✓ 顺带给中文，便于学习）
      if (q) {
        Babel.UI.text(this, cx, cy + 166 * s, q.en + ' = ' + q.syn,
          { font: Babel.FONTS.mixed, size: P(18), color: '#111111', origin: [0.5, 0.5] });
        Babel.UI.text(this, cx, cy + 192 * s, (q.zh || '') + ' = ' + (q.synZh || ''),
          { font: Babel.FONTS.body, size: P(13), color: '#9b9fa5', origin: [0.5, 0.5] });
      }
    }
  }

  /* 标题下方 / 居中提示文字 */
  _msg(text, x, y) {
    // ★ 先销毁上一条提示：否则阶段台词会一条条叠在一起（教学卡台词与猜义题台词交织 —— 踩过）
    if (this._msgText) {
      try { this._msgText.destroy(); } catch (e) {}
      this._msgText = null;
    }
    const sc = this._sc || 1;
    this._msgText = Babel.UI.text(this, x, y, text,
      { size: Math.round(19 * sc) + 'px', color: Babel.COLORS.DARK.muted, origin: [0.5, 0.5] });
  }

  /* 刷新顶部"目标生命/残页" */
  _refreshStatus() {
    if (!this.statusText) return;
    this.statusText.setText('目标生命 ' + Babel.RunState.targetHP + '   残页 ' + Babel.RunState.currency);
  }

  /* 禁用某个按钮（置灰 + 不再响应点击） */
  _disableButton(btn) {
    if (!btn) return;
    btn.setAlpha(0.35);
    const r = btn.list && btn.list[0];
    if (r && r.disableInteractive) r.disableInteractive();
  }

  /* 完成本次交互：显示结果 + 刷新状态 */
  _finish(text) {
    this._msgText.setText('');
    this._msgText = Babel.UI.text(this, this.width / 2, this.height / 2 + 150 * (this._sc || 1), text,
      { size: Math.round(21 * (this._sc || 1)) + 'px', color: Babel.COLORS.DARK.fg, origin: [0.5, 0.5] });
    this._refreshStatus();
    this.done = true;
  }
}

Babel.Scenes = Babel.Scenes || {};
Babel.Scenes.NodeEventScene = NodeEventScene;
