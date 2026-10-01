/* ============================================================================
 * RunState.js —— 本局运行状态（全局单例）
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 保存「一次探索」里所有跨场景共享的状态，避免散落在各个场景里。
 *   1) 目标生命值 targetHP：本局全局共享，归零则本局失败（IS 式）。
 *   2) 残页 currency：货币，战斗掉落、商店消费。
 *   3) items 藏品、runes 词条：构筑 / 收藏。
 *   4) floor 当前层、currentNodeId 当前所处节点、visited 每层走过哪些节点。
 *
 * 【为什么用全局单例】
 * 地图、战斗、事件弹窗、结算这些场景都要读写同一份状态；放一个全局对象
 * 最直观也最不易出错。后续如需存档/重开，只需调用 resetRun()。
 * ========================================================================== */

window.Babel = window.Babel || {};

Babel.RunState = {
  floor: 1,          // 当前层（1~N）
  targetHP: 100,     // 全局目标生命值
  currency: 0,       // 残页（货币）
  items: [],         // 藏品列表
  runes: [],         // 词条列表（构筑）
  currentNodeId: null, // 当前所在节点 id
  visited: {},       // { floorId: [节点 id, ...] } 记录走过/已结算的节点

  /* 初始化一局（读常量里的默认值） */
  init() {
    this.floor = 1;
    this.targetHP = Babel.BATTLE.playerTargetHP;
    this.currency = Babel.BATTLE.startCurrency;

    /* ★ 本局总结用的记录（2026-09-18 新增）：只「记」，不影响任何玩法 ✓
     *   answers[]  ：每题 { floor, enemy, quiz, en, zh, your, ok }（四列展示要的两样都存 ✓）
     *   nodes[]    ：走过的节点（顺序＝路线 ✓）
     *   gained[]   ：获得的藏品 { id, node }（自动带上「当时所在节点」✓）
     *   tradedOut[]：失与得换出的藏品 id
     *   stats{}    ：整局累计的"藏品/机制贡献"（2026-09-26 新增 ✓ 见 `logStats` ✓）
     *                sealDmg 铁络之印反打伤害 ／ jianko 缄口挡下次 ／
     *                milShield 军用斯安威斯坦给盾 ／ milTurns 残血增伤题数 ／
     *                ringBreak 圣环破碎 ／ fireOut 治灭火 ／ fireBoom 烧尽火 ／
     *                bonusTime 加时实际秒数
     *   earned / spent / maxCombo / startedAt / endedAt / outcome（win·lose·quit） */
    this.runLog = {
      startedAt: Date.now(), endedAt: 0, outcome: '',
      answers: [], nodes: [], gained: [], tradedOut: [], stats: [],
      earned: 0, spent: 0, maxCombo: 0,
    };
    /* ★ 本局「熟词生义·连线」已用过的词（2026-09-21 ✓ 一局之内不重复用词 ✓ 开新局自动清空 ✓）*/
    this.senseUsed = [];
    this.items = [];
    this.runes = [];
    this.currentNodeId = null;
    this.floorGraph = null;   // 当前层的随机线路图
    this.usedWords = [];      // 本局已考察过的单词（普通库 draw + 拼词 draw 共用；保证同库不重复出题）
    this.usedTrial = [];      // 皇帝利刃专属库 drawTrial 的已用记录（独立，避免与普通库互相清空/误伤）
    this.maxHP = Babel.BATTLE.playerTargetHP; // 本局目标生命上限（可被藏品提升）
    this.tempHP = 0;          // 临时生命（藏品"静默之盾"）
    this.ownedCollectibles = [];
    this.taughtAffixes = [];      // 商店词缀教学：本局已教过的词缀 id（开新局清空） // 已获得藏品 id（每局 1 次，获得后踢出池）
    /* ★★ 「不期而遇·辨析卡」记账（2026-09-25 ✓ 一局内不重复出题 ✓）
     *   usedSyn  ：本局已出过的题面词（按 `en` 去重 ✓ 抽空后才重置 ✓）
     *   encRight ：本局在辨析卡上累计答对的次数
     * ★ 用户 2026-09-25："不要错题，做起来太复杂" → **不做错题本** ✗ 纯随机抽题 ✓
     * ★★ 2026-09-26 用户纠正："不期而遇就是答对给藏品，答错给残页"
     *   → 奖励**按对错分** ✗ 没有"一局只一件"的限制 ✗
     *   → `encDone` 已**不再参与奖励判定** ✗ 只由 `_encReceive` 置位当"收下过"的记录 ✓
     *     （保留字段是为了不破坏存档/自测里的引用 ✓ 语义已变 ✓）*/
    this.usedSyn = [];
    this.encRight = 0;
    this.encDone = false;
    this.visited = {};
  },

  /* 返回当前层的配置（游戏数值）与线路图 */
  getFloorConfig() {
    return Babel.FLOORS[this.floor - 1];
  },
  getFloorGraph() {
    return this.floorGraph;
  },

  /* 玩家受击：先消耗临时生命再扣目标生命，返回是否归零（目标生命耗尽即败） */
  takeDamage(n) {
    if (this.tempHP > 0) { const a = Math.min(this.tempHP, n); this.tempHP -= a; n -= a; }
    this.targetHP = Math.max(0, this.targetHP - n);
    return this.targetHP <= 0;
  },

  /* 回复目标生命值（不超出本局上限 maxHP） */
  heal(n) {
    this.targetHP = Math.min(this.maxHP, this.targetHP + n);
  },

  /* 增减残页（货币） */
  addCurrency(n) {
    /* ★ 记账（2026-09-18）：正数＝收入 ✓ 负数＝支出 ✓ 纯记录 ✓ 不影响数值 ✓ */
    try {
      const L = this.runLog;
      if (L && n) { if (n > 0) L.earned += n; else L.spent += (-n); }
    } catch (e) {}
    this.currency = Math.max(0, this.currency + n);
  },

  /* 获得藏品 / 词条 */
  addItem(item) { this.items.push(item); },
  addRune(rune) { this.runes.push(rune); },

  /* 记录某个节点已被访问（用于地图灰显已走过节点） */
  markVisited(nodeId) {
    if (!this.visited[this.floor]) this.visited[this.floor] = [];
    this.visited[this.floor].push(nodeId);
  },
  isVisited(nodeId) {
    return this.visited[this.floor] && this.visited[this.floor].indexOf(nodeId) >= 0;
  },

  /* 进入某一层：把当前节点置空、清空该层访问记录 */
  enterFloor(floorId) {
    this.floor = floorId;
    this.currentNodeId = null;
    this.floorGraph = Babel.generateFloor(floorId);  // 随机生成本层线路图（每次不同）
    if (!this.visited[floorId]) this.visited[floorId] = [];
  },

  /* 进入某个节点（设为其当前所在节点） */
  enterNode(nodeId) { this.currentNodeId = nodeId; },

  /* 完成某节点：标记为已走过（用于地图灰显） */
  completeNode(nodeId) {
    if (!this.visited[this.floor]) this.visited[this.floor] = [];
    if (this.visited[this.floor].indexOf(nodeId) < 0) this.visited[this.floor].push(nodeId);
  },
};

/* ============================================================================
 * ★ 本局总结 · 记录层（2026-09-18）
 *   全部是纯追加 ✓ 不改变任何既有逻辑 ✓ 也不参与判断 ✓
 * ========================================================================== */
(function () {
  const R = Babel.RunState;
  const log = function () { return R.runLog; };

  /* 每题一条（由 CombatScene 的包装器调用 ✓）。
     scene 上需要的字段（CombatScene 里只加了 3 行去存 ✓）：
       _curWord  { en, zh }      当前题目
       _shown    [4 个中文释义]  屏幕上实际显示的选项（试炼二选一时只有 2 个 ✓）
       _built    [字母]         拼词类已拼入的字母（＝正确拼写的前缀 ✓）
       _quiz / _runEnemy        作答形式 / 敌人名 */
  R.logAnswer = function (scene, index, ok) {
    try {
      const L = log(); if (!L) return;
      const quiz = scene._quiz || '';
      /* ★ 题目与正确答案：按作答形式从**场景上已有的数据**取 ✓（2026-09-18 修）
       *   拼词类：题面＝wordText（中文释义 ✓）  正确答案＝_target（要拼的英文词 ✓）
       *   四选一：题面＝wordText（英文词 ✓）    正确答案＝_shown[correctIndex]（正确中文 ✓）
       *   原先读 `_curWord` ✗ 而它只存在于四选一路径 ✓ → 拼词题记不到词 ✓ 总结里出现一串空词 ✗ */
      const shownText = (scene.wordText && scene.wordText.text) ? String(scene.wordText.text) : '';
      let en = '', zh = '';
      /* ★★★ 奎隆「尼卢火」：题面与选项**不在通用控件里** ✗✗（2026-09-26 修）
       *   病因：火阶段的题面画在火上、选项由皮肤自己填 ✓
       *     而皮肤收题时会 `_fireWipeQ` 清空 `wordText` ＋ `_fireOpen` 清空 `_shown` ✓
       *     → 本函数跑到时两者**都是空** ✓
       *     → 总结里全是「(空) ｜ (空) ｜ (未拼出) ｜ 第3层·奎隆·四选一」✓（用户截图 ✓）
       *   修：皮肤在**清题之前**把快照写进 `scene._fireLog` ✓ 这里优先读它 ✓
       *   ★ 只在快照**真的有题面**时才用 ✗ 否则退回通用取值 ✓ 其它 14 只敌人零影响 ✓ */
      const fl = scene._fireLog;
      if (fl && (fl.en || fl.zh)) {
        en = String(fl.en || '');
        zh = String(fl.zh || fl.correct || '');
        /* 选项里就是正确答案（四选一）；`zh` 是讲解用的中文释义，没有就退回正确项 ✓ */
        let your = String(fl.your || '');
        L.answers.push({
          floor: R.floor,
          enemy: scene._runEnemy || '',
          quiz: quiz,
          en: en,
          zh: zh || String(fl.correct || ''),
          your: your,
          ok: ok ? 1 : 0,
        });
        if (ok && scene.combo > (L.maxCombo || 0)) L.maxCombo = scene.combo;
        scene._fireLog = null;        // ★ 用完即清 ✗ 免得下一题复用旧快照 ✓
        return;
      }
      /* ★★★ 圣徒「连线」：题面是**皮肤自己抽的 3 对熟词生义词** ✗✗（2026-09-26 修）
       *   用户报：总结里出现
       *     `fever 发烧；发热 ｜ 你的作答 代表；利益 ｜ 第3层 · 圣徒 · 四选一`
       *   —— 三样单独看都对，**拼在一行就矛盾** ✓
       *   病因：`wordText` / `_shown` 是**顶部那道四选一题**的 ✓
       *     而连线画的是皮肤从 `SENSE_WORDS` **另抽**的 3 对 ✓ 两者毫无关系 ✓
       *     → `en`/`zh` 来自前者、`your` 来自后者（玩家点的那个选项）→ 记录自相矛盾 ✓
       *   修：皮肤在连线接管题面**之前**写 `scene._saintLog` ✓ 这里优先读它 ✓
       *   ★ `quiz` 一并改成 `'link'` ✗ —— 原来是 `''` → 总结里显示「四选一」✓ 也是错的 ✓
       *     （总结屏的 `qn` 表要加 `link` 这一项 ✓ 见 SummaryScene）*/
      const sl = scene._saintLog;
      if (sl && (sl.en || sl.zh)) {
        /* ★★★ 2026-09-30：**连对时改记"玩家真正连上的那 3 对"** ✗✗（用户：
         *   "我突然发现圣徒答对的题目也是和我做的题目毫无关联，是否是和之前答错的
         *    题目同一个问题" → 是同一个问题 ✓ 上次只修了一半 ✗）
         *   · `sl.en`（四选一那道题）在连线段是**被隐藏的** ✗ 玩家看不见 ✓
         *   · 他看得见、并且动手连的是 `sl.linked`（3 对熟词生义 ✓）
         *   ⇒ **答对**时 en/zh 改用 `linked` ✓；**答错**时仍用四选一那套 ✓
         *     （错题的看点是"你选错成了什么"✓ 那确实是四选一的 `your` ✓
         *       而对题的看点是"你连对了哪几对"✓ 两者口径本就不同 ✓）
         *   ★ 串成一行显示 ✓ 因为总结屏是"一行一条作答"的版式 ✓
         *     `A→甲 · B→乙 · C→丙`（3 对 ≈ 60~70 字符 ✓ 会折行 ✓ 行高已按实测算 ✓）
         *   ★ 取不到 `linked` 就退回旧行为 ✗ 绝不抛 ✓ */
        let enOut = String(sl.en || '');
        let zhOut = String(sl.zh || sl.correct || '');
        const lk = sl.linked;
        if (ok && Array.isArray(lk) && lk.length) {
          enOut = lk.map(function (p) { return String(p.en || ''); }).join(' · ');
          zhOut = lk.map(function (p) { return String(p.zh || ''); }).join(' · ');
        }
        L.answers.push({
          floor: R.floor,
          enemy: scene._runEnemy || '',
          quiz: 'link',                    // ★ 归到「连线」
          en: enOut,
          zh: zhOut,
          your: String(sl.your || ''),
          ok: ok ? 1 : 0,
        });
        if (ok && scene.combo > (L.maxCombo || 0)) L.maxCombo = scene.combo;
        scene._saintLog = null;            // ★ 用完即清 ✓
        return;
      }
      if (quiz) {
        en = String(scene._target || '').replace(/[^A-Za-z]/g, '');
        zh = shownText;
      } else {
        en = shownText;
        const arr = scene._shown || [];
        const ci = (typeof scene.correctIndex === 'number') ? scene.correctIndex : -1;
        zh = (ci >= 0 && arr[ci] != null) ? String(arr[ci]) : '';
      }
      /* 拼词类（anagram / maskless / rail）：作答＝已拼字母（一定是正确拼写的前缀 ✓）
         四选一：作答＝他点的那个中文释义 */
      let your = '';
      if (quiz) {
        your = (scene._built && scene._built.join) ? scene._built.join('') : '';
      } else if (index >= 0 && scene._shown && scene._shown[index] != null) {
        your = String(scene._shown[index]);
      }
      L.answers.push({
        floor: R.floor,
        enemy: scene._runEnemy || '',
        quiz: quiz,
        en: en,
        zh: zh,
        your: your,
        ok: ok ? 1 : 0,
      });
      if (ok && scene.combo > (L.maxCombo || 0)) L.maxCombo = scene.combo;
    } catch (e) {}
  };

  /* 走到某个节点（包装 NodeEventScene.create 时调用 ✓） */
  R.logNode = function (type, title) {
    try { const L = log(); if (!L) return; L.nodes.push({ floor: R.floor, type: type, title: title }); } catch (e) {}
  };
  R.currentNodeTitle = function () {
    try { const L = log(); return (L && L.nodes.length) ? L.nodes[L.nodes.length - 1].title : ''; } catch (e) { return ''; }
  };

  /* 获得藏品（GrantCollectible 里调用 ✓ 自动带当时所在节点 ✓） */
  R.logGain = function (id) {
    try { const L = log(); if (!L || !id) return; L.gained.push({ id: id, node: R.currentNodeTitle() }); } catch (e) {}
  };
  R.logTradeOut = function (id) {
    try { const L = log(); if (!L || !id) return; L.tradedOut.push(id); } catch (e) {}
  };

  /* ★★★ 本场"藏品/机制贡献"的累计上报（2026-09-26 用户："结算界面缺的全部加上去"）
   *   由 `CombatScene._endBattle()` 在**胜利结算时**调用一次 ✓
   *   ★ 参数 `s` ＝ `scene._runStats`（本场计数 ✓ 战斗里逐次累加 ✓）
   *   ★ 口径：**只把 >0 的项累进 runLog** ✗ —— 没带的藏品不会在总结里刷一堆 0 ✓
   *   ★ 用**累加**而不是 push 每场 ✗ —— 总结屏要的是"整局总计"
   *     （如"铁络之印 累计反打 42.5 伤害"✓ 比逐场列更可读 ✓）
   *   ★ 键名与 `_runStats` 一一对应 ✓ 新增一项时**两边都要加** ✗（漏一边就静默不显示 ✓）*/
  R.logStats = function (s) {
    try {
      const L = log(); if (!L || !s) return;
      if (!L.stats || typeof L.stats !== 'object' || Array.isArray(L.stats)) L.stats = {};
      const KEYS = ['sealDmg', 'jianko', 'milShield', 'milTurns',
                    'ringBreak', 'fireOut', 'fireBoom', 'bonusTime'];
      for (let i = 0; i < KEYS.length; i++) {
        const k = KEYS[i];
        const v = Number(s[k]);
        if (!isFinite(v) || v <= 0) continue;
        L.stats[k] = (Number(L.stats[k]) || 0) + v;
      }
    } catch (e) {}
  };

  /* 本局用时 */
  R.runElapsedSec = function () {
    const L = log(); if (!L) return 0;
    const end = L.endedAt || Date.now();
    return Math.max(0, Math.round((end - L.startedAt) / 1000));
  };
  R.fmtElapsed = function () {
    const t = R.runElapsedSec();
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    const p2 = function (x) { return x < 10 ? '0' + x : '' + x; };
    return h > 0 ? (h + ':' + p2(m) + ':' + p2(sec)) : (m + ':' + p2(sec));
  };

  /* 本局结束（通关 / 战败 / 中途退出 ✓ 只记第一次 ✓） */
  R.finishRun = function (outcome) {
    try {
      const L = log(); if (!L) return;
      if (L.endedAt) return;
      L.endedAt = Date.now();
      L.outcome = outcome;
    } catch (e) {}
  };
})();
