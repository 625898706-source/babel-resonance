/* ============================================================================
 * CombatScene.js —— 词战（战斗）场景
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 实现"普通作战"的基础战斗（其它变式在此基础上改数值）：
 *   1) 中间是 E-Ink 纸卡：显示一个英语词；
 *   2) 纸卡下是 4 个中文选项（1 对 3 干扰）；
 *   3) 倒计时（随层数/节点类型变化）；
 *   4) 选对 → 敌人扣血；选错 / 超时 → 敌人攻击、玩家（目标生命值）扣血；
 *   5) 敌人血归零 → 胜利；玩家生命归零 → 本局失败。
 *
 * 【变式说明】
 * emergency(紧急)/rare(残响之隙)/boss(险路恶敌) 都在此基础上调整数值：
 *   紧急：倒计时更短、攻击更高；BOSS：血更厚、倒计时更短；残响之隙：血更厚、奖励更高。
 * ----------------------------------------------------------------------------
 * 【如何扩展】
 * 数值都从 Babel.FLOORS[层].combat 读，再按节点类型乘系数。要改难度只需改常量。
 * ========================================================================== */

window.Babel = window.Babel || {};

class CombatScene extends Phaser.Scene {
  constructor() { super('Combat'); }

  init(data) {
    // ★★ 每场战斗开始必须重置“本场一次性”标记 ✗
    //   原因：**Phaser 的场景实例是复用的** ✓（同一实例只重跑 init/create ✓）
    //   → 写在实例上的标记会**跨战斗残留** ✗✗（用户实测：空页只在本局第一场生效 ✗）
    //   → 所有“每场一次”的标记都必须在 **init() 里重置** ✓（init 在 create 之前跑 ✓ 每场一次 ✓）
    this._kongyeDone = false;      // 空页（40）：本场第 1 题倒计时翻倍的一次性标记
    this._wrongStreak = 0;         // 静默之环（33）：连错计数（待接）
    this.nodeId = data.nodeId;
    this.testType = data.testType || null;   // 测试模式：直接指定战斗类型（如 ordinary/emergency/rare/boss）
    this.testEnemyIndex = (data.enemyIndex != null) ? data.enemyIndex : null; // 指定敌人（变体池第几个）
    this._isTest = !!this.testType;
    // 当前处于"答题可作答"状态
    this.answering = true;
  }

  create() {
    const C = Babel.COLORS.DARK, P = Babel.COLORS.PAPER;

    // ★★ 关键修复：根治 "Cannot read properties of null (reading 'cut')" 整局卡死 ★★
    // Phaser 的 scene.start() 会**复用同一个 Scene 实例**：上一场"按条件创建"的显示对象
    // （只有安多恩建 enemyStatusText、只有里恩建 _lienReplica、只有皇帝利刃建 _trialHint…）
    // 在场景 shutdown 时已被销毁——Phaser 的 Text.destroy() 会销毁它自己的 CanvasTexture，
    // 该纹理的 Frame 被 Frame.destroy() 把 data 置为 null——但这些引用仍残留在 this 上成"僵尸引用"。
    // 本场若不重建，之后对僵尸对象 setText() → Text.updateText() → frame.setSize()
    // → 读 null.data.cut → 抛 "Cannot read properties of null (reading 'cut')" → 整局卡死。
    // 实测规律：第一层 BOSS 是安多恩（有圣环→建过 enemyStatusText）→ 第二层第一战必卡；
    //           是皇帝利刃（无圣环→从未创建）→ 不卡。
    // 结论：**凡"按条件创建、之后只做真值判断"的显示对象引用，都必须在 create() 开头清空。**
    this.enemyStatusText = null;    // 仅安多恩(shield)创建
    this._shieldHint = null;        // 仅安多恩(shield)创建
    this._lienReplica = null;       // 仅里恩(lien)创建
    this._trialHint = null;         // 仅皇帝利刃(trial)创建
    this._maskSentenceText = null;  // 仅无面者(maskless)创建
    this._bannerText = null;        // phaseBanner 台词（跨场残留）
    this._bannerTween = null;
    this._builtTexts = null;        // 拼词"已拼字母"文本（可能已被销毁）
    this._railBuiltTexts = null;    // 轨道"已拼字母"文本（同上）
    this._builtBoxes = [];
    this._railBoxes = [];
    this._anagramLetters = [];
    this._railLetters = [];
    // —— 幽影「静默回响」专属（silence）：同样必须清空，否则上一场残留 →
    //    旧定时器会去淡出"这一场"的字母（幽灵消散）/旧文本引用成僵尸引用。
    this._silenceLetters = [];     // 逐字母显示对象
    this._silenceTimers = [];      // 消散定时器（换题必须先 remove）
    this._silenceOrder = [];       // 消散顺序（阶段一 右→左；阶段二 两端→中间）
    this._silenceEatenFlags = [];  // 每个位置是否已被吃掉（供"答错额外吃一个"与加成判定）
    this._silenceEaten = 0;
    this._silenceTotal = 0;
    this._silenceRang = false;     // 本词是否已"空响"（音效/震屏只一次）
    this._silencePhase2 = false;   // 二阶段（HP ≤ 50%）：两端消散 + 加速 + 26 键默写
    this._silenceRemain = null;    // 每个字母"还需要用几次"（块按次数消耗：去重块可复用、幽灵字母永不禁用）
    this._silenceCell = 0;         // 进度位格子边长（原位结构：格子在"词消失那一行"）
    this._silenceRowY = 0;         // 进度位/消散字母所在行的 y
    this._silenceFont = 0;         // 进度位里的字母字号
    this._silenceSlotX = [];       // 每个格子的中心 x（消散字母与已拼字母共用）

    this.cameras.main.setBackgroundColor(C.bg);
    Babel.UI.atmosphere(this);   // 深色图书馆 + 烛光 + 暗角 + 纸纹
    this.width = this.scale.width;
    this.height = this.scale.height;

    // 取得本节点类型与数值（测试模式：直接用指定类型）
    if (this.testType) {
      this.type = this.testType;
      this.node = null;
    } else {
      const graph = Babel.RunState.getFloorGraph();
      this.node = graph ? graph.nodes.find(n => n.id === this.nodeId) : null;
      this.type = this.node ? this.node.type : 'ordinary';
    }
    const cfg = Babel.RunState.getFloorConfig().combat;

    // 该节点的战斗参数（按类型取值 + 藏品加成）
    const t = cfg.types[this.type] || cfg.types.ordinary;
    // ★ 基础攻击力：全局唯一真源 `Babel.BATTLE.baseDamage`（恒为 1，不随层数变化）。
    //   `cfg.correctDamage` 只是**兼容旧配置的可选覆盖**（当前各层都不再写）。
    //   末尾的兜底必须有：一旦算出 NaN/0，`enemyHP -= dmg` 会让血量变 NaN → 战斗永不结束（软锁）。
    const baseDmg = (cfg.correctDamage != null) ? cfg.correctDamage : Babel.BATTLE.baseDamage;
    this.correctDmg = baseDmg + Babel.TotalEffect('correctDamage');   // 藏品：巨力之页/慢火/晨读羽笔（求和叠加）
    if (!isFinite(this.correctDmg) || this.correctDmg <= 0) this.correctDmg = Babel.BATTLE.baseDamage;

    // 先解析敌人定义（支持 BOSS 变体池随机取一；测试可指定具体某个；后续每层可各自定制敌人/数值/词难度）
    let enemyDef;
    if (t.enemies && t.enemies.length) {
      const picked = (this.testEnemyIndex != null && this.testEnemyIndex < t.enemies.length)
        ? this.testEnemyIndex : Math.floor(Math.random() * t.enemies.length);
      enemyDef = t.enemies[picked] || t.enemies[0];
    } else {
      enemyDef = t.enemy || { spriteKey: 'portrait-foe', name: '词条投影', displayW: 130, displayH: 180 };
    }
    // ★ 视觉皮肤（per-enemy）—— **必须在任何绘制之前定好**（左立绘在本行之后立刻创建，
    //   之前把它放在 _enemyMechanics 那里 → 左立绘走了 E3 分支、只有右立绘换皮，踩过）。
    //   只有亚当重锤写 skin:'nightcity'；其它敌人该字段为空 → 所有皮肤分支都不进。
    this._skin = enemyDef.skin || '';
    this.enemyDef = enemyDef;   // ★ 把当前敌人配置存到场景上（2026-09-21 ✓ 皮肤/机制要读它 ✓ 纯新增 ✓ 原有代码无人读此字段 ✓）

    // 战斗数值：用类型默认值，但可按单个敌人覆盖（per-enemy，如皇帝利刃指定 HP24/攻击2/倒计时12）
    this.enemyHP = (enemyDef.enemyHP != null) ? enemyDef.enemyHP : t.enemyHP;
    this.wrongDmg = (enemyDef.attack != null) ? enemyDef.attack : t.attack;
    this.timeLimit = ((enemyDef.timeLimit != null) ? enemyDef.timeLimit : t.timeLimit) + Babel.TotalEffect('timeLimit')   // 藏品：迅捷之羽/慢一拍/长明灯/缓吐气（求和叠加）
      + (Babel.TotalEffect('milBoost') > 1 ? 3 : 0);   // ★ 军用斯安威斯坦：每题 +3 秒（走独立字段 ✗ 不写进 timeLimit 效果 ✓ 免得被重复计 ✓）
    /* ★★★ 本场"藏品/机制干了多少活"的记账（2026-09-26 用户："结算界面缺的全部加上去"）
     *   全部是**只增不减的计数** ✗ 不参与任何战斗逻辑 ✓ 结算时汇总上报 ✓
     *   ★ 每场**必须清零** ✗ —— 场景实例在 scene.start 之间复用 ✓（同 `_dodged` 纪律 ✓）
     *   ★★★ **必须在 `create()` 最前面建** ✗✗ —— 因为 L140 那行 `bonusTime` 就要用它 ✓
     *     我第一次把它建在 L167（＝`timeLimit` 之后 ✗）→ `this._runStats.bonusTime` 抛 TypeError ✓
     *     ⇒ 教训：**"这个对象在哪儿建"要和"谁最早用它"对齐** ✗ 不是按逻辑分组摆 ✓*/
    this._runStats = {
      sealDmg: 0,      // 铁络之印：答错反打累计伤害
      jianko: 0,       // 缄口：挡下的受击次数
      milShield: 0,    // 军用斯安威斯坦：技能给的临时生命总量
      milTurns: 0,     // 军用斯安威斯坦：残血 ×1.5 生效的答对次数
      ringBreak: 0,    // 圣徒：圣环破碎次数
      fireOut: 0,      // 奎隆：被治灭的火
      fireBoom: 0,     // 奎隆：烧尽自爆的火
      bonusTime: 0,    // 加时藏品：本场实际给出的秒数（含奎隆 ÷5 后的值）
    };
    this._runEnemy = enemyDef.name || (t.enemy && t.enemy.name) || '';   // ★ 本局总结：记录题目属于哪个敌人
    // ★ 旧钥匙（39）：BOSS 战开局获得 2 点临时生命（未拥有则完全不走这里 ✓ 不影响其它战斗 ✓）
    if (this.type === 'boss') {
      const _kb = Babel.TotalEffect('bossStartTempHp');
      if (_kb > 0) Babel.RunState.tempHP += _kb;
    }
    /* ★ 结算记账：本场加时藏品究竟给了多少秒（2026-09-26）
     *   ★ 含「军用斯安威斯坦」那 +3 ✓ 奎隆的 ×1/5 由皮肤另行上报 ✓
     *   ★ 能安全放在这里，是因为 `this._runStats` 已在**本函数最前面**建好 ✓
     *     （我最初建晚了 → 这一行抛 TypeError ✓ 见上面那段注释 ✓）*/
    this._runStats.bonusTime = Babel.TotalEffect('timeLimit')
      + (Babel.TotalEffect('milBoost') > 1 ? 3 : 0);
    this._baseTimeLimit = this.timeLimit;   // 记住基础倒计时（里恩攻击阶段会临时覆盖成 4/3/2，结束后恢复）
    this._baseWrongDmg = this.wrongDmg;     // 记住基础攻击（里恩攻击阶段会临时降到 1.5，结束后恢复）
    this.enemyMaxHP = this.enemyHP;
    this.combo = 0;                        // 连胜之焰计数（本轮战斗中）
    this._firstDone = false;               // 先声夺人：本场首次答对标记
    this._dodged = false;                  // 恍神：本场首次受击免疫标记
    /* ★ 缄口（2026-09-26 幽影专属藏品 boss-phantom-silence）：本场还剩几次"答错不扣血"
     *   每场开战重置为 effect.value（＝3 ✓）
     *   ★ 必须在这里重置 ✗ —— 场景实例在 scene.start 之间**复用** ✓
     *     （同 `_dodged` / `_breakLoopCount` 的纪律 ✓ 不重置会出现"第二场没免伤"或"免伤跨场累积"✓）
     *   ★ 没带这件藏品时 HasEffect 为假 → 本行只是留个 0 ✓ 零影响 ✓ */
    this._blocksLeft = Babel.HasEffect('blockFirst')
      ? (Babel.TotalEffect('blockFirst') || 0) : 0;
    /* ★ 铁络之印：本场"答错反打"的累计伤害（结算单上报用 ✓ 每场清零 ✓ 同上纪律 ✓）*/
    this._wrongStrikeTotal = 0;
    this._dodgedBy = '';                   // 免伤来源标记（缄口/恍神 → 文案分流用 ✓ 每场清零 ✓）
    /* ★ 烈焚灼息（2026-09-26 塔露拉专属藏品 boss-talulah-ember）：本场连对计数
     *   用作"越烧越旺"的层数 ✓ 答错清零（＝与 combo 同步 ✓）
     *   ★ 必须每场重置 ✗（场景实例复用 ✓ 同 `_dodged` 的纪律 ✓）*/
    this._burnCount = 0;
    /* ★ 军用斯安威斯坦：本场是否已经给过"首次触发的 +2 临时生命"（每场一次 ✓）*/
    this._milTempGiven = false;
    this._isDead = false;                  // 玩家是否已阵亡（测试场景实例会被复用，必须重置）

    // 布局：等比缩放（随窗口变大）+ 整体垂直居中
    const s = Math.max(1, Math.min(this.width / 1280, this.height / 720)); // 缩放系数
    const cx = this.width / 2, cy = this.height / 2;
    const fs = (n) => Math.round(n * s) + 'px';

    // ── 统一页眉（所有战斗共用；只占顶部 52*s，不进入任何机制的题目区）──
    const nt = Babel.NODE_TYPES[this.type] || { label: '', desc: '' };
    const hudH = 52 * s;
    const _hudBg = this.add.rectangle(0, 0, this.width, hudH, Babel.COLORS.CARD_N).setOrigin(0, 0);
    const _hudRule = this.add.rectangle(0, hudH, this.width, Math.max(1, Math.round(1 * s)), Babel.COLORS.INK_N).setOrigin(0, 1);
    // 左：层号黄 pill + 层名 · 节点（对象存进 this._hud，供 NIGHT CITY 皮肤"只重上色"用）
    const _hudPill = this.add.rectangle(20 * s, hudH / 2, 84 * s, 26 * s, 0xfff44f).setOrigin(0, 0.5).setStrokeStyle(1, Babel.COLORS.INK_N);
    const _hudPillText = Babel.UI.text(this, 62 * s, hudH / 2, 'B' + Babel.RunState.floor + ' / 01',
      { font: Babel.FONTS.display, size: fs(12), color: '#1f2024', origin: [0.5, 0.5] });
    const _fc = Babel.RunState.getFloorConfig();
    const _hudStage = Babel.UI.text(this, 116 * s, hudH / 2,
      '// ' + ((_fc && _fc.name) ? _fc.name : '') + ' · ' + (this._isTest ? nt.desc : nt.label),
      { font: Babel.FONTS.display, size: fs(11), color: C.muted, origin: [0, 0.5] });
    // 右：残页 / 目标生命（标签+数值合并为单行单字体 → 基线天然对齐）+ 返回
    const _hudCur = Babel.UI.text(this, this.width - 244 * s, hudH / 2, '残页 ' + Babel.RunState.currency,
      { font: Babel.FONTS.num, size: fs(15), color: C.fg, origin: [1, 0.5] });
    this._hud = { pill: _hudPill, pillText: _hudPillText, stageText: _hudStage, curText: _hudCur, bg: _hudBg, rule: _hudRule };
    this._hudHP = Babel.UI.text(this, this.width - 386 * s, hudH / 2,
      '目标生命 ' + Babel.fmt1(Babel.RunState.targetHP) + ' / ' + Babel.RunState.maxHP,
      { font: Babel.FONTS.num, size: fs(15), color: C.fg, origin: [1, 0.5] });
    this._backBtn = Babel.UI.button(this, this.width - 66 * s, hudH / 2, 104 * s, 34 * s, '退出',
      () => {
        Babel.UI.confirmQuit(this, () => {
          Babel.PlayMusic(this, Babel.LayerBGM());
          this.scene.start(this._isTest ? 'Test' : 'Start');
        });
      },
      { font: Babel.FONTS.body, size: fs(14), fill: Babel.COLORS.CARD_N, stroke: Babel.COLORS.LINE_N,
        hover: 0xfffbe0, color: '#24252a', lineW: 1, marker: false });

    // 双方立绘（统一样式：深色卡 + 角色 + 名字 + 血条 + 血量文字；敌人镜像面向逻各斯）
    const lp = this._makeBattlePortrait('left', {
      spriteKey: 'logos-idle', name: '逻各斯', nameColor: C.fg,
      displayW: 150, displayH: 196, anim: 'logos-idle-anim', lastFrame: 149,
      barColor: 0x5cc5e8, hpTextColor: C.fg,
      hpLabel: '目标生命',
    }, cx, cy, s);
    this.playerBar = lp.bar;
    this.playerHPText = lp.hpText;
    this.playerBar.setRatio(Babel.RunState.targetHP / Babel.RunState.maxHP);

    // 从本层配置读取敌人定义（已在上面解析 enemyDef）
    this._enemyMechanics = enemyDef.mechanics || '';
    // ★ 场景实例在 scene.start 之间是**复用**的：上一场留下的机制状态必须每场清零，
    //   否则"打一场 → 回测试菜单 → 再进"时 _barrageOn 仍为 true → _newWord 直接早退 → 进去就没题、像卡死（踩过）
    this._barrageOn = false;
    this._barrage = null;
    /* ★ 拼词类通用的打字监听也要每场清一次（2026-09-26 起覆盖全部拼词怪 ✗ 不只幽影 ✓）
     *   同样因为场景实例复用 ✓ 绑定处还会 off→on 去重 ✓ 这里只是兜底清 ✓
     *   ★ 键盘提示是**并进 `_anagramHint` 文案**的 ✓ 没有独立对象要销毁 ✓
     *     它在 create() 里重新建 `_anagramHint` 时自然从基文案开始 ✓ */
    if (this._anagramKeyHandler) {
      try { if (this.input && this.input.keyboard) this.input.keyboard.off('keydown', this._anagramKeyHandler); } catch (e) {}
      this._anagramKeyHandler = null;
    }
    this._quiz = enemyDef.quiz || '';   // 作答形式：''=四选一；'anagram'=乱序拼词；'maskless'=无面者
    this._masklessPhase = enemyDef.masklessPhase || null;   // 无面者两阶段配置 {phase2Hp, phase1Time, phase2Time}
    this._enemyShield = (this._enemyMechanics === 'shield');
    this._enemyTrial = (this._enemyMechanics === 'trial');   // 皇帝利刃：义近/形近辨析（专属词库）
    this._enemyTaunts = enemyDef.taunts || [];   // 答错嘲讽台词（per-enemy 配置）
    this._enemyLien = (this._enemyMechanics === 'lien');   // 里恩：循环机制
    this._lienCfg = enemyDef.lien || null;                 // 循环机制配置（命中台词/攻击倒计时等）
    this._lienHit = 0;            // 伤害阶段已累计命中（0~9）
    this._lienAttacking = false;  // 是否处于攻击阶段
    this._lienAttackIdx = 0;      // 攻击阶段第几题（0~8）
    this._bossKey = enemyDef.bossKey || null;   // boss 专属藏品池匹配用（如 andoain/emperor/lien）
    // 幽影：静默回响（字母逐个消散）——per-enemy 门控，绝不影响其它任何战斗
    this._enemySilence = (this._enemyMechanics === 'silence');
    this._silenceCfg = enemyDef.silence || null;
    this._cmdLoopCount = 0;   // 指令机·循环护盾：本场累计答对计数（每场重置，不跨战斗）
    this._breakLoopCount = 0; // 破环之诫：本场连续答对计数（3的倍数触发，每场重置）
    this._wordDifficulty = (t.wordDifficulty != null) ? t.wordDifficulty : cfg.wordDifficulty;
    // 敌人专属 BGM（测试与实战都生效）；无专属则用当前层默认 BGM
    if (enemyDef.bgm) Babel.PlayMusic(this, enemyDef.bgm);
    else Babel.PlayMusic(this, Babel.LayerBGM());
    const enemyCfg = {
      spriteKey: enemyDef.spriteKey,
      name: enemyDef.name,
      nameColor: C.crimson,
      displayW: enemyDef.displayW, displayH: enemyDef.displayH,
      anim: enemyDef.anim, lastFrame: enemyDef.lastFrame,
      flipX: enemyDef.flipX,   // 默认敌人镜像面向逻各斯；置 false 则不镜像（如里恩）
      noCard: enemyDef.noCard, // 透明背景立绘（无黑框）时置 true
      barColor: 0xff625d, hpTextColor: C.fg,
      hpLabel: 'ENEMY HP',
    };
    const ep = this._makeBattlePortrait('right', enemyCfg, cx, cy, s);
    this.enemyBar = ep.bar;
    this.enemyHPText = ep.hpText;
    this.enemyBar.setRatio(this.enemyHP / this.enemyMaxHP);
    this._refreshHpText();

    // BOSS 特有：圣环（mechanics:'shield' 的敌人启用；连续答对 N 题破环、环中免疫、破环那一下不伤害、破环后正常伤害）
    this._isBoss = (this.type === 'boss');
    this.shieldMax = 3;
    this.shieldProgress = 0;   // 当前连续答对数（破环进度）
    this.exposedLeft = 0;      // 破环后"辉光倾泻"剩余题数
    this.shieldBreakCount = 0; // 圣环破碎次数（破 2 次进二阶段）
    this._phase2 = false;      // 二阶段：倒计时 9s、红条、狂暴台词（安多恩圣环）
    this._trialPhase = false;  // 皇帝的利刃二阶段：HP≤8 切换至专属近义词库（只触发一次）
    this._trialPrevWrong = false;  // 二阶段动态难度：上一题是否答错（错→下一题二选一，对→恢复四选一）
    // 敌人上方"转阶段横幅"位置（通用，后续敌人转阶段也用它）
    this._phaseBanner = { x: cx + 500 * s, y: cy - 215 * s, size: fs(30) };
    // 里恩攻击阶段：Furioso-Replica 用"墨色胶囊"呈现（原为大号黑字，改用组件统一）
    if (this._enemyLien && this._lienCfg) {
      this._lienReplica = Babel.UI.chip(this, 0, 0, this._lienCfg.replica || '', null,
        { h: Math.round(38 * s), size: fs(19), fill: Babel.COLORS.INK_N, color: '#f4efe4', stroke: Babel.COLORS.INK_N });
      this._lienReplica.setPosition(cx - this._lienReplica._w / 2, cy - 290 * s).setVisible(false);
    }
    // 圣环状态不再用"浮在立绘旁的纯文字"：改由卡片上方统一槽位的「胶囊 + 方格指示器」呈现
    // （组件见 Babel.UI.chip / Babel.UI.pips；在下面的"机制槽位"处创建）

    // 中间：词卡（索引卡）
    // ★ 坐标语义（务必记住）：Babel.UI.panel 的 (x, y) 是【左上角】，不是中心。
    //   因此卡片范围 = [cardTop, cardTop + cardH]；下面所有内容一律用 cardTop + n*s 定位，
    //   绝不再按"卡片中心"写坐标（曾因此把词条画到卡片外面）。
    // ★ 中栏宽度上限：cardW/2 必须 < 340*s（立绘栏内边缘在 cx±354*s），否则会顶到两侧角色栏。
    //   680/2=340 → 与立绘栏留 14*s 间隙；词条 fs52 在此宽度内不会换行（超长词由两行兜底）。
    const cardW = 680 * s, cardH = 180 * s;
    const cardTop = cy - 215 * s;                 // 卡片上边缘
    const cardBottom = cardTop + cardH;           // 卡片下边缘（= cy - 65*s）
    this._cardY = cardTop;
    this._cardTop = cardTop; this._cardH = cardH;   // 供 _newWord 复用（词条位 = cardTop + 62*s）
    // 编辑风：无边框卡片 —— 仅顶部 2px 墨线 + 底部 1px 细线（容器：_flashCard 的 setAlpha 与隐藏都可用）
    // E3 美术馆展签：卡片去框 —— 只在卡片下沿留一条 1px 黑线（容器便于 _flashCard/二阶段隐藏）
    const _cardBotRule = this.add.rectangle(cx, cardBottom, cardW, Math.max(1, Math.round(1 * s)), 0x111111).setOrigin(0.5, 0.5);
    this.card = this.add.container(0, 0, [_cardBotRule]);
    this._cdTicks = [];          // 倒计时条的刻度线（独立矩形，二阶段必须一起隐藏）
    const cardL = cx - cardW / 2, cardR = cx + cardW / 2;
    // 头行：左=词条标签，右=连击
    this.comboText = Babel.UI.text(this, cardR - 22 * s, cardTop + 22 * s, '',
      { font: Babel.FONTS.num, size: fs(15), color: C.muted, origin: [1, 0.5] });
    // 词条（拉丁优先字体，中文自动回退）——独占卡片中部一条水平带
    this.wordText = Babel.UI.text(this, cx, cardTop + 74 * s, '', {
      font: Babel.FONTS.sign, size: fs(80), color: '#111111', origin: [0.5, 0.5],
    }).setWordWrapWidth(cardW - 80 * s, true);
    // 细分隔线
    this._cardRule = this.add.rectangle(cx, cardTop + 126 * s, cardW - 96 * s, Math.max(1, Math.round(1 * s)), 0xe6e6e6).setOrigin(0.5, 0.5);
    // 提示（四选一/试炼才有；拼词类由各自提示接管）
    this._answerHint = null;
    if (!this._quiz) {
      this._answerHint = Babel.UI.text(this, cardL + 22 * s, cardTop + 144 * s,
        this._enemyShield ? '连续答对题目以击碎圣环' : '选择正确的中文释义',
        { size: fs(13), color: C.muted, origin: [0, 0.5] });
    }
    // 读秒数字（卡片右下，等宽数字）
    this.cdText = Babel.UI.text(this, cardR - 22 * s, cardTop + 144 * s, '',
      { font: Babel.FONTS.num, size: fs(22), color: C.fg, origin: [1, 0.5] });
    // 读秒条：内缩的"仪表条"，贴卡片下缘（刻度线已整体移除，保持干净）
    this.cdBar = this._makeBar(cardL + 20 * s, cardBottom - 18 * s, cardW - 40 * s, 12 * s, 0xf5a623, 0xececec);   // 默认黄（里恩/皇帝利刃会改色）
    // 语境拼词（铁络无面者）：专属句子文本，占"词条"位（不影响其它战斗）
    this._maskSentenceText = null;
    if (this._quiz === 'maskless') {
      // 句子最长可 3 行：字号收到 20、上移到词条带中央，避免压到下方的分隔线
      this._maskSentenceText = Babel.UI.text(this, cx, cardTop + 68 * s, '', {
        font: Babel.FONTS.mixed, size: fs(20), color: P.ink, origin: [0.5, 0.5], bold: true,
      }).setWordWrapWidth(cardW - 80 * s, true);
    }

    // 机制槽位：安多恩【圣环】= 胶囊 + 方格指示器（摆在敌军立绘栏下方）
    this._shieldChip = null; this._shieldPips = null;
    if (this._enemyShield) {
      const chip = Babel.UI.chip(this, 0, 0, '圣环', (this.shieldMax - this.shieldProgress) + '/' + this.shieldMax,
        { h: Math.round(30 * s), size: fs(14), bare: true });
      const pips = Babel.UI.pips(this, 0, 0, this.shieldMax, this.shieldMax - this.shieldProgress,
        { size: Math.round(14 * s), gap: Math.round(4 * s) });
      // 移到【安多恩立绘栏下方】：敌军栏左边缘 = cx + 490*s - 272*s/2，纵向在数值行(cy+134*s)之下
      const gapx = 10 * s;
      const colL = cx + 490 * s - 136 * s;
      const chipY = cy + 170 * s;
      chip.setPosition(colL, chipY);
      pips.setPosition(colL + chip._w + gapx, chipY);
      this._shieldChip = chip; this._shieldPips = pips;
      this._updateBossStatus();
    }
    // 皇帝利刃二阶段提示：红色胶囊
    this._trialHint = null;
    if (this._enemyTrial) {
      this._trialHint = Babel.UI.chip(this, 0, 0, '思维被侵蚀了…', null,
        { h: Math.round(32 * s), size: fs(15), color: '#e2231a', bare: true });
      this._trialHint.setPosition(cx - this._trialHint._w / 2, cy - 254 * s).setVisible(false);
    }

    // 里恩伤害阶段：复刻进度（9 格）——伤害阶段可见、攻击阶段隐藏（改由 Replica 胶囊接管）
    this._lienPips = null;
    if (this._enemyLien && this._lienCfg) {
      const n = this._lienCfg.hitsPerCycle || 9;
      // 里恩专属：进度方格用红色（与圣环一致的机制色；仅里恩，其它战斗不受影响）
      this._lienPips = Babel.UI.pips(this, 0, 0, n, 0, { size: Math.round(18 * s), gap: Math.round(6 * s), onColor: 0xff625d, round: true });
      this._lienPips.setPosition(cx - this._lienPips._w / 2, cy - 252 * s);
    }



    // 4 个中文选项（2×2；键位帽 A/B/C/D，与键盘 1-4 同序）（六选一已于 2026-09-21 回退 ✗ ✓）
    this.optionButtons = [];
    this.optionLabels = ['A', 'B', 'C', 'D'];
    const optW = 320 * s, optH = 84 * s;
    // 内移到中栏（左右各留出 ~22*s），避免压住两侧立绘栏的血条/数值行
    const posX = [cx - 172 * s, cx + 172 * s];
    const posY = [cy + 76 * s, cy + 176 * s];
    this._optPosX = posX; this._optPosY = posY;   // 供 _layoutOptions 重排（试炼二选一时居中）
    for (let i = 0; i < 4; i++) {
      const bx = posX[i % 2], by = posY[Math.floor(i / 2)];
      if (this._skin === 'nightcity' && Babel.SKIN_OptionButton) {
        // 皮肤版选项：与 Babel.UI.row 同构（list[0]=面板/命中，list[1]=文字）→ 既有逻辑不用改
        this.optionButtons.push(Babel.SKIN_OptionButton(this, bx, by, optW, optH, s, () => this._onAnswer(i), i));
      } else {
        this.optionButtons.push(
          Babel.UI.row(this, bx, by, optW, optH, '', '', () => this._onAnswer(i),
            { font: Babel.FONTS.body, size: fs(28), color: '#111111', wrap: true, noKey: true, center: true, accent: 0xe2231a, line: 0xe6e6e6 })
        );
      }
    }

    // 乱序拼词：字母块容器（默认隐藏；anagram/maskless 模式每词重建）
    this._anagramGroup = this.add.container(0, 0).setVisible(false).setDepth(50);
    this._anagramBuiltGroup = this.add.container(0, 0).setVisible(false).setDepth(50);
    this._anagramHint = null;
    if (this._quiz === 'anagram' || this._quiz === 'maskless' || this._quiz === 'rail') {
      this.optionButtons.forEach(b => b.setVisible(false));
      this._anagramGroup.setVisible(this._quiz !== 'rail');   // rail 不用字母块
      this._anagramBuiltGroup.setVisible(this._quiz !== 'rail');
      this._anagramHint = null;
      if (this._quiz !== 'rail') {
        this._anagramHint = Babel.UI.text(this, cx, cy + 88 * s,
          this._enemySilence ? '看一瞬——字母正在消散，还要辨出哪些是假的' : '点击字母拼出英文单词（点错撤销）',
          { size: fs(14), color: Babel.COLORS.MUTED, origin: [0.5, 0.5] }).setDepth(51);
      }
    }

    // 掉落 / 藏品播报
    this.lootText = Babel.UI.text(this, cx, 80 * s, '', { size: fs(16), color: '#0a0b0d', origin: [0.5, 0.5] });   // 让出上方槽位给里恩 Replica

    // 反馈文字
    this.feedback = Babel.UI.text(this, cx, cy + 340 * s, '', { size: fs(22), color: C.fg, origin: [0.5, 0.5] });

    // ── 底部信息栏：分隔线 + 藏品（填满下半屏，且是有用信息；位于所有机制元素之下，不影响任何战斗）──
    const footY = cy + 296 * s;
    this._footObjs = [];   // 底栏对象（塔露拉等占用下半屏的战斗会整体隐藏它）
    this._footObjs.push(this.add.rectangle(cx, footY, cardW, Math.max(1, Math.round(1 * s)), Babel.COLORS.LINE_N).setOrigin(0.5, 0.5));
    this._footObjs.push(Babel.UI.text(this, cx - cardW / 2, footY + 22 * s, '藏品',
      { font: Babel.FONTS.display, size: fs(10.5), color: C.muted, origin: [0, 0.5] }));
    const owned = Babel.RunState.ownedCollectibles || [];
    if (!owned.length) {
      this._footObjs.push(Babel.UI.text(this, cx - cardW / 2 + 44 * s, footY + 22 * s, '（无 · 击败 BOSS 与事件节点可获得）',
        { size: fs(12), color: C.muted, origin: [0, 0.5] }));
    } else {
      let ox = cx - cardW / 2 + 44 * s;
      const shown = Math.min(owned.length, 6);
      for (let i = 0; i < shown; i++) {
        const it = Babel.FindCollectible(owned[i]);
        const nm = (it && it.name) ? it.name : String(owned[i]);
        const c = Babel.UI.chip(this, ox, footY + 22 * s, nm, null, { h: Math.round(24 * s), size: fs(12) });
        this._footObjs.push(c);
        ox += c._w + 8 * s;
        if (ox > cx + cardW / 2 - 60 * s) {
          this._footObjs.push(Babel.UI.text(this, ox, footY + 22 * s, '…',
            { font: Babel.FONTS.num, size: fs(12), color: C.muted, origin: [0, 0.5] }));
          break;
        }
      }
      if (owned.length > shown) {
        this._footObjs.push(Babel.UI.text(this, cx + cardW / 2, footY + 22 * s, '+' + (owned.length - shown),
          { font: Babel.FONTS.num, size: fs(12), color: C.muted, origin: [1, 0.5] }));
      }
    }

    // ── NIGHT CITY 皮肤（只本场）：叠加背景/页眉/底栏/反馈层，并接管词条样式 ──
      if (this._skin === 'saint' && Babel.SKIN_Saint) Babel.SKIN_Saint.build(this, {});   // ★ 圣徒专属皮肤（2026-09-18）
    if (this._skin === 'quilon' && Babel.SKIN_Quilon) Babel.SKIN_Quilon.build(this, {});   // ★ 奎隆专属皮肤「授法」（2026-09-24）
    if (this._skin === 'nightcity' && Babel.SKIN_NightCity) {
      Babel.SKIN_NightCity.build(this, {
        W: this.width, H: this.height, s: s, cx: cx, cy: cy,
        hudH: hudH, cardW: cardW, cardTop: cardTop, cardBottom: cardBottom,
        enemyDef: enemyDef,   // 交给皮肤：二阶段机制（barrage）要用它自己的配置与阈值
      });
      Babel.SKIN_NightCity.styleWord(this, s);
    }

    // 出第一道题
    this._newWord();

    // 窗口/画布尺寸变化 → 重排（战斗数值存于 RunState，重启安全）
    Babel.UI.autoResize(this);
  }

  /* 血条工具：返回 {setRatio}（用 scaleX 收缩，可靠且省性能） */
  _makeBar(x, y, w, h, fillColor, bgColor) {
    const bg = this.add.rectangle(x, y, w, h, bgColor).setOrigin(0, 0.5).setStrokeStyle(1, 0xe6e6e6);
    const bar = this.add.rectangle(x, y, w, h, fillColor).setOrigin(0, 0.5);
    return {
      // 皮肤用：改底与描边（不改 E3 任何默认值；E3 路径不会调用）
      setBg(fill, stroke) {
        bg.setFillStyle(fill);
        if (stroke != null) bg.setStrokeStyle(1, stroke);
        return this;
      },
      setRatio(r) {
        const ratio = Math.max(0, Math.min(1, r));
        bar.scaleX = ratio;
      },
      setColor(c) { bar.setFillStyle(c); },   // 供二阶段等把条变成红色
      setVisible(v) { bg.setVisible(v); bar.setVisible(v); },   // 供 rail 等隐藏倒计时条
      /* ★ 皮肤用：整条上下挪位（2026-09-18 为「圣徒」加 ✓ —— 纯新增方法 ✓
       *   E3 默认路径不会调用它 ✓ 其它战斗零影响 ✓） */
      setY(ny) { bg.setY(ny); bar.setY(ny); },
    };
  }

  /* 统一"战斗立绘牌"（对齐预览稿）：**两侧同宽同高、顶边对齐**，
   * 结构 = 深色图版(272×264) + 名字带(名字/右标签) + 带刻度血条 + 等宽数值行(数值/右标签)
   * side: 'left'(逻各斯) / 'right'(敌人，默认镜像面向逻各斯)
   * cfg: { spriteKey, name, nameColor, displayW, displayH, anim, lastFrame, flipX, barColor,
   *        hpLabel(数值行右侧标签), noCard }
   * 返回 { bar, hpText }（hpText 为等宽数值文本，供 _refreshBars/_refreshHpText 更新） */
  _makeBattlePortrait(side, cfg, cx, cy, s) {
    // ★ NIGHT CITY 皮肤：立绘牌整块换成预合成的全息成品图（只本场；其它战斗走下面的 E3 原路径）
    if (this._skin === 'nightcity' && Babel.SKIN_NightCity) {
      return Babel.SKIN_NightCity.portrait(this, side, cfg, cx, cy, s);
    }
    const px = (side === 'left') ? cx - 490 * s : cx + 490 * s;
    const colW = 272 * s;                 // 两栏同宽（对齐的关键）
    const plateH = 264 * s;               // 两栏同高
    const plateTop = cy - 200 * s;        // 两栏顶边同一条水平线
    const plateCy = plateTop + plateH / 2;
    const dw = cfg.displayW * s, dh = cfg.displayH * s;
    /* ★ 每敌人可选的竖直偏移（设计单位 ✓ 会乘 s）—— 2026-09-18 为「圣徒」加 ✓
     *   原因：它的素材里角色**贴着帧的最上沿**（上边距 0 ✓）→ 按图版中心对齐会顶出图版 ✓
     *   **默认 0** ✓ → 其它敌人的坐标一个像素都不变 ✓✓（不碰"不影响其它战斗"的红线 ✓） */
    const offY = (cfg.offsetY || 0) * s;

    // 深色图版（透明立绘 cfg.noCard=true 如铁络无面者则不画）
    if (!cfg.noCard) {
      Babel.UI.panel(this, px - colW / 2, plateTop, colW, plateH, 0x141519, 0x2a2b30, 4);
      // 左上角标志黄折角（印刷"图版"标记）
      this.add.triangle(px - colW / 2, plateTop, 0, 0, 16 * s, 0, 0, 16 * s, 0xfff44f).setOrigin(0, 0);
    }

    // 角色精灵（敌人默认镜像；cfg.flipX===false 如里恩则保持原朝向）
    let spriteKey = cfg.spriteKey;
    if (!this.textures.exists(spriteKey)) spriteKey = (side === 'right' ? 'portrait-foe' : 'portrait-logos');
    const sp = this.add.sprite(px, plateCy + offY, spriteKey).setDisplaySize(dw, dh);
    if (side === 'right' && cfg.flipX !== false) sp.setFlipX(true);
    if (cfg.anim && this.textures.exists(cfg.spriteKey)) {
      try {
        if (!this.anims.exists(cfg.anim)) {
          this.anims.create({
            key: cfg.anim,
            frames: this.anims.generateFrameNumbers(cfg.spriteKey, { start: 0, end: cfg.lastFrame }),
            frameRate: 30,
            repeat: -1,
          });
        }
        sp.play(cfg.anim);
      } catch (e) { /* 贴图帧异常 → 跳过动画，不崩 */ }
    }

    // 名字带：名字（左） + 小标签（右）
    const nameY = plateTop + plateH + 22 * s;
    Babel.UI.text(this, px - colW / 2, nameY, cfg.name,
      { font: Babel.FONTS.heading, size: (17 * s) + 'px', color: cfg.nameColor, origin: [0, 0.5] });

    // 血条：整栏宽 + 刻度（仪表感）
    const barW = colW, barH = 16 * s;
    const barY = nameY + 26 * s;
    const bar = this._makeBar(px - barW / 2, barY, barW, barH, cfg.barColor, Babel.COLORS.CARD_N);
    for (let i = 1; i < 9; i++) {
      this.add.rectangle(px - barW / 2 + barW * (i / 9), barY, Math.max(1, Math.round(1 * s)), barH - 4 * s,
        0x1f2024, 0.22).setOrigin(0.5, 0.5);
    }

    // 数值行：等宽数值（左） + 标签（右）
    const numY = barY + 22 * s;
    const hpText = Babel.UI.text(this, px - colW / 2, numY, '',
      { font: Babel.FONTS.num, size: (20 * s) + 'px', color: cfg.hpTextColor, origin: [0, 0.5] });
    if (cfg.hpLabel) {
      Babel.UI.text(this, px + colW / 2, numY, cfg.hpLabel,
        { font: Babel.FONTS.display, size: (10 * s) + 'px', color: Babel.COLORS.MUTED, origin: [1, 0.5] });
    }

    return { bar: bar, hpText: hpText };
  }

  /* 选项排布：centerRow=true（试炼二选一）时两个选项单行垂直居中；否则恢复 2×2 栅格 */
  _layoutOptions(centerRow) {
    const s = Math.max(1, Math.min(this.width / 1280, this.height / 720));
    const cy = this.height / 2;
    const X = this._optPosX, Y = this._optPosY;
    if (!X || !Y) return;
    this.optionButtons.forEach(function (btn, i) {
      if (centerRow && i < 2) btn.setPosition(X[i], cy + 126 * s);   // 卡片与底栏之间的居中行
      else btn.setPosition(X[i % 2], Y[Math.floor(i / 2)]);
    });
  }

  /* 出题：抽一个新词，布置选项与倒计时 */
  _newWord() {
    // ★ 弹幕识别阶段（亚当重锤二阶段，src/scenes/mechanics/barrage.js）：
    //   本阶段没有四选一，出题一律跳过。`_barrageOn` 只有该机制会置位，
    //   其它任何战斗都不经过这一行 → 零影响。
    if (this._barrageOn) return;
    /* ======================================================================
     * ★★★ 奎隆一阶段「尼卢火」：**整个火阶段的出题都归皮肤** ✗✗（2026-09-24）
     *   用户两次反馈："点进来以后答案会突然改一下"／"还是有这种情况，先出现几个中文，然后一瞬间会变"
     *   ★ 真因：CombatScene 的普通出题是 **`btn.setVisible(true)` 先显、`btn.list[1].setText()` 后写** ✓
     *     （见本函数下方那段 ✓）→ 只要让普通出题跑起来，就会**先露出上一题的中文再换掉** ✓
     *   ★ 而我原来只挡住了"没有火被点开"（`fireIdle`）✗
     *     还有一条路：**点开火答完 → `_delayedNext` 700ms 后自己调 `_newWord`** ✓
     *     那一刻题还开着 → `fireIdle` 为假 → 放行 → 走了普通出题 → 就是那一瞬 ✓
     *   ★ 所以守卫必须：**整个火阶段一律不走下面的普通出题** ✓ 三种情况：
     *     ① 没有火被点开 → 画空题态（`onWord`）✓
     *     ② 有火开着     → 让皮肤**重新出这道题**（`fireNewWord`）✓
     *     ③ 皮肤异常     → 才允许落到下面（`try` 兜底 ✓ 不留白屏 ✓）
     *   ★ 位置必须在**最前面** ✗ 在抽词之前 —— 否则 `WORDBANK.draw()` 会白抽一个词 ✓
     *     而它会把词记进 `RunState.usedWords` → 污染"一局内不重复"的词表 ✓
     *   ★ `fireStageOn` 只有该皮肤会返回 true ✓ 其它任何战斗都不经过这一行 → 零影响 ✓
     * ==================================================================== */
    if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.fireStageOn
        && Babel.SKIN_Quilon.fireStageOn(this)) {
      if (Babel.SKIN_Quilon.fireIdle && Babel.SKIN_Quilon.fireIdle(this)) {
        if (Babel.SKIN_Quilon.onWord) Babel.SKIN_Quilon.onWord(this);   // 空题态：把画面画对 ✓
        return;
      }
      if (Babel.SKIN_Quilon.fireNewWord && this._cardTop != null) {
        try {
          const _s0 = Math.max(1, Math.min(this.width / 1280, this.height / 720));
          const _fs0 = (n) => Math.round(n * _s0) + 'px';
          if (Babel.SKIN_Quilon.fireNewWord(this, this._cardTop, _s0, _fs0)) return;
        } catch (e) { /* 皮肤出题异常 → 落到下面的普通出题 ✓ 不留白屏 ✓ */ }
      }
    }
    const cfg = Babel.RunState.getFloorConfig().combat;
    const s = Math.max(1, Math.min(this.width / 1280, this.height / 720));   // 缩放（_newWord 需要局部 fs）
    const fs = (n) => Math.round(n * s) + 'px';
    const cy = this.height / 2;   // 中文词框二阶段下移用
    // 题面字号分档：四选一走展签大字；拼词/轨道走小字（中文释义较长，避免溢出卡片）
    this.wordText.setFontSize(this._quiz ? fs(38) : fs(80));
    // 皇帝的利刃：1阶段(24→9血)用普通词库，2阶段(≤8血)用他的专属近义词库；其余敌人恒用普通词库
    // 铁络无面者：两阶段——HP>phase2Hp 用普通拼词(中文释义)；HP≤phase2Hp(最后10血)用专属句子库
    let maskPhase = this._quiz === 'maskless' && this._masklessPhase;
    this._maskPhase2 = !!(maskPhase && this.enemyHP <= this._masklessPhase.phase2Hp);
    // 无面者两阶段倒计时：这里在出题判定前就设好（与 _maskPhase2 用同一 HP 条件，保持一致）
    if (this._quiz === 'maskless') {
      const base = this._maskPhase2
        ? (this._masklessPhase && this._masklessPhase.phase2Time != null ? this._masklessPhase.phase2Time : 16)
        : (this._masklessPhase && this._masklessPhase.phase1Time != null ? this._masklessPhase.phase1Time : 10);
      this.timeLimit = base + Babel.TotalEffect('timeLimit');
    }
    // 首进阶段2：弹横幅提示（只一次）
    if (this._maskPhase2 && !this._maskEnteredP2) {
      this._maskEnteredP2 = true;
      const bp = this._phaseBanner || { x: this.cameras.main.width / 2, y: 120, size: '30px' };
      Babel.UI.phaseBanner(this, bp.x, bp.y, '遗忘向我敞开；你也将沉入其中。', { size: bp.size });
    }
    if (!this._maskPhase2) this._maskEnteredP2 = false;
    let w;
    if (this._quiz === 'maskless') {
      w = this._maskPhase2
        ? Babel.WORDBANK.drawMaskless()          // 阶段2：专属句子库
        : Babel.WORDBANK.draw(Babel.RunState.floor, this._wordDifficulty); // 阶段1：普通词库(中文释义拼词)
    } else if (this._enemySilence) {
      // 幽影「静默回响」：必须排除**过短/字母种类太少**的词
      // （大词库里有 a / i / of / it 这类：进度位只剩一格、字母块只有"1 真 + 4 幽灵"，
      //   拼出来毫无意义 —— 用户 2026-09-13 实测截图暴露的就是抽到 "i"）
      const C2s = this._silenceCfg || {};
      const minL = C2s.minLetters != null ? C2s.minLetters : 5;
      const minD = C2s.minDistinct != null ? C2s.minDistinct : 3;
      w = Babel.WORDBANK.draw(Babel.RunState.floor, this._wordDifficulty, function (en) {
        const s = String(en || '').replace(/[^a-z]/gi, '');
        if (s.length < minL) return false;
        const seen = {}; let d = 0;
        for (let i = 0; i < s.length; i++) { const c = s[i].toLowerCase(); if (!seen[c]) { seen[c] = 1; d++; } }
        return d >= minD;
      });
    } else {
      w = (this._enemyTrial && this._trialPhase)
        ? Babel.WORDBANK.drawTrial()                                     // 皇帝利刃二阶段：专属义近库
        : Babel.WORDBANK.draw(Babel.RunState.floor, this._wordDifficulty);// 其余/一阶段：普通词库
    }
    if (!w) { this._endBattle(true); return; } // 无题可出当作胜利兜底
    this.currentWord = w;

    /* ★ 火阶段的守卫**已在本函数开头统一处理** ✗（见开头那段长注释 ✓）
     *   走到这一行 ⇒ 不是火阶段，或皮肤选择不接手 ✓ 这里**不再需要任何 quilon 分支** ✓
     *   ★ 原来这里还留着第二份守卫 ✗ 它已无作用，但**它之前的 `draw()` 会白抽一个词** ✓ 已删 ✓ */

    // draw() 返回 { en, options, correctIndex }，en 即英文词、zh 为正确释义。
    const anagram = (this._quiz === 'anagram' || this._quiz === 'maskless');
    if (anagram) {
      // maskless：阶段2用句子文本（挖空）；阶段1/anagram：显示中文释义（用 wordText）
      if (this._quiz === 'maskless') {
        this._maskless = true;
        if (this._maskPhase2) {
          if (this._maskSentenceText) this._maskSentenceText.setText(this._maskSentence(w));
          if (this._maskSentenceText) {
        this._maskSentenceText.setFontSize(fs(22));
        this._maskSentenceText.setY(this._cardTop + 72 * s);
        this._maskSentenceText.setVisible(true);
      }
      this.wordText.setVisible(false);   // 句子占题面位；词条隐藏，避免大字压到计时条
          if (this.wordText) this.wordText.setText('');
        } else {
          // 阶段1：普通拼词，显示中文释义（wordText），隐藏句子文本
          if (this.wordText) this.wordText.setText(w.options[w.correctIndex]);
          if (this._maskSentenceText) this._maskSentenceText.setVisible(false);
      this.wordText.setVisible(true);
        }
      } else if (this._enemySilence) {
        // 幽影「静默回响」：**不显示中文释义**——题面就是那个只闪一瞬的英文词（字母行由 _setupSilence 建）
        this._maskless = false;
        if (this.wordText) { this.wordText.setText(''); this.wordText.setVisible(false); }
      } else {
        this._maskless = false;
        this.wordText.setText(w.options[w.correctIndex]);
      }

      // 重置拼词状态：只保留纯字母 a-z（去掉空格/连字符等，避免多出空框/字母对不上）
      this._target = w.en.toLowerCase().replace(/[^a-z]/g, '');
      this._letters = this._target.split('');     // 目标字母序列
      this._built = [];                            // 已拼入的字母
      this._tiles = [];                            // 乱序字母块（{ch, used}）
      if (this._enemySilence) {
        // 幽影「静默回响」：先把"阶段"定下来（阶段二要用 26 键全盘），再决定发什么块
        this._silenceUpdatePhase();
        this._makeSilenceTiles();
      } else {
        const tiles = this._letters.slice();
        for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = tiles[i]; tiles[i] = tiles[j]; tiles[j] = t; }
        this._tiles = tiles.map(ch => ({ ch: ch, used: false }));
      }

      // 拼词 UI：幽影走专属"铅字活字 + 原位进度位"，其余拼词敌人仍用通用 _buildAnagramUI
      if (this._enemySilence) this._buildSilenceBoard(); else this._buildAnagramUI();

      this.correctIndex = -1;   // 拼词没有"选项下标"
      this.answering = true;
      this._bufferUsed = false;
      this._timeLeft = this.timeLimit;   // 每词重新开始计时（拼词错字母会扣减）
    // ★ 空页（40）：本场第 1 题倒计时 ×倍率 —— 只改该题的 _timeLeft ✓ 不动 timeLimit ✓（每场一次 ✓）
    if (!this._kongyeDone) {
      this._kongyeDone = true;
      const _km = Babel.TotalEffect('firstWordTimeMul');
      if (_km > 1) this._timeLeft = this.timeLimit * _km;
    }
      this.feedback.setText('');
      if (this.cdBar && this.cdBar.setColor) this.cdBar.setColor(0xf5a623);
      // 幽影「静默回响」：建字母行 + 起消散时间线，并接管倒计时
      // （放在条色之后调用，否则阶段二的暗红会被上面的默认黄覆盖；_timeLeft 也须在 _startCountdown 前同步）
      if (this._enemySilence) { this._setupSilence(w, s, fs); this._timeLeft = this.timeLimit; }
      this._refreshCombo();
      this._startCountdown();
      return;
    }

    // 轨道接字母（rail）：显示中文释义，接对拼入、接错/超时本题判错扣血；无倒计时条
    if (this._quiz === 'rail') {
      this.wordText.setText(w.options[w.correctIndex]);
      this.correctIndex = -1;
      this._target = w.en.toLowerCase().replace(/[^a-z]/g, '');
      this._letters = this._target.split('');
      this._built = [];
      this.answering = true;
      this._bufferUsed = false;
      this.feedback.setText('');
      // 两阶段：HP>11 用 4 竖轨(下落)；HP≤11(二阶段)用 5 横轨(从塔露拉射向逻各斯)
      this._railPhase2 = this.enemyHP <= 12;
      // 二阶段：隐藏顶部大框、下移中文词（腾出上方给横轨）；一阶段恢复
      if (this.card && this.card.setVisible) this.card.setVisible(!this._railPhase2);
      if (this._cardRule) this._cardRule.setVisible(!this._railPhase2);
      if (this.comboText) this.comboText.setVisible(!this._railPhase2);   // 卡片隐藏时连击也不该残留

      // 塔露拉用下半屏放轨道/单词框：隐藏底部藏品栏，避免重叠
      if (this._footObjs) this._footObjs.forEach(function (o) { if (o && o.setVisible) o.setVisible(false); });
      if (this.wordText) {
        this.wordText.setVisible(true);
      this.wordText.setFontSize(this._railPhase2 ? fs(30) : fs(52));   // 二阶段降到 30（轨道下方的辅助读数）
      this.wordText.setY(this._railPhase2 ? cy + 148 * s : (this._cardTop + 74 * s));   // 二阶段：抬到轨道下方、单词框上方
      }
      // 隐藏倒计时条与数字（rail 用轨内超时，不用全局倒计时条）
      if (this.cdBar && this.cdBar.setVisible) this.cdBar.setVisible(false);
      if (this.cdText) this.cdText.setVisible(false);
      this._refreshCombo();

      this._buildRailUI();          // 初始化轨道并开始第一波
      return;
    }

    // 显示英语词
    this.wordText.setText(w.en.toLowerCase());

    // 二阶段(试炼)动态难度：上一题答错 → 本词二选一；答对 → 恢复四选一。其余恒为四选一。
    const twoChoice = this._enemyTrial && this._trialPhase && this._trialPrevWrong;
    let shown, correctIdx;
    if (twoChoice) {
      // 只留「正确释义 + 1 个近义干扰」两个选项
      const zh = w.options[w.correctIndex];
      const others = w.options.filter(function (_, i) { return i !== w.correctIndex; });
      const pick = others[Math.floor(Math.random() * others.length)];
      const arr = [zh, pick];
      if (Math.random() < 0.5) arr.reverse();
      shown = arr;
      correctIdx = arr.indexOf(zh);
    } else {
      shown = w.options;
      correctIdx = w.correctIndex;
    }
    this.correctIndex = correctIdx;
    /* ★ 本局总结（2026-09-18）：把「当前题目」与「屏幕上显示的选项」存到实例上 ✓
     *   只存不判 ✗ 不参与任何逻辑 ✓ 供 RunState.logAnswer 读取 ✓ */
    this._shown = shown;   // ★ _curWord 已挪到 _newWord 开头统一存 ✓

    // 配置 4 个选项按钮：只显示并启用前 shown.length 个，其余隐藏+禁用
    for (let i = 0; i < 4; i++) {
      const btn = this.optionButtons[i];
      const r = btn.list[0];
      if (i < shown.length) {
        btn.setVisible(true).setAlpha(1);
        btn.list[1].setText(shown[i]);   // 键位帽已单独绘制（A/B/C/D），此处只放释义
        // 上一词被 disableInteractive() 禁用（input 仍在，仅 enabled=false）→ 直接重新启用
        if (r && r.input) r.input.enabled = true;
      } else {
        btn.setVisible(false);
        if (r && r.disableInteractive && r.input && r.input.enabled) r.disableInteractive();
      }
    }

    // 选项排布：四选一 = 2×2；试炼二选一 = 单行垂直居中（否则下方空一行很难看）
    this._layoutOptions(!!twoChoice);

    // 重置状态与反馈、启动倒计时
    this.answering = true;
    this._bufferUsed = false;   // 从容之印：每词可有一次缓冲
    this.feedback.setText('');
    // 里恩攻击阶段：按提问序号设定倒计时(前3题4s/中3题3s/后3题2s)与对应条色(浅红/红/深红)；伤害阶段恢复基础倒计时+琥珀条
    if (this._enemyLien && this._lienCfg) {
      if (this._lienAttacking) {
        const atk = this._lienCfg.attack;
        const idx = Math.min(this._lienAttackIdx, atk.countdowns.length - 1);
        this.timeLimit = atk.countdowns[idx];   // 里恩攻击阶段：专属节奏，不受加时藏品影响
        if (this.cdBar && this.cdBar.setColor && atk.barColors) this.cdBar.setColor(atk.barColors[Math.min(this._lienAttackIdx, atk.barColors.length - 1)]);
        // 逐段增强的屏幕震动（每轮循环由最弱档重新开始）
        const si = atk.shakeIntensities[Math.min(this._lienAttackIdx, atk.shakeIntensities.length - 1)];
        const sd = atk.shakeDurations[Math.min(this._lienAttackIdx, atk.shakeDurations.length - 1)];
        this.cameras.main.shake(sd, si);
        // 出题瞬间播放攻击音效（独立 SFX，不打断背景 BGM）
        if (this.sound && this.sound.play) this.sound.play('sfx-lien-attack', { volume: 0.6 });
      } else {
        this.timeLimit = this._baseTimeLimit;
        if (this.cdBar && this.cdBar.setColor) this.cdBar.setColor(0xf5a623);   // 恢复默认黄（里恩攻击阶段结束）
      }
    }
    this._refreshCombo();
    this._timeLeft = this.timeLimit;   // 每词开始重置剩余时间（timeLimit 已在开头按阶段+藏品设好）
    // ★ 空页（40）：本场第 1 题倒计时 ×倍率 —— 只改该题的 _timeLeft ✓ 不动 timeLimit ✓（每场一次 ✓）
    if (!this._kongyeDone) {
      this._kongyeDone = true;
      const _km = Babel.TotalEffect('firstWordTimeMul');
      if (_km > 1) this._timeLeft = this.timeLimit * _km;
    }
    this._startCountdown();
    // ★ NIGHT CITY 皮肤（只本场）：重置选项外观 + 播放"逐字解码"入场
      if (this._skin === 'saint' && Babel.SKIN_Saint) { Babel.SKIN_Saint.resetOptions(this); Babel.SKIN_Saint.onWord(this); }   // ★ 圣徒皮肤
    if (this._skin === 'quilon' && Babel.SKIN_Quilon) { Babel.SKIN_Quilon.resetOptions(this); Babel.SKIN_Quilon.onWord(this); }   // ★ 奎隆皮肤「授法」
    if (this._skin === 'nightcity' && Babel.SKIN_NightCity) {
      Babel.SKIN_NightCity.resetOptions(this);
      Babel.SKIN_NightCity.onWord(this);
    }
  }

  /* ===== 铁络无面者：语境挖空句子 =====
   * 把句子里目标词替换成"首字母 + 下划线"，其余保留，供玩家据上下文拼词。 */
  _maskSentence(w) {
    const en = w.en.toLowerCase().replace(/[^a-z]/g, '');
    if (!en || !w.sentence) return '';
    const masked = en[0] + '_'.repeat(Math.max(0, en.length - 1));
    // 先尝试原样英文词替换；再尝试忽略大小写替换句中出现的词形（loose）
    let s = w.sentence;
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (s.toLowerCase().indexOf(en) >= 0) {
      // 直接替换该词（不区分大小写，保留句子的其余部分）
      const idx = s.toLowerCase().indexOf(en);
      s = s.slice(0, idx) + masked + s.slice(idx + en.length);
    } else {
      // fallback：按首字母所在词替换（一般都能直达上面分支）
      const m = s.match(new RegExp('\\b' + esc(en[0]) + '[a-z]*', 'i'));
      if (m) s = s.slice(0, m.index) + masked + s.slice(m.index + m[0].length);
    }
    // 句首大写、句尾补句号（规范化显示；原文未必有此格式，这里统一）
    s = s.trim();
    if (s.length > 0) s = s[0].toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s = s + '.';
    return s;
  }

  /* ===== 乱序拼词（anagram）===== */
  _buildAnagramUI() {
    const self = this;
    const cx = this.width / 2, cy = this.height / 2;
    const s = Math.max(1, Math.min(this.width / 1280, this.height / 720));
    const fs = (n) => Math.round(n * s) + 'px';
    // 清空旧字母块与已拼区
    this._anagramGroup.removeAll(true);
    this._anagramBuiltGroup.removeAll(true);
    this._anagramLetters = [];
    this._builtBoxes = [];   // 已拼方框（含坐标，供逐格填字母）

    // 已拼区域（词卡下方一行空格，随拼随填；在倒计时条上方）
    const cell = 52 * s;
    this._builtY = cy + 10 * s;   // 卡片变大后下移，避免压到卡片下边缘   // 已拼方框 y（置于词文字下方、倒计时条上方）
    const builtStartX = cx - this._letters.length * cell / 2 + cell / 2;
    this._builtBoxes = [];
    for (let i = 0; i < this._letters.length; i++) {
      const bx = builtStartX + i * cell;
      // 方框直接放 scene 顶层（不加容器），用绝对坐标 + origin 0.5，避免容器坐标偏移
      const box = this.add.rectangle(bx, this._builtY, cell - 6 * s, cell - 6 * s, 0xf7f7f7).setStrokeStyle(1, 0xcfcfcf);
      // ★ 显式补一条**下边线**（2026-09-18 用户：这种 1px 描边的格位下沿会被抗锯齿吃掉 ✗）
      //   与字母块同一手法 ✓ 不换样式、不动结构 ✓ 只保证第四条边一定在 ✓
      const eW = Math.max(1, Math.round(1 * s));
      this.add.rectangle(bx, this._builtY + (cell - 6 * s) / 2, cell - 6 * s + eW, eW, 0xcfcfcf);
      this._builtBoxes.push({ x: bx, y: this._builtY, rect: box });
    }

    // 乱序字母块（下方，再往下移；加大；长词自动换行成多行，避免超出屏幕）
    const gap = 10 * s;
    const laneW = 660 * s;
    const n = this._tiles.length;   // ★ 必须先取数量再算块宽（顺序颠倒会 TDZ 报错导致战斗卡死）
    // 块宽按词长自适应：优先保证【单行】放下（中栏可用宽 660*s）
    const tileSize = Math.max(40 * s, Math.min(68 * s, Math.floor((laneW - (n - 1) * gap) / n)));
    // 每行最多放的块数（按屏幕宽 & 保证不超屏）
    const maxPerRow = Math.max(1, Math.floor((laneW + gap) / (tileSize + gap)));   // 一行放得下就不换行
    const cols = Math.min(n, maxPerRow);
    const rows = Math.ceil(n / cols);
    const rowW = cols * tileSize + (cols - 1) * gap;
    const startX = cx - rowW / 2 + tileSize / 2;
    this._anagramS = s;   // 供 _renderBuilt 用同一缩放，避免全屏后字号与方框错位
    this._tileStartY = cy + 150 * s;   // 字母块下移（提示文字下方，填满中栏下半，不触底栏）
    this._tileSize = tileSize; this._tileGap = gap;
    this._tiles.forEach((t, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const bx = startX + col * (tileSize + gap);
      const by = this._tileStartY + row * (tileSize + gap);
      const btn = this.add.container(bx, by);
      const r = this.add.rectangle(0, 0, tileSize, tileSize, 0xffffff).setStrokeStyle(1, 0xcfcfcf);   // 拼词格子（浅边）
      const tx = this.add.text(0, 0, t.ch, { fontFamily: Babel.FONTS.sign, fontSize: fs(34), color: '#111111' }).setOrigin(0.5);
      // ★ 显式补一条**下边框**（2026-09-18 用户：方框只有三条边 ✗）：
      //   1px 描边在缩放画布上其下沿会被抗锯齿吃掉 ✓ → 单独画一条实线保证第四条边一定在 ✓
      //   颜色/粗细与其余三边一致 ✓ 观感不变 ✓ 只让框闭合 ✓
      const rb = this.add.rectangle(0, tileSize / 2, tileSize + Math.max(1, Math.round(1 * s)), Math.max(1, Math.round(1 * s)), 0xcfcfcf);
      btn.add([r, tx, rb]);
      r.setInteractive({ useHandCursor: true });
      r.on('pointerup', () => self._onLetter(i));
      this._anagramGroup.add(btn);
      this._anagramLetters.push({ ch: t.ch, used: false, obj: btn, rect: r });
    });
    this._renderBuilt();
    /* ★★ 拼词类通用键盘（2026-09-26）：猎狗pro / 复仇者 / 铁络无面者（两阶段）都走这里 ✓
     *   幽影不走这里（它走 `_buildSilenceBoard` ✓ 那边也调同一个函数 ✓）*/
    this._bindAnagramKeys();
    this._anagramKeyHint();
  }

  _renderBuilt() {
    const self = this;
    const s = this._anagramS || Math.max(1, Math.min(this.width / 1280, this.height / 720));
    // 清掉上一轮的格内文本（独立管理，不进容器，避免容器坐标偏移）
    if (this._builtTexts) this._builtTexts.forEach(t => t && t.destroy());
    this._builtTexts = [];
    // 逐个方框填字母：直接用绝对坐标 + origin 0.5，确保居中在框内
    this._builtBoxes.forEach((box, i) => {
      if (i < this._built.length) {
        // 注意：Phaser 的 add.text 的 style 里没有 origin 字段，必须用 setOrigin() 才能使文本中心对齐框中心
        const t = this.add.text(box.x, box.y, this._built[i],
          { fontFamily: Babel.FONTS.body, fontSize: Math.round(30 * s) + 'px', color: '#24252a', bold: true }).setOrigin(0.5, 0.5);
        t.setDepth(52);
        this._builtTexts.push(t);
      }
    });
    // 标记已用字母块变灰/禁用
    this._anagramLetters.forEach((L, i) => {
      if (L.used) { L.rect.setFillStyle(0xf2f2f2); L.obj.setAlpha(0.35); L.rect.input && (L.rect.input.enabled = false); }
      else { L.rect.setFillStyle(0xffffff); L.obj.setAlpha(1); if (L.rect.input) L.rect.input.enabled = true; }
    });
  }

  /* 点击字母块：正确则拼入；错误则撤销（不改判）；拼完整词→命中 */
  _onLetter(index) {
    if (!this.answering) return;
    const L = this._anagramLetters[index];
    if (!L || L.used) return;
    const want = this._letters[this._built.length];
    if (L.ch === want) {
      if (this._enemySilence && this._silenceRemain) {
        // 幽影：块按"该字母还需要几次"消耗——去重块可重复使用（如 silence 的 e 要用两次），
        // 幽灵字母/全盘里不属于该词的键永不禁用（否则玩家一眼就能认出哪个是假的）
        const n = this._silenceRemain[L.ch];
        if (n != null) {
          this._silenceRemain[L.ch] = Math.max(0, n - 1);
          if (this._silenceRemain[L.ch] <= 0) {
            this._anagramLetters.forEach(function (X) { if (X.ch === L.ch) X.used = true; });
          }
        }
      } else {
        L.used = true;
      }
      this._built.push(L.ch);

      // 进度刷新：幽影走铅字外观的专属刷新（不能同时调 _renderBuilt——那会再画一套灰字并把块刷回白底）
      if (this._enemySilence) this._renderSilenceBuilt(); else this._renderBuilt();
      if (this._built.join('') === this._target) {
        // 拼对了：借 _onAnswer 的正确分支结算（它自己会 stop 倒计时/处理伤害等）。
        // 把 correctIndex 设为 0，用 index=0 触发正确路径。
        this.correctIndex = 0;
        this._onAnswer(0);
      }
    } else {
      // 拼错：该字母不放入（保留可再点），提示"拼写错误"，并**扣减 1 秒**当前剩余倒计时（防穷举）。
      this.feedback.setText('拼写错误，-1 秒').setColor('#ff625d');
      // 先停掉当前倒计时，取"当前剩余秒数"（_timeLeft * (1 - tween.progress)）再减 1 重开。
      if (this.cdTween) this.cdTween.stop();
      if (this._cdJitter) { this._cdJitter.remove(); this._cdJitter = null; }
      const base = (this._timeLeft == null ? this.timeLimit : this._timeLeft);
      const prog = this.cdTween ? this.cdTween.progress : 0;
      const remain = Math.max(0, base * (1 - prog));   // 当前剩余秒数
      this._timeLeft = Math.max(0.5, remain - 1);      // 扣 1 秒，下限 0.5 秒
      this._startCountdown();
    }
  }

  /* 拼对结算：直接借 _onAnswer 的正确分支（在上方 _onLetter 中调用） */

  /* ===== 轨道接字母（rail）=====
   * 单词 N 字母 → 分 N 波；每波 4 条轨道各掉 1 字母（1 正确 + 3 无关干扰）。
   * 玩家点"整条轨道"判定：点对→拼入、进下一波；点错 或 超时(字母落到底)→本题立即判错扣血(无挽回)。
   * 简化实现：字母随 tween 从轨道顶部滑到中部（下落感），用 _railFallTimer 计时超时。 */
  _buildRailUI() {
    const self = this;
    const cx = this.width / 2, cy = this.height / 2;
    const s = Math.max(1, Math.min(this.width / 1280, this.height / 720));
    // 清空旧轨道组
    if (this._railGroup) this._railGroup.removeAll(true);
    this._clearRailTrails();   // ★ 重建轨道前先清掉上一题的火尾（含孤儿对象）
    this._railGroup = this.add.container(0, 0).setDepth(50);
    this._railRects = [];
    this._railLetters = [];
    this._railWave = 0;
    this._railBoxes = [];   // 单词框（逐格填字母）
    const boxCell = 52 * s;
    const boxW = this._letters.length * boxCell;

    if (this._railPhase2) {
      // —— 二阶段：5 条横向轨道，横跨正好在两立绘黑框边线之间（逻各斯框右缘 cx-411*s 到 塔露拉框左缘 cx+421*s）；字母从塔露拉(右)射向逻各斯(左) ——
      // 轨道必须限制在中栏（与词卡同一宽度上限 340*s）：立绘栏内边缘在 cx±354*s，超出会压到框上
      const leftX = this._railLeftX = cx - 340 * s;
      const rightX = this._railRightX = cx + 340 * s;
      this._railStartX = rightX;   // 字母起点（塔露拉侧）
      this._railEndX = leftX;      // 字母终点（逻各斯侧）
      const runW = rightX - leftX; // 轨道长度（横跨两立绘框之间）
      this._railW = runW;
      const boxY = cy + 206 * s;   // 单词框（与上方中文留 10px 间隙，避免压字）
      const boxStartX = cx - boxW / 2 + boxCell / 2;
      for (let i = 0; i < this._letters.length; i++) {
        const bb = this.add.rectangle(boxStartX + i * boxCell, boxY, boxCell - 6 * s, boxCell - 6 * s, 0xf4f4f4);
        this._railGroup.add(bb);
        this._railBoxes.push({ x: boxStartX + i * boxCell, y: boxY, rect: bb });
      }
      this._railYs = [];
      for (let i = 0; i < 5; i++) {
        const by = cy - 115 * s + i * 52 * s;   // 5 条横轨上下排开，间距 52（带不重叠、均匀）
        // T1 火流星：轨道保持极细浅灰线（视觉重量交给"火尾"，轨道退到背景）
        this._railGroup.add(this.add.rectangle((leftX + rightX) / 2, by - 22 * s, runW, 1, 0xdcdcdc).setOrigin(0.5, 0.5));
        this._railGroup.add(this.add.rectangle((leftX + rightX) / 2, by + 22 * s, runW, 1, 0xdcdcdc).setOrigin(0.5, 0.5));
        const letter = this.add.text(rightX, by, '', { fontFamily: Babel.FONTS.body, fontSize: Math.round(36 * s) + 'px', color: '#24252a', bold: true }).setOrigin(0.5, 0.5);
        this._railGroup.add(letter);
        const hit = this.add.rectangle((leftX + rightX) / 2, by, runW, 44 * s, 0x000000, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => self._onRailPick(i));
        this._railGroup.add(hit);
        this._railLetters.push(letter);
        this._railYs.push(by);
      }
      this._railS = s;
    } else {
      // —— 一阶段：4 条细长竖轨（下落），词卡下方 ——
      const railY = cy + 190 * s, railH = 240 * s, railW = 80 * s, gap = 46 * s;
      const totalW = 4 * railW + 3 * gap;
      const startX = cx - totalW / 2 + railW / 2;
      const boxY = cy + 40 * s;
      const boxStartX = cx - boxW / 2 + boxCell / 2;
      for (let i = 0; i < this._letters.length; i++) {
        const bb = this.add.rectangle(boxStartX + i * boxCell, boxY, boxCell - 6 * s, boxCell - 6 * s, 0xf4f4f4);
        this._railGroup.add(bb);
        this._railBoxes.push({ x: boxStartX + i * boxCell, y: boxY, rect: bb });
      }
      for (let i = 0; i < 4; i++) {
        const bx = startX + i * (railW + gap);
        const lineL = this.add.rectangle(bx - railW / 2 + 1, railY, 1, railH, 0x111111).setOrigin(0.5, 0.5);
        const lineR = this.add.rectangle(bx + railW / 2 - 1, railY, 1, railH, 0x111111).setOrigin(0.5, 0.5);
        const lineB = this.add.rectangle(bx, railY + railH / 2 - 1, railW, 2, 0x111111).setOrigin(0.5, 0.5);
        this._railGroup.add(lineL);
        this._railGroup.add(lineR);
        this._railGroup.add(lineB);
        const letter = this.add.text(bx, railY - railH / 2 + 20 * s, '', { fontFamily: Babel.FONTS.sign, fontSize: Math.round(52 * s) + 'px', color: '#111111' }).setOrigin(0.5, 0.5);
        this._railGroup.add(letter);
        const hit = this.add.rectangle(bx, railY, railW, railH, 0x000000, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => self._onRailPick(i));
        this._railGroup.add(hit);
        this._railRects.push(lineL);
        this._railLetters.push(letter);
      }
      this._railY = railY; this._railH = railH; this._railW = railW; this._railS = s;
      this._railRectX = [];
      for (let i = 0; i < 4; i++) this._railRectX.push(startX + i * (railW + gap));
    }
    this._renderRailBuilt();
    this._startRailWave();
  }

  /* 把已拼字母逐格填进单词框（中文下方） */
  _renderRailBuilt() {
    const s = this._railS || Math.max(1, Math.min(this.width / 1280, this.height / 720));
    if (this._railBuiltTexts) this._railBuiltTexts.forEach(t => t && t.destroy());
    this._railBuiltTexts = [];
    (this._railBoxes || []).forEach((box, i) => {
      if (i < (this._built || []).length) {
        const t = this.add.text(box.x, box.y, this._built[i], { fontFamily: Babel.FONTS.body, fontSize: Math.round(28 * s) + 'px', color: '#24252a', bold: true }).setOrigin(0.5, 0.5);
        t.setDepth(52);
        this._railBuiltTexts.push(t);
      }
    });
  }

  /* 开始当前波次：给 4 轨分配字母（1 正确 + 3 无关），字母从顶滑到中部，并起超时计时 */
  _startRailWave() {
    const self = this;
    if (!this._target) return;
    // 按阶段+字母序计算本波时长（毫秒）：
    // 一阶段：第1字母8s，后续5s；二阶段：第1字母6s，后续每字-0.5s，下限2s
    let durMs;
    if (this._railPhase2) {
      durMs = (this._railWave === 0 ? 6000 : Math.max(2000, 6000 - this._railWave * 500));
    } else {
      durMs = (this._railWave === 0 ? 8000 : 5000);
    }
    this._railDurMs = durMs;
    if (this._railWave >= this._letters.length) {
      // 全拼对了→答对（借 _onAnswer 正确分支）
      this.correctIndex = 0;
      this._onAnswer(0);
      return;
    }
    const correctCh = this._letters[this._railWave];
    // 干扰字母数：阶段1竖轨 3 个（共4轨）；阶段2横轨 4 个（共5轨）
    const railCount = this._railPhase2 ? 5 : 4;
    const distractCnt = railCount - 1;
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const others = alphabet.filter(ch => ch !== correctCh);
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = others[i]; others[i] = others[j]; others[j] = t; }
    const distract = others.slice(0, distractCnt);
    // 正确字母随机放一条轨道
    const correctIdx = Math.floor(Math.random() * railCount);
    const distIdx = [];
    for (let i = 0; i < railCount; i++) if (i !== correctIdx) distIdx.push(i);
    const arr = new Array(railCount).fill(null);
    arr[correctIdx] = correctCh;
    distIdx.forEach((di, k) => { arr[di] = distract[k]; });
    this._railCorrectIdx = correctIdx;
    // 展示字母：坐标轨道中心 origin0.5；移动方向按阶段（竖轨下落 / 横轨从左塔露拉侧→逻各斯侧）
    for (let i = 0; i < railCount; i++) {
      const L = this._railLetters[i];
      if (L._railTween) { L._railTween.stop(); L._railTween = null; }
      if (L._trail) L._trail.setVisible(false);   // 上一波火尾先收掉
      if (L._trailTween) { L._trailTween.stop(); L._trailTween = null; }
      L.setText(arr[i]);
      L.setAlpha(1);
      if (this._railPhase2) {
        // 横轨：字以 x 从右(塔露拉)射向左(逻各斯)，y 固定横轨中线（轻微上移补偿文字基线）
        L.y = this._railYs[i] - 2 * this._railS;
        const fromX = this._railStartX;
        const toX = this._railEndX;
        L.x = fromX;
        // A 单层抖焰：字母＝火头，尾巴拖在【右侧来路】（origin 取左端 + 贴图水平翻转，
        //   让"贴字母处最亮、向后渐隐"），并以 0.5s 交替做长度/亮度呼吸
        this._ensureFireTexture();
        if (!L._trail && this.textures.exists('fire-trail')) {
          L._trail = this.add.image(0, 0, 'fire-trail').setOrigin(0, 0.5).setFlipX(true).setDepth(49);
          if (!this._railTrails) this._railTrails = [];
          this._railTrails.push(L._trail);   // ★ 登记：换题时要统一销毁，否则会留下孤儿火尾
        }
        if (L._trail) {
          L._trail.setVisible(true);
          L._trail.setDisplaySize(150 * this._railS, 7 * this._railS);   // 起始：短
          L._trail.setAlpha(0.72);
          L._trail.x = L.x + 16 * this._railS; L._trail.y = L.y;
          if (L._trailTween) { L._trailTween.stop(); L._trailTween = null; }
          L._trailTween = this.tweens.add({
            targets: L._trail,
            displayWidth: 195 * this._railS,      // 150 → 195
            alpha: 1,                             // 0.72 → 1
            duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            delay: i * 130,                       // 五轨相位错开，避免整排同步眨眼
          });
        }
        L._railTween = this.tweens.add({
          targets: L, x: toX, duration: this._railDurMs, ease: 'Linear',
          onUpdate: () => { if (L._trail) { L._trail.x = L.x + 16 * this._railS; L._trail.y = L.y; } },
          onComplete: () => {
            if (L._trail) L._trail.setVisible(false);
            if (L._trailTween) { L._trailTween.stop(); L._trailTween = null; }
          },
        });
      } else {
        // 竖轨：从头顶沿中线竖直落到条底，x 固定轨道中心
        const bx = this._railRectX[i];
        L.x = bx;
        const fromY = this._railY - this._railH / 2 + 20 * this._railS;
        const toY = this._railY + this._railH / 2 - 20 * this._railS;
        L.y = fromY;
        L._railTween = this.tweens.add({ targets: L, y: toY, duration: this._railDurMs, ease: 'Linear' });
      }
    }
    // 超时计时：本波时长内未点对 → 判错
    this.cdTween && this.cdTween.stop();
    if (this._railTimer) this._railTimer.remove();
    this._railTimer = this.time.delayedCall(this._railDurMs, function () {
      self._onRailTimeout();
    });
  }

  /* 点击某条轨道：判定是否选对当前波次的正确字母 */
  /* 清掉本轮所有火尾（换题/重建轨道时调用，避免上一题最后一组火尾残留在画面上） */
  _clearRailTrails() {
    if (!this._railTrails) return;
    this._railTrails.forEach((t) => {
      if (!t) return;
      try { if (t._flickTween) t._flickTween.stop(); } catch (e) {}
      try { t.destroy(); } catch (e) {}
    });
    this._railTrails = [];
    (this._railLetters || []).forEach((L) => { if (L) { L._trail = null; L._trailTween = null; } });
  }

  /* T1 火流星：横向渐变条（左 alpha → 右 alpha），24 段矩形近似渐变（Phaser 矩形不支持渐变） */
  _lavaBar(x, y, w, h, a0, a1, color) {
    const g = this.add.graphics();
    const seg = 24, sw = w / seg;
    for (let i = 0; i < seg; i++) {
      const t = i / (seg - 1);
      g.fillStyle(color == null ? 0xe2231a : color, a0 + (a1 - a0) * t);
      g.fillRect(x + i * sw, y - h / 2, sw + 1, h);
    }
    return g;
  }

  /* 生成"火尾 / 命中橙光"贴图（只生成一次，之后逐波复用） */
  _ensureFireTexture() {
    try {
      if (!this.textures.exists('fire-trail')) {
        const W = 256, H = 16;
        const ct = this.textures.createCanvas('fire-trail', W, H);
        if (ct) {
          const g = ct.getContext();
          const grd = g.createLinearGradient(0, 0, W, 0);
          grd.addColorStop(0, 'rgba(226,35,26,0)');       // 尾尖透明
          grd.addColorStop(0.55, 'rgba(255,120,40,0.35)');
          grd.addColorStop(1, 'rgba(255,190,90,0.85)');   // 贴着火头最亮
          g.fillStyle = grd; g.fillRect(0, 0, W, H);
          ct.refresh();
        }
      }
      if (!this.textures.exists('fire-glow')) {
        const S = 256;
        const ct2 = this.textures.createCanvas('fire-glow', S, S);
        if (ct2) {
          const g2 = ct2.getContext();
          const rg = g2.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
          rg.addColorStop(0, 'rgba(255,170,70,0.85)');
          rg.addColorStop(0.45, 'rgba(255,110,30,0.35)');
          rg.addColorStop(1, 'rgba(226,35,26,0)');
          g2.fillStyle = rg; g2.fillRect(0, 0, S, S);
          ct2.refresh();
        }
      }
    } catch (e) {}
  }

  _onRailPick(idx) {
    if (!this.answering) return;
    if (idx === this._railCorrectIdx) {
      // 拼对当前位置 → 填单词框 → 进入下一波
      this._built.push(this._letters[this._railWave]);
      this._railWave++;
      this._renderRailBuilt();

      // T1 命中反馈：拼对处爆一团橙光（放大 + 淡出后销毁）
      if (this._railPhase2) {
        this._ensureFireTexture();
        const L = this._railLetters[idx];
        if (L && this.textures.exists('fire-glow')) {
          const gl = this.add.image(L.x, L.y, 'fire-glow').setDepth(60)
            .setDisplaySize(70 * this._railS, 70 * this._railS).setAlpha(1);
          this.tweens.add({
            targets: gl, alpha: 0, displayWidth: 170 * this._railS, displayHeight: 170 * this._railS,
            duration: 320, ease: 'Cubic.easeOut', onComplete: () => gl.destroy(),
          });
        }
      }
      if (this._railTimer) { this._railTimer.remove(); this._railTimer = null; }
      this._startRailWave();
    } else {
      // 点错 → 本题立即判错扣血（无挽回）
      this._onRailTimeout();
    }
  }

  /* 超时/选错：本题判错扣血 */
  _onRailTimeout() {
    if (!this.answering) return;
    this.answering = false;
    if (this._railTimer) { this._railTimer.remove(); this._railTimer = null; }
    if (this.cdTween) this.cdTween.stop();
    this.combo = 0;
    const dodged = this._playerHit();
    this.feedback.setText(dodged ? ('错了！' + this._dodgeSuffix()) : '错了！').setColor(Babel.COLORS.RED);
    this._flashCard('#ff625d');
    this._showEnemyTaunt();
    this._updateBossStatus();
    this._refreshCombo();
    this._delayedNext();
  }


  /* 启动本词的倒计时 */
  _startCountdown() {
    const self = this;
    if (this.cdTimer) this.cdTimer.remove();
    if (this.cdTween) this.cdTween.stop();
    if (this._cdJitter) this._cdJitter.remove();   // 二阶段"破碎"倒数条的 0.25s 刷新定时器
    // ★ 奎隆一阶段「尼卢火」（2026-09-24）：**本阶段不起每题倒计时** ✗
    //   时间由**每朵火自己的 20 秒**负责 ✓ 横条也由皮肤按火的剩余驱动 ✓
    //   若这里照常起计时 → ① 到点走 `_doTimeoutReal()`（那条路不清火状态 → "点了没反应" ✓）
    //                            ② 与皮肤抢 `cdBar`/`cdText` ✓
    //   `fireTimed()` 只有该皮肤会返回 true ✓ 其它任何战斗都不经过这一行 → 零影响 ✓
    if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.fireTimed
        && Babel.SKIN_Quilon.fireTimed(this)) {
      this._timeLeft = null;      // 清空基准 ✓ 免得下次进别的阶段时带着脏值 ✓
      return;
    }
    // 剩余基准：默认等于 timeLimit；拼词错字母会扣减 _timeLeft，重开时用它。
    if (this._timeLeft == null) this._timeLeft = this.timeLimit;

    if (this._trialPhase) {
      // 皇帝的利刃二阶段：倒数条变黑；前 7 秒（剩余>3）每 0.1s 随机刷新条与数字（可增可减，营造破碎恐怖感）；
      // 最后 3 秒（剩余≤3）恢复正常读秒（条随进度缩、数字 3→0 并变红），以数字为准判定超时。
      if (this.cdBar && this.cdBar.setColor) this.cdBar.setColor(0x000000);
      this.cdBar.setRatio(1);
      this.cdText.setColor(Babel.COLORS.DARK.muted);   // 每一轮开始恢复原色（灰）
      this.cdText.setText(Math.ceil(this._timeLeft) + '');
      this.cdTween = this.tweens.add({
        targets: { t: 0 }, t: 1, duration: this._timeLeft * 1000, ease: 'Linear',
        onUpdate: function (tw) {
          const rem = self._timeLeft * (1 - tw.progress);
          if (rem <= 3) {   // 最后 3 秒：正常读秒 + 数字变红
            self.cdText.setColor(Babel.COLORS.RED);
            self.cdText.setText(Math.max(0, Math.ceil(rem)) + '');
            self.cdBar.setRatio(Math.max(0, Math.min(1, 1 - tw.progress)));
          }
          // 前 7 秒：数字/条由下方 0.1s 随机刷新接管（这里不干预，避免打架）
        },
        onComplete: function () { self._onTimeout(); },
      });
      // 每 0.1 秒：剩余>3 时随机刷新条与数字；进入最后 3 秒则停掉，交给正常读秒
      this._cdJitter = this.time.addEvent({
        delay: 100, loop: true, callback: function () {
          const prog = self.cdTween ? self.cdTween.progress : 0;
          const rem = self._timeLeft * (1 - prog);
          if (rem <= 3) { if (self._cdJitter) { self._cdJitter.remove(); self._cdJitter = null; } return; }
          self.cdBar.setRatio(Math.random());
          self.cdText.setText(Math.floor(Math.random() * (self._timeLeft + 1)) + '');
        },
      });
      return;
    }

    this.cdBar.setRatio(1);
    this.cdText.setText(Math.ceil(this._timeLeft) + '');
    this.cdTween = this.tweens.add({
      targets: { t: 0 }, t: 1, duration: this._timeLeft * 1000, ease: 'Linear',
      onUpdate: function (tw) {
        self.cdBar.setRatio(1 - tw.progress);
        self.cdText.setText(Math.max(0, Math.ceil(self._timeLeft * (1 - tw.progress))) + '');
      },
      onComplete: function () { self._onTimeout(); },
    });
  }

  /* 玩家点选某个选项 */
  _onAnswer(index) {
    if (!this.answering) return;
    this.answering = false;
    if (this.cdTween) this.cdTween.stop();
    if (this._cdJitter) { this._cdJitter.remove(); this._cdJitter = null; }   // 结束本词，停止破碎随机刷新

    if (index === this.correctIndex) {
      try {
      // 答对：敌人扣血（连击 + 藏品加成）
      this.combo++;
      let bonus = Babel.ComboBonus(this.combo);
      // 先声夺人：本场首次答对 +1
      if (!this._firstDone && Babel.TotalEffect('firstCorrect') > 0) {
        this._firstDone = true;
        bonus += Babel.TotalEffect('firstCorrect');
      }
      // 笔锋偶锋：12% 概率额外 +1
      const critC = Babel.TotalEffect('critChance');
      // 暴击：每件独立掷骰，掷中的加成相加（2026-09-18 用户：概率不可能叠加，勿再求和）
      if (Babel.CritRoll) { const _cg = Babel.CritRoll(); if (_cg > 0) bonus += _cg; }
      // ★ 拼写本（30）：**拼词**战斗答对伤害 +value
      //   ★ 本项目「拼词」有两种 quiz 类型（见 constants.js L195）：
      //       'anagram'（乱序拼词：猎狗pro／复仇者／幽影）＋ 'maskless'（无面者的拼词变体）
      //     —— 2026-09-18 用户提醒：**无面者也算** ✗ 原来只判 anagram → 漏了它 ✓ 已补 ✓
      //   （塔露拉是 'rail' 接字母，用户未点名 → 暂不纳入 ✗）
      if (this._quiz === 'anagram' || this._quiz === 'maskless') {
        const _pb = Babel.TotalEffect('anagramDamage');
        if (_pb > 0) bonus += _pb;
      }
      // ★ 速读者（31）：**真实剩余时间** ≥ 本题一半时答对 → 伤害 +value
      //   ★ 注意：`_timeLeft` 是「本题总时长」（全程不变 ✗）—— 真实剩余要按 **tween 进度**算 ✓
      //      原来我拿 `_timeLeft` 直接比 ✗ → 条件恒成立 → 每次都 +1 ✗（用户实测 2026-09-18）
      const _fastV = Babel.TotalEffect('fastAnswerDamage');
      if (_fastV > 0 && this.cdTween && this.cdTween.progress != null) {
        const _remain = this._timeLeft * (1 - this.cdTween.progress);
        if (_remain >= this._timeLeft * 0.5) bonus += _fastV;
      }
      this._wrongStreak = 0;   // ★ 静默之环（33）用的连错计数：答对即清零 ✓
      /* ★★ 烈焚灼息（2026-09-26 塔露拉专属藏品 boss-talulah-ember）
       *   每次连对往上爬一层 ✓ 伤害 + `gain` ✗ 封顶 `cap` ✓（不封顶＝平方增长 ✗ 已实测否掉 ✓）
       *   ★★ **不能用 `TotalEffect()` 读** ✗✗ —— 踩过的坑：
       *     `Babel.TotalEffect` 的实现是按 **`effect.value`** 求和的 ✓
       *        `sum += c.effect.value;`
       *     而本件用的是 `gain` / `cap` 两个字段 ✗ **没有 `value`** ✓
       *     → 用 TotalEffect 读本件会拿到 **NaN** → 这件藏品永远不生效 ✓
       *   正解：**自己遍历已拥有的藏品，直接读 `gain` / `cap`** ✓（下面的 forEach ✓）
       *   ★ 口径：多件同类时取**最大的 cap**、`gain` 取第一件的（本作同 type 只该有一件 ✓
       *     取 max 是为了"万一以后加了第二件"也不至于变小 ✓）
       *   ★ 用 `Math.max` 而不是直接加 ✗ —— 防御"同一题被重复计入"（正常路径不会 ✓ 但便宜且更稳 ✓）*/
      this._burnCount++;
      let _burnBonus = 0;
      let _burnGain = 0, _burnCap = 0;
      (Babel.RunState.ownedCollectibles || []).forEach(function (id) {
        const c = Babel.FindCollectible(id);
        if (c && c.effect && c.effect.type === 'burnStack') {
          if (!_burnGain) _burnGain = c.effect.gain || 0;
          _burnCap = Math.max(_burnCap, c.effect.cap != null ? c.effect.cap : Infinity);
        }
      });
      if (_burnGain > 0) {
        _burnBonus = Math.round(Math.min(_burnCap, this._burnCount * _burnGain) * 100) / 100;
        bonus += _burnBonus;
      }
      let dmg = this.correctDmg + bonus;
      // 是否真正造成伤害：只有非免疫时才允许后续"加成伤害"叠加（锁血/免疫时 dmg 将被置 0，
      // 任何加成都不得打穿——破环之诫及其它命中加成都必须遵守）。
      let canDamage = true;
      // BOSS / 护盾机制：圣环（连续答对 N 题破环；环中免疫；破环那一下不伤害；破环后正常伤害）
      if (this._enemyShield) {
        if (this.exposedLeft > 0) {
          // 破环后：正常伤害（不再 ×2）
          this.exposedLeft--;
          if (this.exposedLeft === 0) { this.combo = 0; this.shieldProgress = 0; } // 辉光结束，圣环重铸
          this.feedback.setText('辉光倾泻！').setColor('#ff625d');
        } else {
          this.shieldProgress = this.combo;
          if (this.combo >= this.shieldMax) {
            // 破环：这一下不造成伤害；圣环循环继续；第 2 次破环进入二阶段（狂暴化）
            this.shieldBreakCount = (this.shieldBreakCount || 0) + 1;
              this._runStats.ringBreak++;   // ★ 结算记账：圣环破碎次数（2026-09-26）
            dmg = 0; canDamage = false;
            this.exposedLeft = 3;
            this.feedback.setText('圣环破碎！').setColor('#ff625d');
            if (this.shieldBreakCount >= 2) this._enterPhase2();
          } else {
            // 环未破：免疫伤害（显示剩余环数，如 3/3→2/3→1/3→0/3）
            dmg = 0; canDamage = false;
            this.feedback.setText('圣环 ' + (this.shieldMax - this.shieldProgress) + '/' + this.shieldMax).setColor('#f5a623');
          }
        }
      } else if (this._enemyLien && this._lienAttacking) {
        // 里恩攻击阶段：答对也无法造成伤害（免疫），但仍算一次攻击提问
        dmg = 0; canDamage = false;
        this.feedback.setText('你的反击，不过是一段劣质的复刻。').setColor('#ff625d');
      } else {
        this.feedback.setText('正确！').setColor(Babel.COLORS.GREEN);
      }
      // 破环之诫：连续答对达到 3 的倍数(3/6/9...)时，该题伤害 +value（对应圣环"破环"；每场重置）
      // 遵循红线：锁血/免疫(canDamage=false, dmg===0)时不叠加任何加成。
      if (Babel.HasCollectible('boss-andoain-break')) {
        const bk = (Babel.BOSS_COLLECTIBLES || []).find(x => x.id === 'boss-andoain-break');
        const th = (bk && bk.effect.threshold) || 3;
        const val = (bk && bk.effect.value) || 2;
        this._breakLoopCount = (this._breakLoopCount || 0) + 1;
        if (this._breakLoopCount % th === 0 && canDamage) {
          dmg += val;
          if (this.feedback) this.feedback.setText('破环之诫！该题伤害 +' + val).setColor('#9d5cff');
        }
      }
      // 清偿：敌人 HP ≤ threshold 时，最终伤害 ×multiplier（叠完其他所有加成后再乘；锁血/免疫时不生效）
      if (canDamage && Babel.HasCollectible('boss-emperor-clear')) {
        const ex = (Babel.BOSS_COLLECTIBLES || []).find(x => x.id === 'boss-emperor-clear');
        const pct = (ex && ex.effect.thresholdPct) != null ? ex.effect.thresholdPct : 0.30;
        const mul = (ex && ex.effect.multiplier) || 2;
        if (this.enemyMaxHP > 0 && this.enemyHP <= this.enemyMaxHP * pct) {
          dmg *= mul;
          if (this.feedback) this.feedback.setText('清偿！伤害 ×' + mul).setColor('#9d5cff');
        }
      }
      /* ★★★ **最终乘算**（2026-09-26 起是两个来源 ✓）
       *   ① 皮肤可选的**减伤**（奎隆 ✓）：`≤ 1` ✓
       *   ② 藏品「军用斯安威斯坦」的**增伤**（亚当重锤专属 ✓）：目标生命 ≤3 时 `1.5` ✓
       *   ★★ 位置就是这里 ✗ —— 此刻 `dmg` 已经是
       *       「基础伤害 ＋ 所有藏品加成 ＋ 破环之诫/速读者/清偿倍率」全部算完的结果 ✓
       *     所以在此处做乘算，**天然满足"最后判定"** ✓
       *   ★ `Math.max(0.1, …)` 是**唯一的钳制** ✗ —— 防"零伤害"（那会让 BOSS 永远打不死 ✓）
       *   ★ 归一 `r2` 只为"减伤"那条走 ✗（`3 × 0.7 = 2.0999999999999996` ✓ 且跨题累加会越攒越脏 ✓）
       *     ★ 增伤路**不归一** ✗ —— 1.5 是有限小数 ✓ 而归一反而会把 1.5×1.5=2.25 抹成 2.25→2.3 ✓
       *       （用户口径是"最终伤害 ×1.5"→ 要**精确**，不能引入额外取整 ✓）
       *   ★ 与奎隆叠加时是**乘算**：1.5 × 0.7 / 0.6 / 0.5 = 1.05 / 0.90 / 0.75 ✓（符合直觉 ✓）
       *   ★ 走皮肤钩子 ✗ 没有这个钩子的皮肤 → `mul` 恒为 1 → **一个字节都不变** ✓ */
      let dmgMul = 1;
      if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.damageMul) {
        try {
          const m = Babel.SKIN_Quilon.damageMul(this);
          if (isFinite(m) && m >= 0 && m <= 1) dmgMul = m;
        } catch (e) {}
      }
      /* ★ 军用斯安威斯坦：增伤（独立一支 ✗ 不与上面的减伤混在一个变量里 ✓ 免得被 `<=1` 的合法域挡掉 ✓）*/
      let dmgBoost = 1;
      const _milBoost = this._milBoost();
      if (_milBoost > 1) { dmgBoost = _milBoost; this._runStats.milTurns++; }   // ★ 结算记账（2026-09-26）
      if (dmgMul < 1) {
        const before = dmg;
        const r2 = function (x) { return Math.round(x * 100) / 100; };
        dmg = Math.max(0.1, r2(dmg * dmgMul));
        if (dmg < before) this._lastDmgCut = r2(before - dmg);
      }
      if (dmgBoost > 1) dmg = Math.max(0.1, dmg * dmgBoost);
      this.enemyHP -= dmg;
      /* ★★ 皮肤可选钩子：**把实际伤害告诉皮肤** ✗（2026-09-24）
       *   ★ 为什么要在这里发 ✗ —— 只有这里才知道**最终落下的伤害值** ✓
       *     （`onCorrect` 钩子在后面 ✓ 但它拿不到 `dmg` ✗）
       *   ★ 没这个钩子的皮肤 → 一行都不走 ✓ 零影响 ✓ */
      if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.onDamageDealt) {
        try { Babel.SKIN_Quilon.onDamageDealt(this, dmg); } catch (e) {}
      }
      // 里恩伤害阶段：正确作答造成伤害 → 累计命中并说台词（1~9）
      if (this._enemyLien && !this._lienAttacking && dmg > 0) {
        this._lienHit++;
        this._showLienHit();
      }
      // 指令机·循环护盾：本场累计答对 threshold 题 → 获得 value 临时生命（每场重置；通用）
      if (Babel.HasCollectible('boss-lien-command')) {
        const cmd = (Babel.BOSS_COLLECTIBLES || []).find(x => x.id === 'boss-lien-command');
        const th = (cmd && cmd.effect.threshold) || 9;
        const val = (cmd && cmd.effect.value) || 2;
        this._cmdLoopCount = (this._cmdLoopCount || 0) + 1;
        if (this._cmdLoopCount >= th) {
          this._cmdLoopCount = 0;
          Babel.RunState.tempHP += val;
          this._refreshHpText();
          this.feedback.setText('正确！指令机 +' + val + ' 盾').setColor('#9d5cff');
        }
      }
      // 二阶段(试炼)动态难度：答对 → 下一题恢复四选一
      if (this._enemyTrial && this._trialPhase) this._trialPrevWrong = false;
      // 皇帝的利刃二阶段：HP 降到 ≤8 切换至专属近义词库（只触发一次，走 _enterTrialPhase）
      if (this._enemyTrial && !this._trialPhase && this.enemyHP <= 8) this._enterTrialPhase();
      this._flashCard(this._enemyShield && dmg === 0 ? '#5cc5e8' : '#8eef5b');
      // ★ NIGHT CITY 皮肤（只本场）：青闪 + ACCESS GRANTED + 选项发光 + 敌牌 glitch
    if (this._skin === 'saint' && Babel.SKIN_Saint && Babel.SKIN_Saint.onCorrect) Babel.SKIN_Saint.onCorrect(this, index);   // ★ 圣徒：答对鸽群四散（2026-09-21）
      if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.onCorrect) Babel.SKIN_Quilon.onCorrect(this, index);   // ★ 奎隆：金雾脉冲
      if (this._skin === 'nightcity' && Babel.SKIN_NightCity) Babel.SKIN_NightCity.onCorrect(this, index);
      } catch (err) {
        try { console.error('[Combat] _onAnswer correct error', err); } catch (e) {}
        this._endBattle(false);
        return;
      }
    } else {
      // 答错：敌方攻击（"墨渍未干"类"答错后下次答对加成"已随藏品一并移除：该钩子只挂在四选一这条路上，
      //   拼词错字母 / 轨道点错 / 幽影 都走不到，属"不能全机制生效"，故不再保留半个钩子）
      this.combo = 0;
      this.shieldProgress = 0;
      this.exposedLeft = 0;   // BOSS：答错结束暴露/重置盾
      this._breakLoopCount = 0;   // 破环之诫：连击中断 → 计数清零，重新从 3 的倍数计
      this._burnCount = 0;        // ★ 烈焚灼息：断连击 → 层数清零（"你得一直答对"就是这个意思 ✓）
      // 二阶段(试炼)动态难度：答错 → 下一题降为二选一
      if (this._enemyTrial && this._trialPhase) this._trialPrevWrong = true;
      const dodged = this._playerHit();
      this.feedback.setText(dodged ? ('错了！' + this._dodgeSuffix()) : '错了！')
        .setColor(Babel.COLORS.RED);
      this._flashCard('#ff625d');
      // ★ NIGHT CITY 皮肤（只本场）：红闪 + ACCESS DENIED + 选项抖动 + 正确项点亮 + 震屏 + 我牌 glitch
    if (this._skin === 'saint' && Babel.SKIN_Saint && Babel.SKIN_Saint.onWrong) Babel.SKIN_Saint.onWrong(this, index, false);   // ★ 圣徒：答错鸽子收拢染红（2026-09-21）
      if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.onWrong) Babel.SKIN_Quilon.onWrong(this, index, false);   // ★ 奎隆：酒红薄闪
      if (this._skin === 'nightcity' && Babel.SKIN_NightCity) Babel.SKIN_NightCity.onWrong(this, index, false);
      this._showEnemyTaunt();   // 答错嘲讽（随机一句，立绘上方 3 秒）
    }
    this._updateBossStatus();
    this._refreshCombo();
    this._delayedNext();
  }

  /* 超时：若有"从容之印"缓冲则先进入缓冲，否则判错 */
  _onTimeout() {
    if (!this.answering) return;
    if (this._cdJitter) { this._cdJitter.remove(); this._cdJitter = null; }   // 超时即停破碎随机刷新
    // 缓冲（从容之印 1.5s）。此前门槛写死为"必须拥有某一件指定藏品"，会让同类的小缓冲藏品**单独拥有时恒为 0**；
    //   2026-09-14 那件已删除，这里改成按效果类型汇总（行为等价，且不再与某一个 id 耦合）。
    const buff = Babel.TotalEffect('buffer');
    if (buff > 0 && !this._bufferUsed) {
      this._bufferUsed = true;
      const self = this;
      this.feedback.setText('缓冲中…').setColor('#f5a623');
      this.cdText.setText(Math.ceil(buff) + '');
      this.cdTween = this.tweens.add({
        targets: { t: 0 }, t: 1, duration: buff * 1000, ease: 'Linear',
        onUpdate: function (tw) {
          self.cdBar.setRatio(1 - tw.progress);
          self.cdText.setText(Math.max(0, Math.ceil(buff * (1 - tw.progress))) + '');
        },
        onComplete: function () { self._doTimeout(); },
      });
      return;
    }
    this._doTimeout();
  }

  _doTimeout() {
    if (!this.answering) return;
    // 语境拼词（maskless）阶段2（专属句子库）超时：先显示正确单词 2 秒，再扣血；阶段1（普通拼词）直接扣
    if (this._quiz === 'maskless' && this._maskPhase2 && this._target) {
      this.answering = false;   // 防止重复触发
      const self = this;
      // 显示完整正确词（替换回句子挖空处）
      if (this._maskSentenceText) {
        const en = self._target;
        const masked = en[0] + '_'.repeat(Math.max(0, en.length - 1));
        // 直接把句子文本临时替换成"正确答案：xxx"
        this._maskSentenceText.setText('正确答案：' + en);
      }
      this.feedback.setText('超时！').setColor(Babel.COLORS.RED);
      this.time.delayedCall(2000, function () {
        self.answering = true;
        self._doTimeoutReal();
      });
      return;
    }
    this._doTimeoutReal();
  }

  _doTimeoutReal() {
    // ★ NIGHT CITY 皮肤（只本场）：超时也走同一套"答错"反馈
    if (this._skin === 'nightcity' && Babel.SKIN_NightCity) Babel.SKIN_NightCity.onWrong(this, this.correctIndex, true);
    // ★ 奎隆一阶段「尼卢火」（2026-09-24）：超时也要**收掉火的状态** ✗
    //   原来这里只挂了 nightcity ✗ → 火阶段若走到这条路，火的 `open`/`alive` 不被清理 →
    //   与屏幕状态错位 ✓ 用户看到的就是"点了没反应" ✓ 现在补上 ✓
    if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.onWrong) {
      Babel.SKIN_Quilon.onWrong(this, this.correctIndex, true);
    }
    if (!this.answering) return;
    this.answering = false;
    this.combo = 0;
    this.shieldProgress = 0;
    this.exposedLeft = 0;   // BOSS：超时结束暴露/重置盾
    const dodged = this._playerHit();
    this.feedback.setText(dodged ? ('超时！' + this._dodgeSuffix()) : '超时！')
      .setColor(Babel.COLORS.RED);
    this._flashCard('#ff625d');
    this._showEnemyTaunt();   // 超时也触发嘲讽（随机一句，立绘上方 3 秒）
    this._updateBossStatus();
    this._refreshCombo();
    this._delayedNext();
  }

  /* 玩家受击：扣全局目标生命值并更新血条
   *   · 恍神（dodgeFirst）  ：**每场 1 次** —— `this._dodged` 在 create() 里复位 ✓ 是每场不是每局 ✓
   *   · 缄口（blockFirst）  ：**每场 `effect.value` 次**（＝3）
   *   · 铁络之印（wrongStrike）：**在扣你血之前**先给敌人固定伤害
   *     （2026-09-26 铁络无面者专属藏品 ✓ 若这一下把敌人打死 → 本场立即结束，你就不用挨了 ✓）
   *   ★★ **两件免伤是"加算"**（2026-09-26 用户："缄口和恍神是加算（两个一起有就是四次）"）
   *      → 同一场里总计 **1（恍神）＋ 3（缄口）＝ 4 格** 免伤 ✓
   *      → ★★ 实现必须是**顺序消费** ✗ 不能"两件同时生效" ✓
   *         踩过的坑：一开始用两个**独立 `if`** ✗ → 第 1 次受击**两件一起扣**
   *           （`_dodgedBy` 记成 'dodge+block' ✓）→ 结果是 **3 格有效** ✗ 不是 4 ✓
   *         正解：**每格挡一次**，先恍神后缄口 ✓
   *           · 第 1 次：恍神消费掉（缄口不动 ✓）
   *           · 第 2~4 次：缄口各扣 1 格
   *           ⇒ 正好 4 次免伤 ✓ 与用户口径一致 ✓
   *   ★ 只置 dmg = 0，**照常走 takeDamage(0)** ✗ —— 这样血条刷新/`_isDead` 判定
   *     走的是同一条路 ✓（自己提前 return 会漏掉刷新 ✓） */
  _playerHit() {
    /* ★★ 烈焚灼息：**任何一次失败都断连击** → 层数清零
     *   ★ 放这里而不是各个答错分支 ✗ —— `_playerHit()` 是**所有失败路径的唯一出口**
     *     （四选一答错／超时／轨道超时／拼词错／无面者二阶段／里恩攻击阶段／奎隆火自爆 ✓）
     *     放这儿＝一处覆盖全部 ✓ 不用在 7 个地方各写一遍 ✓
     *   ★ 不会有误伤 ✗ —— 三处调用点**全是失败路径** ✓ 没有"答对也调 _playerHit"的情况 ✓
     *   （答对路走的是完全独立的代码 ✓ 到不了这里 ✓）*/
    this._burnCount = 0;
    /* ★★ 铁络之印：**先反打，再挨打**（用户 2026-09-26 选定此顺序 ✓）
     *   ★ 放在 `takeDamage` **之前** ✗ 是刻意的 —— 若这一下把敌人打到 ≤0，
     *     本场立即结束（`_delayedNext` 里已有 `enemyHP <= 0 → _endBattle(true)` ✓），
     *     于是**你就不用挨这一下** ✓ 这件藏品因此自带一点"守" ✓ */
    if (this.enemyHP > 0) this._wrongStrike();
    let dmg = this.wrongDmg;
    if (!this._dodged && Babel.HasEffect('dodgeFirst')) {
      /* 恍神先消费（每场 1 次 ✓ 它是"首次受击"→ 永远排在最前面 ✓）*/
      this._dodged = true;
      dmg = 0;
      this._dodgedBy = 'dodge';
    } else if (this._blocksLeft > 0) {
      /* 恍神已用完 → 缄口接着挡（每场 value 次 ✓）
       *   `else if` 是刻意的 ✗ —— 顺序消费才能拿到"1 + 3 = 4 格" ✓
       *   （用两个独立 `if` 会让两件挤在同一次受击上 → 只剩 3 格 ✗ 实测踩过 ✓）*/
      this._blocksLeft -= 1;
      dmg = 0;
      this._dodgedBy = 'block';
      this._runStats.jianko++;          // ★ 结算记账：缄口挡下的次数（2026-09-26）
    } else {
      this._dodgedBy = '';              // 没挡下 → 清空（免得下一句文案串味 ✓）
    }
    /* ★★ 敌人已被铁络之印打死 → **这一下不扣你的血** ✓（用户选的"先反打"就是为了这个 ✓）*/
    if (this.enemyHP <= 0) dmg = 0;
    const died = Babel.RunState.takeDamage(dmg);
    this.playerBar.setRatio(Babel.RunState.targetHP / Babel.RunState.maxHP);
    this._refreshHpText();
    this._isDead = died;
    /* ★ 军用斯安威斯坦：扣完血后才判定"是否掉到 ≤3"（那时 targetHP 才是新值 ✓）
     *   ★ 放在 `_isDead` 赋值之后、`return` 之前 ✗ —— 阵亡那一刻也能给盾 ✓（不影响胜负判定 ✓）*/
    this._milCheckTemp();
    return this._dodgedBy !== '';
  }

  /* ★★★ 铁络之印（2026-09-26 铁络无面者专属藏品 boss-maskless-seal）
   *   **答错时仍对敌人造成固定伤害** —— 用户口径：
   *     · "固定 1.5，不能和其他藏品叠加" → 只读 effect.value ✗
   *        **不读** correctDamage／连击／先声夺人／暴击／破环之诫／速读者／清偿 ✓
   *        （答对与答错本来就是两条独立的路 ✓ 天然不叠加 ✓）
   *     · "目前只会被奎隆减伤稀释" → 复用下面同一段 `dmgMul` ✓
   *     · "对所有类型战斗触发" → 由 `_playerHit()` 调用 ✓ 它是所有扣血路径的唯一出口 ✓
   *   ★ 没有这件藏品时 `TotalEffect` 返回 0 → **第一行就 return** ✓ 零影响 ✓ */
  _wrongStrike() {
    const base = Babel.TotalEffect('wrongStrike');
    if (!(base > 0)) return;
    let dmg = base;
    /* ★ 复用"最终减伤"——与答对那条路同一段逻辑 ✓
     *   奎隆一/二/三阶段 0.70 / 0.60 / 0.50 → 1.5 × 0.7 = 1.05 等 ✓ */
    let mul = 1;
    if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.damageMul) {
      try {
        const m = Babel.SKIN_Quilon.damageMul(this);
        if (isFinite(m) && m >= 0 && m <= 1) mul = m;
      } catch (e) {}
    }
    if (mul < 1) {
      const r2 = function (x) { return Math.round(x * 100) / 100; };   // 与答对路同一个归一口径 ✓
      dmg = Math.max(0.1, r2(dmg * mul));
    }
    this.enemyHP -= dmg;
    this._refreshBars();                       // 敌人血条立即更新 ✓（平时这条在 _delayedNext 里 ✓）
    this._wrongStrikeTotal = (this._wrongStrikeTotal || 0) + dmg;   // 本场累计（结算单用 ✓）
    this._runStats.sealDmg += dmg;             // ★ 结算记账（2026-09-26 ✓ 与上面同源 ✓）
    /* 皮肤钩子：把伤害告诉皮肤（奎隆的伤害浮字等 ✓ 与答对路同一个钩子 ✓）*/
    if (this._skin === 'quilon' && Babel.SKIN_Quilon && Babel.SKIN_Quilon.onDamageDealt) {
      try { Babel.SKIN_Quilon.onDamageDealt(this, dmg); } catch (e) {}
    }
  }

  /* ★★★ 军用斯安威斯坦（2026-09-26 亚当重锤专属藏品 boss-adam-militech）
   *   用户口径（原话）：
   *     "叫军用斯安威斯坦吧，目标生命≤3时最终伤害*1.5，每题倒计时+3，
   *      且每场首次触发时 +2 临时生命"
   *   ★ 三条拆开看：
   *     ① **最终乘算 ×1.5**（生命 ≤3 时）→ 挂在答对路的"最终乘算"那一段 ✓
   *        ★ 与奎隆减伤**乘算**：1.5 × 0.7 / 0.6 / 0.5 = 1.05 / 0.90 / 0.75 ✓
   *        ★ 同时也作用于「铁络之印」的答错反打（都是"最终乘算" ✓ 口径统一 ✓）
   *     ② **每题倒计时 +3** → `this.timeLimit`（L125 那个公式 ✓ 它已经是
   *        "本场每题的总时长" ✓ 加 3 = 每题都多 3 秒 ✓）
   *        ★ 它和藏品 `timeLimit` 效果同一条路 ✓ 但本件**不写进那个 type** ✗
   *          免得被 `TotalEffect` 重复计一次 ✓ 走自己的字段 ✓
   *     ③ **每场首次触发时 +2 临时生命** → 触发点＝**生命真的掉到 ≤3 那一刻** ✓
   *        ★ 用 `_milTempGiven` 保证每场只给一次 ✗（每场重置 ✓ 同 `_dodged` 纪律 ✓）
   *   ★ 名称「军用斯安威斯坦」：出自《赛博朋克：边缘行者》的军用级植入体 ✓
   *     风味＝**残血才启动的极限加速**（大卫·马丁内斯那条线 ✓）*/
  _milBoost() {
    const v = Babel.TotalEffect('milBoost');
    if (!(v > 1)) return 1;
    const hp = (Babel.RunState && Babel.RunState.targetHP != null) ? Babel.RunState.targetHP : 99;
    return (hp <= 3) ? v : 1;
  }
  /* 生命掉到 ≤3 的那一刻给一次 +2 临时生命（每场一次 ✓）
   *   ★ 在 `_playerHit()` 扣完血之后调用 ✗ —— 那时 targetHP 才是新值 ✓ */
  _milCheckTemp() {
    if (this._milTempGiven) return;
    if (!(Babel.TotalEffect('milBoost') > 1)) return;
    const hp = (Babel.RunState && Babel.RunState.targetHP != null) ? Babel.RunState.targetHP : 99;
    if (hp > 3) return;
    this._milTempGiven = true;
    Babel.RunState.tempHP = (Babel.RunState.tempHP || 0) + 2;
    this._runStats.milShield += 2;      // ★ 结算记账（2026-09-26）
    this._refreshHpText();
    if (this.feedback) this.feedback.setText('军用斯安威斯坦！+2 盾').setColor('#ff2bd6');
  }

  /* ★ 免伤后缀文案（2026-09-26 用户要求：缄口与恍神各说各的 ✗ 不共用一句 ✓）
   *   依据 `_playerHit()` 记下的 `this._dodgedBy` 返回要拼在「错了！／超时！」后面的那半句 ✓
   *   ★ `_dodgedBy` 可能是 **'dodge+block'**（两件**同时**生效 ✓ 加算的口径就是允许这个 ✓）
   *     这时要**并列**说出来 ✗ 不能只报一件 ✓
   *   没挡下 → 返回 ''（调用方原样用「错了！」✓）*/
  _dodgeSuffix() {
    const by = this._dodgedBy || '';
    if (!by) return '';
    const parts = [];
    if (by.indexOf('dodge') >= 0) parts.push('恍神');
    if (by.indexOf('block') >= 0) parts.push('缄口');
    const left = (this._blocksLeft > 0) ? ('·还可挡 ' + this._blocksLeft + ' 次') : '';
    // ★ 缄口参与时才报剩余次数 ✗ 只有恍神时不必报 ✓
    return '但' + parts.join('·') + '·未受伤' + (by.indexOf('block') >= 0 ? (left || '·已用完') : '');
  }

  /* 刷新玩家血量文字（含临时生命盾；显示最多 1 位小数） */
  _refreshHpText() {
    const sh = Babel.RunState.tempHP > 0 ? ('  +' + Babel.RunState.tempHP + '盾') : '';
    this.playerHPText.setText(Babel.fmt1(Babel.RunState.targetHP) + ' / ' + Babel.RunState.maxHP + sh);
    // 页眉「目标生命」同步（等宽数字）
    // ★ NIGHT CITY 皮肤（只本场）：页眉用"小标签 + 大数值"两行，标签由皮肤单独画 → 这里只放数值
    if (this._hudHP) {
      const val = Babel.fmt1(Babel.RunState.targetHP) + ' / ' + Babel.RunState.maxHP;
      this._hudHP.setText(this._skin === 'nightcity' ? val : ('目标生命 ' + val));
    }
  }

  /* 刷新词卡上方连击数（连续答对次数；≥2 显示，≥3 变琥珀色） */
  _refreshCombo() {
    if (this.comboText) {
      if (this.combo >= 2) {
        this.comboText.setText('连击 ×' + this.combo);
        this.comboText.setColor(this.combo >= 3 ? '#f5a623' : Babel.COLORS.MUTED);
      } else {
        this.comboText.setText('');
      }
    }
    // ★ NIGHT CITY 皮肤（只本场）：把连击数推给皮肤自己的 COMBO 数字
    if (this._skin === 'nightcity' && Babel.SKIN_NightCity) Babel.SKIN_NightCity.onCombo(this, this.combo);
  }

  /* BOSS 圣环：更新卡片上方的「胶囊 + 方格指示器」槽位（圣环 N/3 递减 或 辉光倾泻） */
  _updateBossStatus() {
    if (!this._shieldChip) return;   // 仅安多恩(圣环)有此槽位
    const left = Math.max(0, this.shieldMax - this.shieldProgress);
    if (this._shieldChip._label) this._shieldChip._label.setText(this.exposedLeft > 0 ? '辉光' : '圣环');
    this._shieldChip.setValue(left + '/' + this.shieldMax);
    if (this._shieldPips) this._shieldPips.setOn(left);
  }

  /* 安多恩二阶段（狂暴化）：只在第一次转阶段触发（说一次）；圣环机制继续、倒计时 9s、红条、立绘上方 3 秒横幅 */
  _enterPhase2() {
    if (this._phase2) return;   // 已进入二阶段，不再重复触发/重复说台词
    this._phase2 = true;
    this.timeLimit = 9 + Babel.TotalEffect('timeLimit');   // 二阶段：倒计时 9 秒 + 藏品加成
    if (this.cdBar && this.cdBar.setColor) this.cdBar.setColor(0xf5a623);
    if (this.cdText) this.cdText.setColor('#ff625d');
    // 狂暴台词：安多恩立绘上方，停留 3 秒（复用通用转阶段横幅）
    const b = this._phaseBanner || { x: this.cameras.main.width / 2, y: 120, size: '30px' };
    Babel.UI.phaseBanner(this, b.x, b.y, '安多恩：皆为尘土', { size: b.size });
  }

  /* 皇帝的利刃二阶段（审判）：HP ≤ 8 触发，只进一次；此后出题改用专属近义词库（drawTrial） */
  _enterTrialPhase() {
    if (this._trialPhase) return;   // 已进入二阶段，不再重复触发
    this._trialPhase = true;
    this.timeLimit = 10 + Babel.TotalEffect('timeLimit');   // 二阶段：倒计时 10 秒 + 藏品加成
    this.wrongDmg = 1.5;            // 二阶段攻击力下降（1 阶段的 2 → 1.5），避免太强
    this._trialPrevWrong = false;   // 二阶段首题：默认四选一（无"上一题答错"）
    if (this._trialHint) this._trialHint.setText('思维被侵蚀了...').setVisible(true);   // 二阶段提示词
    const b = this._phaseBanner || { x: this.cameras.main.width / 2, y: 120, size: '30px' };
    // 二阶段转阶段横幅词
    Babel.UI.phaseBanner(this, b.x, b.y, '腐蚀已种进你的判断。', { size: b.size });
  }

  /* 答错嘲讽：随机一句，显示方式与转阶段横幅完全一致（立绘上方、3 秒） */
  _showEnemyTaunt() {
    if (!this._enemyTaunts || !this._enemyTaunts.length) return;
    // 随机取一句，但避免与上一次相同（防止连续撞句）
    let idx = Math.floor(Math.random() * this._enemyTaunts.length);
    if (this._lastTauntIdx != null && this._enemyTaunts.length > 1 && idx === this._lastTauntIdx) {
      idx = (idx + 1) % this._enemyTaunts.length;
    }
    this._lastTauntIdx = idx;
    const line = this._enemyTaunts[idx];
    const b = this._phaseBanner || { x: this.cameras.main.width / 2, y: 120, size: '30px' };
    Babel.UI.phaseBanner(this, b.x, b.y, line, { size: b.size });
  }

  /* ===== 里恩 · 循环机制 ====================================================
   * 伤害阶段：正常大词库，正确作答造成伤害并累计命中(1~9)，依次说
   *   『一…六、还剩三、还剩二、还剩一』；第 9 次命中后说『完成』并进入攻击阶段。
   * 攻击阶段：连出 9 题(倒计时 5/4/3)，答对免疫(无法伤他)、他正常还手，全程说
   *   『Furioso-Replica』；9 题结束后回到下一轮伤害阶段(命中清零)。循环直至 HP 归零。
   * ======================================================================== */
  // 伤害阶段：显示当前命中的台词（1~9 对应 hitLines）
  _showLienHit() {
    if (!this._lienCfg) return;
    if (this._lienPips) this._lienPips.setOn(this._lienHit);   // 复刻进度方格同步
    const idx = Math.min(this._lienHit - 1, this._lienCfg.hitLines.length - 1);
    const line = this._lienCfg.hitLines[idx];
    const b = this._phaseBanner || { x: this.cameras.main.width / 2, y: 120, size: '30px' };
    Babel.UI.phaseBanner(this, b.x, b.y, line, { size: b.size });
  }

  // 推进循环：攻击阶段每答完一题 index+1；伤害阶段命中到 9 次 → 转攻击
  _advanceLienCycle() {
    if (!this._enemyLien || !this._lienCfg) return;
    if (this._lienAttacking) {
      this._lienAttackIdx++;
      // 攻击阶段倒数：9 → 0，最右边逐个熄灭
      if (this._lienPips) this._lienPips.setOn(Math.max(0, (this._lienCfg.hitsPerCycle || 9) - this._lienAttackIdx));
      if (this._lienAttackIdx >= this._lienCfg.attack.count) this._endLienAttack();
    } else if (this._lienHit >= this._lienCfg.hitsPerCycle) {
      this._startLienAttack();
    }
  }

  // 进入攻击阶段：持续显示 Furioso-Replica；攻击力暂降到 1.5
  _startLienAttack() {
    this._lienAttacking = true;
    this._lienAttackIdx = 0;
    this.wrongDmg = 1.5;   // 攻击阶段攻击力下降（2 → 1.5），避免太强
    if (this._lienReplica && this._lienCfg) this._lienReplica.setText(this._lienCfg.replica).setVisible(true);
    // 攻击阶段：9 个圆点全亮，随每题从右往左熄灭（倒数）
    if (this._lienPips) { this._lienPips.setOn(this._lienCfg.hitsPerCycle || 9); this._lienPips.setVisible(true); }
  }

  // 攻击结束：回到下一轮伤害阶段（命中清零，隐藏 Replica，恢复攻击力）
  _endLienAttack() {
    this._lienAttacking = false;
    this._lienHit = 0;
    this.wrongDmg = this._baseWrongDmg;   // 恢复基础攻击力
    if (this._lienReplica) this._lienReplica.setVisible(false);
    if (this._lienPips) { this._lienPips.setOn(0); this._lienPips.setVisible(true); }
  }

  /* ===== 幽影 · 静默回响 SILENT ECHO（per-enemy，绝不影响其它战斗）=============
   * 玩法（拼词，不是选词义）：英文词只完整显示一瞬(showMs)，随后字母被"黑暗"逐个吃掉——
   *   阶段一：从右往左（首字母/前缀留到最后 → 考词缀+首尾的结构记忆）；
   *   阶段二(HP ≤ phase2Pct)：两端同时向内、间隔更短、展示更短、条色转暗红。
   * 全消后进入 bufferMs 的"记忆缓冲"；**不显示中文释义**，玩家要用乱序字母块把词拼出来
   * （拼词交互沿用 `_buildAnagramUI` / `_onLetter`，错字母扣 1 秒的规则也照旧）。
   * 全消那一刻放一次"空响"（震屏 + 独立 SFX）。
   * 倒计时由词长推导：show + per×n + buffer，钳制在 [minTime, maxTime]，再加加时藏品。
   * ======================================================================== */
  _setupSilence(w, s, fs) {
    const C2 = this._silenceCfg || {};
    const self = this;
    this._clearSilence();                      // 先清上一题的字母/定时器（防残留）

    const word = (w && w.en) ? String(w.en).toLowerCase() : '';
    // ★ 字母必须取【剥掉空格/连字符后的 _target】，与进度位格子数、字母块、判定完全一致。
    //   否则词库里的 "ice cream" 这类多词条目会出现 9 个字母 vs 8 个格子 → 整行错位。
    const letters = ((this._target && this._target.length) ? this._target : word.replace(/[^a-z]/g, '')).split('');
    const n = letters.length;
    if (!n) return;

    // 二阶段状态由 _silenceUpdatePhase() 在 `_newWord` 里先行判定（它还要决定发什么字母块），此处只读取
    const p2 = !!this._silencePhase2;
    const showMs = p2 ? (C2.phase2ShowMs != null ? C2.phase2ShowMs : 900) : (C2.showMs != null ? C2.showMs : 1200);
    // ★ 两个间隔要分清：
    //   perMs      = 【条长预算】只用于推导倒计时 T（不动它 → 条长完全不变）
    //   dissolveMs = 【实际消散间隔】字母真的每隔多久被吃掉一个（用户 2026-09-14 要求快 30%）
    //   若把两者合成一个，改消散速度会连带缩短长词的条长 2~3s（等于偷偷加难度）——所以拆开。
    const perMs = p2 ? (C2.phase2PerLetterMs != null ? C2.phase2PerLetterMs : 500) : (C2.perLetterMs != null ? C2.perLetterMs : 700);
    const disMs = p2 ? (C2.phase2DissolveMs != null ? C2.phase2DissolveMs : perMs * 0.7)
      : (C2.dissolveMs != null ? C2.dissolveMs : perMs * 0.7);
    const bufMs = p2 ? (C2.phase2BufferMs != null ? C2.phase2BufferMs : 2500) : (C2.bufferMs != null ? C2.bufferMs : 3500);

    // 倒计时 = 展示 + 每字母消散 + 记忆缓冲（按词长推导），钳制后叠加加时藏品
    const raw = (showMs + perMs * n + bufMs) / 1000;
    const minT = p2 ? (C2.phase2MinTime != null ? C2.phase2MinTime : 9) : (C2.minTime != null ? C2.minTime : 10);
    const maxT = p2 ? (C2.phase2MaxTime != null ? C2.phase2MaxTime : 16) : (C2.maxTime != null ? C2.maxTime : 18);
    this.timeLimit = Math.round(Math.min(maxT, Math.max(minT, raw)) * 10) / 10 + Babel.TotalEffect('timeLimit');
    if (this.cdBar && this.cdBar.setColor) {
      this.cdBar.setColor(p2 ? (C2.barColorPhase2 != null ? C2.barColorPhase2 : 0x8b0d0b) : 0xf5a623);
    }

    // 消散字母行：**就放在进度位格子里**（原位结构：词消失的那一行 = 已拼框那一行）
    // 铅字外观下字母是纸白色（坐在墨底字窝上）；非铅字外观退回墨色。
    const cell = this._silenceCell || 52 * s;
    const rowY = this._silenceRowY || (this._cardTop + 74 * s);
    const fontPx = Math.min(this._silenceFont || 80 * s, cell * 0.8);
    const slotX = (this._silenceSlotX && this._silenceSlotX.length === n)
      ? this._silenceSlotX
      : (function () { const a = []; const x0 = self.width / 2 - (cell * n) / 2 + cell / 2; for (let i = 0; i < n; i++) a.push(x0 + cell * i); return a; })();
    const arr = [];
    for (let i = 0; i < n; i++) {
      // ★ 必须 setDepth(52)：进度位墨块在容器 `_anagramBuiltGroup`（depth 50）里，
      //   字母若用默认 depth 0 会被墨块整片盖住 → 玩家"从头到尾看不到词"（2026-09-13 实测踩过）。
      //   摆放角与该格的字窝完全一致（同一个 _silenceJitter(i, slotDeg)）→ 看起来就是"坐进字窝里"。
      arr.push(this.add.text(slotX[i], rowY, letters[i], {
        fontFamily: Babel.FONTS.sign, fontSize: Math.round(fontPx) + 'px',
        color: (C2.letterpress !== false ? '#f4efe4' : '#111111'), fontStyle: '500',
      }).setOrigin(0.5, 0.5).setDepth(52).setAngle(this._silenceJitter(i,
        (C2.slotTiltDeg != null ? C2.slotTiltDeg : 1.4), (C2.slotTiltMin != null ? C2.slotTiltMin : 0.5))));
    }
    this._silenceLetters = arr;
    if (this.wordText) { this.wordText.setText(''); this.wordText.setVisible(false); }   // 题面由字母行接管

    // 消散顺序：阶段一 右→左；阶段二 两端→中间
    const order = [];
    if (p2) {
      let lo = 0, hi = n - 1;
      while (lo <= hi) { order.push(hi); if (hi !== lo) order.push(lo); hi--; lo++; }
    } else {
      for (let i = n - 1; i >= 0; i--) order.push(i);
    }
    this._silenceOrder = order;
    this._silenceEatenFlags = new Array(order.length).fill(false);
    this._silenceEaten = 0;
    this._silenceTotal = n;
    this._silenceRang = false;

    order.forEach(function (idx, k) {
      // 时间线用 disMs（实际消散间隔），不是 perMs（条长预算）→ 消散更快、条长不变
      self._silenceTimers.push(self.time.delayedCall(showMs + k * disMs, function () {
        self._silenceConsume(k);
      }));
    });
  }

  /* 吃掉第 k 个（按消散顺序）字母：0.3s 余像淡出；全消时触发一次"空响" */
  _silenceConsume(k) {
    const order = this._silenceOrder || [];
    const flags = this._silenceEatenFlags || [];
    if (k < 0 || k >= order.length || flags[k]) return false;
    flags[k] = true;
    const o = (this._silenceLetters || [])[order[k]];
    if (o && this.tweens) this.tweens.add({ targets: o, alpha: 0, duration: 300 });
    this._silenceEaten = flags.filter(Boolean).length;
    if (this._silenceTotal > 0 && this._silenceEaten >= this._silenceTotal && !this._silenceRang) this._silenceRing();
    return true;
  }

  /* 全消那一刻的"空响"：独立 SFX（不打断背景 BGM）+ 可选震屏
   * 震屏由 shakeIntensity 控制：**0 = 不震**（用户 2026-09-13 要求关掉——每题都晃会干扰正在进行的拼写） */
  _silenceRing() {
    if (this._silenceRang) return;   // 幂等：每个词只"空响"一次（函数自身守卫，不依赖调用处）
    this._silenceRang = true;
    const C2 = this._silenceCfg || {};
    const si = C2.shakeIntensity != null ? C2.shakeIntensity : 0;
    if (si > 0 && this.cameras && this.cameras.main) {
      this.cameras.main.shake(C2.shakeMs != null ? C2.shakeMs : 240, si);
    }
    const key = C2.sfx || 'sfx-phantom-void';
    if (this.sound && this.sound.play && (!this.sound.get || this.sound.get(key))) {
      this.sound.play(key, { volume: C2.sfxVolume != null ? C2.sfxVolume : 0.55 });
    }
  }

  /* 幽影专属：阶段判定（HP ≤ phase2Pct 进二阶段，只触发一次：沉默横幅 + 换提示语） */
  _silenceUpdatePhase() {
    const C2 = this._silenceCfg || {};
    const pct = C2.phase2Pct != null ? C2.phase2Pct : 0.5;
    if (!this._silencePhase2 && this.enemyMaxHP > 0 && this.enemyHP <= this.enemyMaxHP * pct) {
      this._silencePhase2 = true;
      const bp = this._phaseBanner || { x: this.width / 2, y: 120, size: '30px' };
      Babel.UI.phaseBanner(this, bp.x, bp.y, C2.phase2Taunt || '……', { size: bp.size });
    }
    if (this._anagramHint) {
      const s2 = Math.max(1, Math.min(this.width / 1280, this.height / 720));
      const cy2 = this.height / 2;
      // 阶段二排 3 行，键面上移 → 提示语跟着上提，避免压到键面
      this._anagramHint.setY(this._silencePhase2 ? cy2 + 60 * s2 : cy2 + 88 * s2);
      this._anagramHint.setText(this._silencePhase2
        ? '字母已被吞没——用 a–z 全盘默写这个词'
        : '看一瞬——字母正在消散，还要辨出哪些是假的');
      /* ★ 键盘提示是挂在 `_anagramHint` 下方的 ✓ 所以它一动就要重算 ✗
       *   （阶段二提示上提 28px ✓ 不跟就会脱节叠到键面上 ✓）*/
      this._anagramKeyHint();
    }
  }

  /* 幽影专属：决定"发什么块"——**绝不能让字母清单直接等于答案**（否则排列组合就能解出来）
   *   阶段一：该词【去重】字母（不含重复次数信息）+ ghostPhase1 个"幽灵字母"（不属于该词），整体乱序；
   *   阶段二：padPhase2 时改用 a–z【全字母盘】（字母表序，像键盘）→ 必须真的记得这个词。
   * 同时建立 `_silenceRemain`（每个字母还需要用几次），供块按次数消耗（见 _onLetter）。 */
  _makeSilenceTiles() {
    const C2 = this._silenceCfg || {};
    const word = this._target || '';
    const remain = {};
    for (let i = 0; i < word.length; i++) remain[word[i]] = (remain[word[i]] || 0) + 1;
    this._silenceRemain = remain;

    // 阶段二：26 键全字母盘（不属于该词的键＝天然"幽灵"，永不禁用）
    // ★ 2026-09-15 按玩家建议改成**平时键盘的样子**：QWERTY 顺序 + 10/9/7 分行（见 _silenceKeyRows）
    if (this._silencePhase2 && C2.padPhase2 !== false) {
      const rowsSpec = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
      const all = [];
      for (let r = 0; r < rowsSpec.length; r++) {
        for (let i = 0; i < rowsSpec[r].length; i++) all.push(rowsSpec[r][i]);
      }
      this._silenceKeyRows = rowsSpec.map(function (r) { return r.length; });   // [10, 9, 7]
      this._tiles = all.map(ch => ({ ch: ch, used: false }));
      return;
    }
    this._silenceKeyRows = null;      // 阶段一不是全键盘 → 清掉行规格

    // 阶段一：去重字母 + 幽灵字母（从 a–z 里排除该词字母后随机取，保证幽灵绝不等于真字母）
    const uniq = [];
    Object.keys(remain).forEach(ch => uniq.push(ch));
    const pool = [];
    for (let i = 0; i < 26; i++) { const c = String.fromCharCode(97 + i); if (!remain[c]) pool.push(c); }
    const want = Math.max(0, C2.ghostPhase1 != null ? C2.ghostPhase1 : 4);
    for (let i = 0; i < want && pool.length; i++) {
      const k = Math.floor(Math.random() * pool.length);
      uniq.push(pool[k]); pool.splice(k, 1);
    }
    for (let i = uniq.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = uniq[i]; uniq[i] = uniq[j]; uniq[j] = t; }
    this._tiles = uniq.map(ch => ({ ch: ch, used: false }));
  }

  /* 铅字活字的"摆放角/错位"：**确定性**抖动（同一块每次一样，像被人摆在字盘里）
   * 传 deg 得到 ±deg 的度数；传 minDeg 可设**最小倾斜**（否则均匀分布下约 1/4 的块几乎看不出歪）。
   * 同一个 i 永远得到同一个值，所以"字窝↔字母"能对上。 */
  _silenceJitter(i, deg, minDeg) {
    const v = Math.sin((i + 1) * 12.9898) * 43758.5453;
    const norm = v - Math.floor(v) - 0.5;          // -0.5 ~ 0.5
    const mag = Math.abs(norm) * 2;                // 0 ~ 1
    const sign = norm < 0 ? -1 : 1;
    const d = (deg == null ? 1.2 : deg);
    const m = (minDeg == null ? 0 : Math.min(minDeg, d));
    return sign * (m + mag * (d - m));
  }

  /* 幽影专属：建"铅字活字"字母块 + 原位进度位（不改通用 _buildAnagramUI，猎狗pro/复仇者不受影响）
   * 原位结构：进度位就在"词消失的那一行"（cy-141*s）——消散 = 字母从格子里消失，拼写 = 放回同一格。 */
  _buildSilenceBoard() {
    const self = this;
    const C2 = this._silenceCfg || {};
    const s = Math.max(1, Math.min(this.width / 1280, this.height / 720));
    const cx = this.width / 2, cy = this.height / 2;
    const n = (this._letters || []).length || 1;
    const tiles = this._tiles || [];
    const ink = C2.letterpress !== false;
    const INK = 0x16161a, PAPER = '#f4efe4';

    // 清掉上一题的块与位（与 _buildAnagramUI 同一套容器，避免新增僵尸引用）
    if (this._anagramGroup) this._anagramGroup.removeAll(true);
    if (this._anagramBuiltGroup) this._anagramBuiltGroup.removeAll(true);
    this._anagramLetters = [];
    this._builtBoxes = [];
    this._builtTexts = [];

    /* ---- ① 进度位（已拼框）＝ 词消失的那一行 ---- */
    const cell = Math.max(34, Math.min(76, Math.round(620 / n))) * s;
    this._silenceCell = cell;
    this._silenceRowY = cy - 141 * s;
    this._silenceFont = Math.min(80, Math.round(cell / s * 0.8)) * s;
    const rowL = cx - (cell * n) / 2;
    const slotDeg = (C2.slotTiltDeg != null ? C2.slotTiltDeg : 1.4);
    const slotMin = (C2.slotTiltMin != null ? C2.slotTiltMin : 0.5);
    this._silenceSlotX = [];
    this._silenceSlotAng = [];
    for (let i = 0; i < n; i++) {
      const bx = rowL + cell * i + cell / 2;
      const ang = this._silenceJitter(i, slotDeg, slotMin);
      this._silenceSlotX.push(bx);
      this._silenceSlotAng.push(ang);
      // 空位＝墨底 + 一圈极淡的内边（字母被吃掉后留下的"字窝"）；带与字母相同的摆放角
      const box = ink
        ? this.add.rectangle(bx, this._silenceRowY, cell - 3 * s, cell - 3 * s, INK).setStrokeStyle(1, 0x2a2b30).setAngle(ang)
        : this.add.rectangle(bx, this._silenceRowY, cell - 3 * s, cell - 3 * s, 0xfbfaf7).setStrokeStyle(1, 0xe6e6e6).setAngle(ang);
      if (this._anagramBuiltGroup) this._anagramBuiltGroup.add(box);
      this._builtBoxes.push({ x: bx, y: this._silenceRowY, rect: box });
    }

    /* ---- ② 字母块（铅字活字）---- */
    const total = tiles.length;
    const pad = this._silencePhase2 && C2.padPhase2 !== false;
    const gap = (pad ? (C2.padGap != null ? C2.padGap : 6) : 10) * s;
    const maxKey = (pad ? (C2.padKeyMax != null ? C2.padKeyMax : 60) : 68) * s;
    const keyMin = (C2.keyMin != null ? C2.keyMin : 52) * s;
    let rows, cols;
    // ★ 幽影阶段二＝键盘布局：行宽 10/9/7，逐行居中（cols 取最长行，用于算键宽与 660px 宽度约束）
    const keyRows = (pad && this._silenceKeyRows && this._silenceKeyRows.length) ? this._silenceKeyRows : null;
    if (keyRows) {
      rows = keyRows.length;
      cols = Math.max.apply(null, keyRows);
    } else if (pad) {
      rows = Math.max(2, C2.padRows || 3);                       // 阶段二兜底：均匀 3 行
      cols = Math.max(1, Math.ceil(total / rows));
    } else {
      // 阶段一：优先单行；若单行会把键压到 < keyMin 就自动折两行（长词 13 块单行只有 41px，看不清）
      const oneRowPx = Math.floor((660 * s - (total - 1) * gap) / Math.max(1, total));
      if (oneRowPx >= keyMin) { rows = 1; cols = total; }
      else { rows = 2; cols = Math.max(1, Math.ceil(total / 2)); }
    }
    const tileSize = Math.max(34 * s, Math.min(maxKey, Math.floor((660 * s - (cols - 1) * gap) / cols)));
    const rowW = cols * tileSize + (cols - 1) * gap;
    const startX = cx - rowW / 2;
    // 与通用 _buildAnagramUI 同语义：_tileStartY = 第一行【顶边】
    const topBase = pad ? (cy + 90 * s) : (rows === 2 ? (cy + 118 * s) : (cy + 150 * s));
    this._tileStartY = topBase;
    this._tileSize = tileSize; this._tileGap = gap;
    this._anagramS = s;
    this._silenceTileTop = topBase;
    this._silenceTileRows = rows;
    const center0 = topBase + tileSize / 2;
    const letterFs = Math.max(16 * s, Math.round(tileSize * 0.62));
    const tileDeg = (C2.tileTiltDeg != null ? C2.tileTiltDeg : 3.5);
    const tileMin = (C2.tileTiltMin != null ? C2.tileTiltMin : 1.2);
    const tileJitY = (C2.tileTiltY != null ? C2.tileTiltY : 2) * s;

    // 键盘模式：第 i 块在第几行/行内第几列（并把该行单独居中 → 真实键盘那种错位感）
    const rowOf = function (i) {
      if (!keyRows) return { row: Math.floor(i / cols), col: i % cols, rowW: rowW };
      let acc = 0;
      for (let r = 0; r < keyRows.length; r++) {
        if (i < acc + keyRows[r]) {
          return { row: r, col: i - acc, rowW: keyRows[r] * tileSize + (keyRows[r] - 1) * gap };
        }
        acc += keyRows[r];
      }
      return { row: keyRows.length - 1, col: 0, rowW: rowW };
    };
    tiles.forEach(function (t, i) {
      const rInfo = rowOf(i);
      const col = rInfo.col, row = rInfo.row;
      const bx = (cx - rInfo.rowW / 2) + col * (tileSize + gap) + tileSize / 2;
      // 摆放角 + 上下错位都用确定性抖动（另一个 index 取样，避免与角度相关）
      const yJit = self._silenceJitter(i * 31 + 7, 1) * tileJitY;
      const by = center0 + row * (tileSize + gap) + yJit;
      const ang = self._silenceJitter(i, tileDeg, tileMin);
      const btn = self.add.container(bx, by).setAngle(ang);
      // 铅字：墨底 + 上沿一线反光 + 下沿 2px 侧面阴影
      const rect = self.add.rectangle(0, 0, tileSize, tileSize, INK);
      const top = self.add.rectangle(0, -tileSize / 2 + 1 * s, tileSize, Math.max(1, Math.round(2 * s)), 0xffffff, 0.08);
      const bot = self.add.rectangle(0, tileSize / 2 - 2 * s, tileSize, Math.max(2, Math.round(4 * s)), 0x000000, 0.5);
      const txt = self.add.text(0, 0, t.ch, {
        fontFamily: Babel.FONTS.sign, fontSize: Math.round(letterFs) + 'px', color: PAPER, fontStyle: '500',
      }).setOrigin(0.5, 0.5);
      btn.add([rect, top, bot, txt]);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerup', function () { self._onLetter(i); });
      rect.on('pointerover', function () { self._silenceHover(i, true, s); });
      rect.on('pointerout', function () { self._silenceHover(i, false, s); });
      if (self._anagramGroup) self._anagramGroup.add(btn);
      self._anagramLetters.push({
        ch: t.ch, used: false, obj: btn, rect: rect, txt: txt,
        top: top, bot: bot, baseY: by, ang: ang,
      });
    });

    // ★ 拼词类通用：接上物理键盘（一/二阶段都接 ✓ 见 _bindAnagramKeys 注释）
    this._bindAnagramKeys();
    this._anagramKeyHint();
  }

  /* ★★★ 拼词类通用：把 A–Z 按键接到 `_onLetter`（**点击与打字走同一条路** → 屏上动效完全一致 ✓）
   *   2026-09-26 用户："所有拼词怪物都接入可以键盘键入的模式（也可以点击），
   *                  包括幽影一阶段也要加入可以键入，包括无面，不包括塔露拉"
   *   ★ 覆盖范围（全部走 `_anagramLetters` ✓）：
   *     · 常规乱序拼词：猎狗pro / 复仇者（`quiz:'anagram'`）
   *     · 语境拼词：铁络无面者（`quiz:'maskless'`，两个阶段都是拼词 ✓）
   *     · 幽影「静默回响」：**一阶段与二阶段都接** ✗（原来只有二阶段 ✗）
   *   ★ **不接**塔露拉（`quiz:'rail'` 轨道接字母）—— 用户点名排除 ✗
   *     它的字母不在 `_anagramLetters` 里，且 `answering` 期间走的是轨道判定 ✓
   *     本函数用 `_quiz` 门控兜住 ✓ 双保险 ✓
   *   ★★ **幽灵字母绝不能被打字消耗** ✗✗（幽影一阶段的陷阱）
   *     · 一阶段的块 ＝ 该词**去重字母** ＋ `ghostPhase1` 个幽灵字母 ✓
   *     · 幽灵**故意不是**该词的字母 ✓ 但 `used` 同样是 false ✓
   *       → 若照"找到第一个未用的同字母块"就消耗 ✗
   *         **打一个幽灵字母 ＝ 凭空制造一次拼错** ✓（点击时不会有这个问题：
   *         玩家点幽灵块 → `_onLetter` → 与 `_target` 当前位置不符 → 正常判错 ✓
   *         而打字是"我先说字母、代码替我找块" ✓ ⇒ 必须先分辨真假 ✓）
   *     · 判据：`_silenceRemain[ch]` 有值就是真字母 ✓ 没有就是幽灵 ✓
   *     · 幽灵按键的反馈 ＝ **抖一下所有同字母块** ✓ 不消耗 ✓ 不判错 ✓ */
  _bindAnagramKeys() {
    if (!this.input || !this.input.keyboard) return;
    const self = this;
    if (this._anagramKeyHandler) {
      try { this.input.keyboard.off('keydown', this._anagramKeyHandler); } catch (e) {}
      this._anagramKeyHandler = null;
    }
    this._anagramKeyHandler = function (ev) {
      if (!self.answering) return;
      /* ★ 只服务拼词类（不含 rail ✗ 塔露拉被排除 ✓）*/
      const q = self._quiz || '';
      if (q !== 'anagram' && q !== 'maskless') return;
      if (!self._target || !(self._anagramLetters || []).length) return;
      const k = String((ev && ev.key) || '').toLowerCase();
      if (k.length !== 1 || k < 'a' || k > 'z') return;

      const arr = self._anagramLetters || [];
      /* ★ 幽灵判定：静默回响下 `_silenceRemain` 是"该字母还需要几个" ✓ 没记录＝幽灵 ✓ */
      const isGhost = !!(self._silenceRemain && !self._silenceRemain[k]);
      const shake = function () {
        for (let i = 0; i < arr.length; i++) {
          const L = arr[i];
          if (!L || L.ch !== k || !L.obj) continue;
          const y0 = L.baseY != null ? L.baseY : L.obj.y;
          self.tweens.add({
            targets: L.obj, y: y0 + 3 * (self._anagramS || 1),
            duration: 55, yoyo: true, repeat: 1,
            onComplete: function () { L.obj.y = y0; },
          });
          return;                      // 只抖一个（同字母的块都一样 ✓）
        }
      };
      if (isGhost) { shake(); return; }   // ★ 幽灵：只抖 ✗ 不消耗 ✗ 不判错 ✓

      for (let i = 0; i < arr.length; i++) {
        const L = arr[i];
        if (L && L.ch === k && !L.used) { self._onLetter(i); return; }   // 与点击完全相同
      }
      // 真字母但已经用完（或不在盘上）→ 抖一下当反馈 ✓
      shake();
    };
    this.input.keyboard.on('keydown', this._anagramKeyHandler);
  }

  /* ★ 键盘提示（2026-09-26）：接上键盘后要让玩家**知道**可以打字 ✗
   *   否则功能等于不存在 ✓（藏起来的功能没人会发现 ✓）
   *   ★★ 实现：**不新增一行** ✗✗ —— 直接并进现有的 `_anagramHint` 文案 ✓
   *     踩过的念头：一开始想在提示下方 22px 再画一行 ✗
   *       量了一下：提示在 `cy+88` ✓ 而字母块第一行顶边在 `cy+150` ✓
   *       中间只有 **62px** ✓ 再插一行（13px 字 + 行距）会**压到字母块** ✓
   *     并进同一行 ＝ **零新坐标** ✓ 不碰任何布局 ✓ 永远不会压 ✓
   *   ★ 幂等：`_anagramHint` 每次都由**基文案**重新 setText ✓
   *     所以本函数可以放心重复调 ✓ 不会越拼越长 ✓
   *   ★ 塔露拉（rail）没有 `_anagramHint` → 自动跳过 ✓（用户点名排除 ✓）
   *   ★ 阶段二会换文案 ✓ 所以 `_silenceUpdatePhase` 里也要再调一次 ✓ */
  _anagramKeyHint() {
    const h = this._anagramHint;
    if (!h || !h.setText) return;
    const KEY = '｜可直接用键盘输入';
    if (String(h.text || '').indexOf(KEY) >= 0) return;   // 已加过 → 不重复
    h.setText(String(h.text || '') + KEY);
  }

  /* 铅字块的悬停：翻红墨 + 转正抬起（用尽的块不参与） */
  _silenceHover(i, on, s) {
    const L = (this._anagramLetters || [])[i];
    if (!L || !L.rect || L.used) return;
    if (on) {
      L.rect.setFillStyle(0xe2231a);
      if (L.txt) L.txt.setColor('#ffffff');
      L.obj.setAngle(0); L.obj.y = L.baseY - 3 * s;
      if (L.top) L.top.setAlpha(0.18);
      if (L.bot) L.bot.setAlpha(0.3);
    } else {
      L.rect.setFillStyle(0x16161a);
      if (L.txt) L.txt.setColor('#f4efe4');
      L.obj.setAngle(L.ang); L.obj.y = L.baseY;
      if (L.top) L.top.setAlpha(1);
      if (L.bot) L.bot.setAlpha(1);
    }
  }

  /* 幽影专属：拼写进度刷新——① 把已拼位置的"消散字母"重新点亮（原位结构下就是同一个格子）
   *                            ② 用尽的块翻成纸白"空字模"（油墨已干） */
  _renderSilenceBuilt() {
    const built = this._built || [];
    for (let i = 0; i < built.length; i++) {
      const t = (this._silenceLetters || [])[i];
      if (t) t.setAlpha(1);
      // 该位置已被玩家拼回 → 取消它尚未触发的消散（否则下一秒又被吃掉）
      const k = (this._silenceOrder || []).indexOf(i);
      if (k >= 0 && this._silenceEatenFlags) this._silenceEatenFlags[k] = true;
      const bb = (this._builtBoxes || [])[i];
      if (bb && bb.rect && bb.rect.setStrokeStyle) bb.rect.setStrokeStyle(1, this._silenceCfg && this._silenceCfg.letterpress !== false ? 0x6f6f6f : 0x111111);
    }
    (this._anagramLetters || []).forEach(function (L) {
      if (!L || !L.rect) return;
      if (L.used) {
        L.rect.setFillStyle(0xfbfaf7);
        if (L.txt && L.txt.setColor) L.txt.setColor('#e4e0d6');
        if (L.obj) { L.obj.setAngle(0); L.obj.y = L.baseY; }
        if (L.top) L.top.setAlpha(0);
        if (L.bot) L.bot.setAlpha(0);
        if (L.rect.input) L.rect.input.enabled = false;
      } else {
        L.rect.setFillStyle(0x16161a);
        if (L.txt && L.txt.setColor) L.txt.setColor('#f4efe4');
        if (L.obj) { L.obj.setAngle(L.ang); L.obj.y = L.baseY; }
        if (L.top) L.top.setAlpha(1);
        if (L.bot) L.bot.setAlpha(1);
        if (L.rect.input) L.rect.input.enabled = true;
      }
    });
  }

  /* 清理本题的字母与定时器（换题/换战斗必须调用；先杀 tween 再 destroy，避免 tween 追打已销毁对象） */
  _clearSilence() {
    const self = this;
    (this._silenceTimers || []).forEach(function (t) { if (t && t.remove) t.remove(); });
    this._silenceTimers = [];
    (this._silenceLetters || []).forEach(function (o) {
      if (!o) return;
      if (self.tweens && self.tweens.killTweensOf) self.tweens.killTweensOf(o);
      if (o.destroy) o.destroy();
    });
    this._silenceLetters = [];
    this._silenceOrder = [];
    this._silenceEatenFlags = [];
    this._silenceEaten = 0;
    this._silenceTotal = 0;
    this._silenceRang = false;
  }

  /* 短暂停顿后结算本回合 */
  _delayedNext() {
    const self = this;
    this.time.delayedCall(700, function () {
      try {
        self._refreshBars();
        if (self.enemyHP <= 0) { self._endBattle(true); return; }
        if (self._isDead) { self._endBattle(false); return; }
        self._advanceLienCycle();   // 里恩循环推进（伤害↔攻击阶段切换）
        self._newWord();
      } catch (err) {
        // 防御性兜底：答题后卡死往往来自这里的一处异常；记录后结束本场，避免永久卡住
        try { console.error('[Combat] _delayedNext error', err); } catch (e) {}
        self._endBattle(false);
      }
    });
  }

  /* 更新血条与文字（显示最多 1 位小数） */
  _refreshBars() {
    this.enemyBar.setRatio(this.enemyHP / this.enemyMaxHP);
    this.enemyHPText.setText(Babel.fmt1(Math.max(0, this.enemyHP)) + ' / ' + Babel.fmt1(this.enemyMaxHP));
  }

  /* 纸卡闪烁反馈 */
  _flashCard(color) {
    const self = this;
    if (!this.card) return;
    this.card.setAlpha(0.5);
    this.tweens.add({ targets: this.card, alpha: 1, duration: 300 });
  }

  /* 战斗结束：胜利则展示结算栏（列出本场获得）后继续，失败则本局失败
   *   ★★★ 2026-09-26：整段包一层保险 ✗✗ ——
   *     用户报："三层通关后没有结算界面直接卡死" ✓
   *     我复现不出来 ✓ 但**只要本函数中途抛异常，"回地图/进总结"就永远不会发生** ✗
   *     → 玩家看到的就是"敌人 0 血、界面不动、只能退出" ✓
   *     ⇒ 兜底：本函数一抛，就**直接按最合理的方式收场** ✗ 别让整局卡住 ✓
   *        · 赢了 → 进总结（三层通关的出口＝Summary ✓ 一二层＝Map ✓ 按 floor 判 ✓）
   *        · 输了 → 本局失败 ✓
   *   ★ 兜底里**绝不能再调 _endBattle** ✗（会无限递归 ✓）*/
  _endBattle(win) {
    try { if (Babel.Diag) Babel.Diag.mark('_endBattle(win=' + win + ')', 'floor=' + Babel.RunState.floor + ' type=' + this.type); } catch (e) {}
    try {
      return this._endBattleInner(win);
    } catch (err) {
      try { console.error('[Combat] _endBattle 异常 → 走兜底收场', err); } catch (e) {}
      try { if (Babel.Diag) Babel.Diag.error('_endBattle 兜底', err); } catch (e) {}
      try {
        if (win) {
          const last = (Babel.RunState.floor >= Babel.FLOORS.length);
          if (last) this._finishWin ? this._finishWin() : (Babel.RunState.finishRun('win'), this.scene.start('Summary'));
          else this.scene.start('Map');
        } else {
          Babel.RunState.finishRun('lose');
          this.scene.start('Summary');
        }
      } catch (e2) { try { this.scene.start('Map'); } catch (e3) {} }
      return undefined;
    }
  }

  _endBattleInner(win) {
    // ★ NIGHT CITY 皮肤（只本场）：清掉皮肤自己的定时器/补间，避免场景复用后"僵尸回调"
    if (this._skin === 'saint' && Babel.SKIN_Saint) Babel.SKIN_Saint.clear(this);   // ★ 圣徒皮肤：清干净 ✓
    if (this._skin === 'quilon' && Babel.SKIN_Quilon) Babel.SKIN_Quilon.clear(this);   // ★ 奎隆皮肤：清干净 ✓
    if (this._skin === 'nightcity' && Babel.SKIN_NightCity) Babel.SKIN_NightCity.clear(this);
    if (this.cdTween) this.cdTween.stop();
    if (this._enemySilence) this._clearSilence();   // 幽影：离开战斗即杀掉消散定时器与字母（防残留）
    // 离开战斗：恢复当前层默认 BGM（若本场是专属曲目则切回）
    Babel.PlayMusic(this, Babel.LayerBGM());
    if (this._isTest) {
      // 测试模式：不结算/不改进度，回测试界面
      this.feedback.setText(win ? '测试通过 ✅ · 即将返回测试界面' : '测试失败 ❌ · 即将返回测试界面')
        .setColor(win ? Babel.COLORS.GREEN : Babel.COLORS.RED);
      this.time.delayedCall(1000, () => this.scene.start('Test'));
      return;
    }
    if (!win) { if (this._isTest) { this.scene.start('Test'); return; } Babel.RunState.finishRun('lose'); this.scene.start('Summary'); return; }   // ★ 测试局不结算 ✓ 正常局先看总结 ✓

    // 计算本场奖励
    const lines = [];
    let drop = 2;
    if (this.type === 'emergency') drop = 3;
    if (this.type === 'rare') drop = 4;
    if (this.type === 'boss') drop = 6;
    drop += Babel.TotalEffect('winCurrency');                 // #1 轻拾残页
    // ★ 回响残片（38）：残响之隙（rare 节点）胜利时额外 +value 残页
    if (this.type === 'rare') {
      const _rx = Babel.TotalEffect('rareNodeCurrency');
      if (_rx > 0) drop += _rx;
    }
    // ★ 概率型残页：**逐件独立掷骰**（2026-09-18 修）
    //   原来用 COLLECTIBLES.find(...) ✗ → **只认池子里第一件**（＝轻语匣 ✗）
    //   → 新加的「便签」永远不生效 ✗✓ —— 改为遍历**已拥有**的同类藏品 ✓ 各掷各的 ✓
    (Babel.RunState.ownedCollectibles || []).forEach(function (id) {
      const c = Babel.FindCollectible(id);
      if (c && c.effect && c.effect.type === 'winCurrencyChance' && Math.random() < c.effect.chance) drop += c.effect.value;
    });
    Babel.RunState.addCurrency(drop);
    /* ★★★ 结算行改成"案 3 横幅"版式（2026-09-26 用户选定 ✓ 见
     *   `设计预览/战斗结算面板-重做-3案-1比1.html` ✓）
     *   结构：黑条标题（BATTLE CLEARED ＋ 战斗结算）＋ 白卡正文（逐行 图标＋文本）
     *   ★ 行的**种类**决定图标与颜色 ✗ —— 用 `k` 标记 ✓ 别在绘制处猜颜色 ✓
     *     'cur' 残页（红 · 大 · ◆）
     *     'col' 藏品/机制贡献（紫 · 小 · ◇）
     *     'own' 获得的藏品（墨 · 小 · ◆）
     *     'txt' 普通说明（灰 · 小 · ·）*/
    lines.push({ k: 'cur', text: '残页  +' + drop });
    /* ★★★ 本场"藏品/机制干了多少活"的汇总行（2026-09-26 用户："结算界面缺的全部加上去"）
     *   口径：**只在真的发生时显示** ✗ —— 没带那件藏品 / 那件事没发生 → 一个字都不出 ✓ */
    const _rs = this._runStats || {};
    if (_rs.sealDmg > 0.005) {
      lines.push({ k: 'col', text: '铁络之印　答错反打 ' + Babel.fmt1(_rs.sealDmg) + ' 伤害' });
    }
    if (_rs.jianko > 0) {
      lines.push({ k: 'col', text: '缄口　挡下 ' + _rs.jianko + ' 次受击' });
    }
    if (_rs.milShield > 0 || _rs.milTurns > 0) {
      let t = '军用斯安威斯坦';
      if (_rs.milShield > 0) t += '　+' + _rs.milShield + ' 盾';
      if (_rs.milTurns > 0) t += (_rs.milShield > 0 ? '，' : '　') + '残血增伤 ' + _rs.milTurns + ' 题';
      lines.push({ k: 'col', text: t });
    }
    if (_rs.ringBreak > 0) {
      lines.push({ k: 'col', text: '圣环　破碎 ' + _rs.ringBreak + ' 次' });
    }
    if (_rs.fireOut > 0 || _rs.fireBoom > 0) {
      let t = '尼卢火';
      if (_rs.fireOut > 0) t += '　治灭 ' + _rs.fireOut + ' 朵';
      if (_rs.fireBoom > 0) t += (_rs.fireOut > 0 ? '，' : '　') + '烧尽 ' + _rs.fireBoom + ' 朵';
      lines.push({ k: 'col', text: t });
    }
    /* ★ 「加时 实际 +X 秒」这一行 **已按用户要求删除**（2026-09-26："这个不要"）
     *   它说的是"本场加时藏品给了多少秒" ✓ 但：
     *     · 加时是个**被动数值** ✗ 不像反打/挡下那样"干了件看得见的事" ✓
     *     · 玩家真正关心的是**还剩多少秒**（盘面上就有倒计时 ✓）而不是"藏品贡献了几秒" ✓
     *   ★ 顺带：`_runStats.bonusTime` 的**记账**保留 ✓（总结屏的「战绩」区块还用 ✓）
     *     只是**战斗结算栏**不再显示它 ✗ 两处口径不同 ✓ 别一起删 ✓ */
    /* ★ 同时把本场统计**累进本局总结**（2026-09-26 ✓ 战斗结算栏只显示这一场 ✓
     *   总结屏要的是整局累计 ✓ 两处口径不同 ✗ 别混 ✓）*/
    if (Babel.RunState.logStats) Babel.RunState.logStats(_rs);
    Babel.RunState.completeNode(this.nodeId);
    if (Babel.HasEffect('winHeal')) Babel.RunState.heal(Babel.TotalEffect('winHeal')); // #30 静枝：胜回1命

    // 紧急作战 / 残响之隙：胜利掉落藏品（用稀有度颜色标注）
    if (this.type === 'emergency' || this.type === 'rare') {
      const chance = this.type === 'rare' ? 0.7 : 0.4;
      if (Math.random() < chance) {
        const c = Babel.PickCollectible();
        if (c) {
          Babel.GrantCollectible(c);
          lines.push({ k: 'own', text: '获得藏品【' + (Babel.RARITY_LABEL[c.rarity] || '') + '】' + c.name,
            color: Babel.RARITY_COLOR[c.rarity] || '#24252a' });
        }
      }
    }

    // 击败"特定 boss"：必定掉落其专属藏品（boss 池，紫色，不共池）
    if (this._bossKey) {
      const pool = Babel.PickBossCollectible(this._bossKey);
      for (const c of pool) {
        Babel.GrantCollectible(c);
        lines.push({ k: 'own', text: '获得专属藏品【' + (Babel.RARITY_LABEL[c.rarity] || '') + '】' + c.name,
          color: Babel.RARITY_COLOR[c.rarity] || '#24252a' });
      }
    }

    const isBoss = this.type === 'boss';
    /* ★★★ 先做一套「通关出口」（2026-09-26）✗✗
     *   用户报："三层通关后没有结算界面直接卡死" ✓
     *   我把 `_endBattle` / `_showSettlement` / `SummaryScene` 五屏 / 奖励发放（69+7 件藏品逐个 Grant）
     *   全部用桩跑过一遍 ✓ **都抛不出异常** ✗ → 静态分析定位不到 ✓
     *   ⇒ 那就**先把出口做成幂等的** ✗ 谁来调都只走一次 ✓ 顺便能被兜底直接调用 ✓ */
    const finishWin = () => {
      if (this._winDone) return;
      this._winDone = true;
      try { if (Babel.Diag) Babel.Diag.mark('finishWin → Summary'); } catch (e) {}
      if (this._isTest) { this.scene.start('Test'); return; }
      Babel.RunState.finishRun('win');
      this.scene.start('Summary');
    };
    this._finishWin = finishWin;      // ★ 存到实例上 → 兜底守卫也能调它 ✓

    const next = () => {
      if (isBoss) {
        if (Babel.RunState.floor < Babel.FLOORS.length) {
          Babel.RunState.floor += 1;
          /* ★★★ 2026-09-30 用户最终定稿："进入新层改成回5并获得2最大生命"
           *   ★ 这条需求改过两轮 ✗ 记录清楚别再来回 ✓
           *     ① 原来是 `maxHP += 5` **且** `targetHP += 5` ✓（上限一路涨 10→15→20 ✓）
           *     ② 用户："我的意思是进入新层回五血，**不要加血上限**" ✓ → 改成只 `heal(5)` ✓
           *     ③ 用户："进入新层改成**回5并获得2最大生命**" ✓ → 现在这条 ✓
           *   ★★ 顺序很重要 ✗✗：**先加上限，再回血** ✓
           *     · 反过来的话：满血 10/10 时 `heal(5)` 先被上限吃掉（还是 10/10 ✓）
           *       再把上限抬到 12 → **当前值留在 10/12** ✓ 玩家看得见"进新层反而更空了" ✗
           *     · 正确顺序：上限 10→12 ✓ 再 `heal(5)` → `min(12, 10+5) = 12` ✓ 满血 ✓
           *   ★ 回血仍必须走 `heal()` ✗（内含 `min(maxHP, …)` 封顶 ✓
           *     直接 `targetHP +=` 会突破上限 → 血条比例 >1 → 画到框外 ✓）
           *   ★ 数值口径：**每层 +2 上限** ✓ 三层就是 10 → 12 → 14 ✓
           *     比最早的 +5 温和得多 ✓ 保留一点成长感 ✓ 又不会让"回血"变得无意义 ✓ */
          Babel.RunState.maxHP += 2;      // ★ 先抬上限（回血才有空间 ✓）
          Babel.RunState.heal(5);         // ★ 再回 5 血（被新上限封顶 ✓）
          // ★ 从“写死认 lifespring”改为数值驱动（2026-09-18 体检）✓
          //   原写法：只认 id → 以后新加任何 healFloor 藏品都不会生效 ✗
          //   现写法：按类型求和 → lifespring（value 1）行为**完全不变** ✓ 且同类新品自动生效 ✓
          const _hf = Babel.TotalEffect('healFloor');
          if (_hf > 0) Babel.RunState.heal(_hf);
          if (Babel.HasEffect('floorCurrency')) Babel.RunState.addCurrency(Babel.TotalEffect('floorCurrency')); // #16 轻苔石阶
          Babel.RunState.currentNodeId = null;
          this.scene.start('Map');
        } else {
          finishWin();                          // ★ 通关 → Summary
        }
      } else {
        this.scene.start('Map');
      }
    };
    this._showSettlement(lines, next);
  }

  /* 战斗结算栏（**案 3 · 横幅** ✗ 2026-09-26 用户选定并实装 ✓）
   *   版式：黑条标题（BATTLE CLEARED ／ 战斗结算）＋ 白卡正文（逐行 图标＋文本）
   *   参见 `设计预览/战斗结算面板-重做-3案-1比1.html` ✓
   *   ★ 行的种类由 `ln.k` 决定 ✗：'cur' 残页（红·大）／'col' 藏品贡献（紫）／
   *     'own' 获得的藏品（墨色＋稀有度色）／'txt' 普通说明 ✓
   *   ★ 折行：`Babel.UI.text` 不支持 wrap ✗ → 自己按宽度折 ✓
   *     且**绝不在"标签与数字之间"断** ✗（否则「加时 实际 +1 秒」会被切成两行 ✓）
   *   ★ 面板高度动态算 ✗ 太高时整体上移，保证不超出屏幕 ✓ */
  _showSettlement(lines, next) {
    const s = Math.max(1, Math.min(this.width / 1280, this.height / 720));
    const cx = this.width / 2, cy = this.height / 2;
    const w = 700 * s;                  // ★ 横幅版式比原来宽（520 → 700 ✓）
    const innerW = w - 100 * s;         // 白卡左右各留 22*s ＋ 图标列 26*s

    const widthOf = (str) => {
      let px = 0;
      for (let i = 0; i < str.length; i++) px += (str.charCodeAt(i) > 255 ? 16 : 8);
      return px;
    };
    const wrapped = [];
    lines.forEach((ln) => {
      const txt = String(ln.text == null ? '' : ln.text);
      const maxPx = innerW / s - 6;
      if (widthOf(txt) <= maxPx) { wrapped.push(ln); return; }
      let cur = '';
      for (let i = 0; i < txt.length; i++) {
        const ch = txt[i];
        const isValueHead = (ch === '+' || ch === '.' || (ch >= '0' && ch <= '9'));
        const prevCJK = cur.length > 0 && cur.charCodeAt(cur.length - 1) > 255;
        if (widthOf(cur + ch) > maxPx && cur) {
          if (isValueHead && prevCJK) {
            wrapped.push({ k: ln.k, text: cur.slice(0, -1), color: ln.color });
            cur = cur[cur.length - 1] + ch;
          } else {
            wrapped.push({ k: ln.k, text: cur, color: ln.color });
            cur = ch;
          }
        } else cur += ch;
      }
      if (cur) wrapped.push({ k: ln.k, text: cur, color: ln.color });
    });

    /* ★★★ **把所有战斗元素藏起来** ✗✗（2026-09-26 用户："有的时候会被题目挡到"、"拼词经常会挡到"）
     *   病因（两条 ✓ 都是真 bug）：
     *     ① **拼词的字母块在 `depth 50`** ✗（`_anagramGroup` / `_anagramBuiltGroup` ✓）
     *        而结算面板原来只有 **51/52** ✓ 遮罩更是只有 **50** ✗ → **几乎齐平，压不住** ✓
     *     ② **已拼方框 `_builtBoxes` 压根没设 depth** ✗（＝ 0 ✓ 恒在最底）
     *        它们是**直接 add 到场景**的（不进容器 ✓ 见 `_buildAnagramUI`）
     *        → 遮罩盖不干净 ✓ 拼词时最明显 ✓ 这就是"拼词经常挡到" ✓
     *   ⇒ 两手一起上 ✗：**抬 depth**（见下）＋ **直接藏对象** ✓ */
    try {
      const _hide = [];
      if (this._anagramGroup) _hide.push(this._anagramGroup);
      if (this._anagramBuiltGroup) _hide.push(this._anagramBuiltGroup);
      if (this._railGroup) _hide.push(this._railGroup);                 // ★ 塔露拉轨道容器（也是 depth 50 ✓）
      (this._builtBoxes || []).forEach(function (b) { if (b && b.rect) _hide.push(b.rect); });
      (this._builtTexts || []).forEach(function (t) { _hide.push(t); });
      (this._railBoxes || []).forEach(function (b) { if (b && b.rect) _hide.push(b.rect); else _hide.push(b); });
      (this._railBuiltTexts || []).forEach(function (t) { _hide.push(t); });
      (this._anagramLetters || []).forEach(function (L) { if (L && L.obj) _hide.push(L.obj); });
      (this.optionButtons || []).forEach(function (b) { _hide.push(b); });
      if (this.wordText) _hide.push(this.wordText);
      if (this.feedback) _hide.push(this.feedback);
      if (this._anagramHint) _hide.push(this._anagramHint);
      if (this._maskSentenceText) _hide.push(this._maskSentenceText);
      if (this._trialHint) _hide.push(this._trialHint);
      _hide.forEach(function (o) { try { if (o && o.setVisible) o.setVisible(false); } catch (e) {} });
    } catch (e) {}

    /* ★★★ 整块绘制包 try ✗✗（2026-09-26）
     *   用户报"三层通关后没有结算界面直接卡死" ✓
     *   **只要这里抛异常，`this.time.delayedCall(1700, next)` 就永远不会被注册** ✗
     *   → 通关流程就断在这儿 ✓ 表现正是"没有结算界面、直接卡住" ✓
     *   ⇒ 兜底：画失败也要**把 next 排上** ✓ 宁可没有结算栏，也不能卡死 ✓ */
    const D_VEIL = 300, D_PANEL = 301, D_TEXT = 302;   // ★ 抬到 300+ ✗ 不再和拼词块（50）齐平 ✓
    try {
      const BAND_H = 54 * s;                       // 黑条标题高
      const ROW_H = 30 * s;                        // 每行高
      const PAD_T = 12 * s, PAD_B = 14 * s;        // 白卡上下内边距
      const bodyH = wrapped.length * ROW_H + PAD_T + PAD_B;
      const totalH = BAND_H + bodyH;
      /* ★ 太高就整体上移 ✗（保证不超出屏幕 ✓ 上下各留 16*s ✓）*/
      let top = cy - totalH / 2;
      const maxTop = 16 * s;
      if (top < maxTop) top = maxTop;

      // 遮罩（比原来更实 ✗ 0.55 → 0.90 ✓ 因为现在要"藏干净"而不是"透出来"✓）
      this.add.rectangle(cx, cy, this.width, this.height, 0xfbfbf9, 0.90).setDepth(D_VEIL);

      // ── 黑条标题
      this.add.rectangle(cx - w / 2, top, w, BAND_H, 0x0a0b0d).setOrigin(0, 0).setDepth(D_PANEL);
      Babel.UI.text(this, cx - w / 2 + 22 * s, top + BAND_H / 2, 'BATTLE CLEARED',
        { font: Babel.FONTS.display, size: (11 * s) + 'px', color: '#b9b9b9', origin: [0, 0.5] }).setDepth(D_TEXT);
      Babel.UI.text(this, cx + w / 2 - 22 * s, top + BAND_H / 2, '战斗结算',
        { font: Babel.FONTS.heading, size: (19 * s) + 'px', color: '#ffffff', origin: [1, 0.5] }).setDepth(D_TEXT);

      // ── 白卡正文
      this.add.rectangle(cx - w / 2, top + BAND_H, w, bodyH, 0xffffff)
        .setOrigin(0, 0).setDepth(D_PANEL);
      // 白卡边框（上下左右各 1px ✗ 与黑条同宽 ✓）
      const eW = Math.max(1, Math.round(1 * s));
      this.add.rectangle(cx - w / 2, top + totalH - eW / 2, w, eW, 0x0a0b0d).setOrigin(0, 0.5).setDepth(D_PANEL);
      this.add.rectangle(cx - w / 2 + eW / 2, top + BAND_H, eW, bodyH, 0x0a0b0d).setOrigin(0.5, 0).setDepth(D_PANEL);
      this.add.rectangle(cx + w / 2 - eW / 2, top + BAND_H, eW, bodyH, 0x0a0b0d).setOrigin(0.5, 0).setDepth(D_PANEL);

      const ICON = { cur: '◆', col: '◇', own: '◆', txt: '·' };
      const COL  = { cur: '#e2231a', col: '#9d5cff', own: null, txt: '#6f6f6f' };
      const SIZE = { cur: 19, col: 14, own: 14, txt: 14 };

      wrapped.forEach((ln, i) => {
        const k = ln.k || 'txt';
        const y = top + BAND_H + PAD_T + i * ROW_H + ROW_H / 2;
        const col = (k === 'own' && ln.color) ? ln.color : COL[k];
        Babel.UI.text(this, cx - w / 2 + 22 * s, y, ICON[k] || '·',
          { font: Babel.FONTS.body, size: (12 * s) + 'px', color: col, origin: [0, 0.5] }).setDepth(D_TEXT);
        const t = Babel.UI.text(this, cx - w / 2 + 44 * s, y, ln.text,
          { font: Babel.FONTS.body, size: ((SIZE[k] || 14) * s) + 'px', color: col,
            origin: [0, 0.5], bold: (k === 'cur' || k === 'own') }).setDepth(D_TEXT);
        // ★ 行间细线（末行不画 ✓ 与预览一致 ✓）
        if (i < wrapped.length - 1) {
          this.add.rectangle(cx - w / 2 + 22 * s, y + ROW_H / 2, w - 44 * s, eW, 0xf0f0f0)
            .setOrigin(0, 0.5).setDepth(D_PANEL);
        }
      });
    } catch (err) {
      try { console.error('[Combat] 结算栏绘制失败（已跳过，流程继续）', err); } catch (e) {}
    }
    // 短暂停留后继续（★ 在 try 之外 ✗ 保证一定会排上 ✓）
    try { if (Babel.Diag) Babel.Diag.mark('结算栏已排定时器', 'next 将在 1700ms 后执行'); } catch (e) {}
    this.time.delayedCall(1700, next);
  }
}

Babel.Scenes = Babel.Scenes || {};
Babel.Scenes.CombatScene = CombatScene;
