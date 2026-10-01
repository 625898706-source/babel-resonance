/* ============================================================================
 * constants.js —— 全局常量与设计系统
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 把游戏里所有「写死的配置值」集中放在这里，方便一处修改、全局生效。
 * 包括：
 *   1) 设计系统配色（来自 UI 文档 v0.2 的「Academia 深色图书馆 + E-Ink 纸卡」）；
 *   2) 字体名；
 *   3) 战斗相关的基础数值（血量、伤害、倒计时等）。
 *
 * 【为什么集中管理】
 * 中大型游戏最怕「数值散落各处」。把常量抽到一处，改起来又快又不容易出错。
 * ----------------------------------------------------------------------------
 * 【命名空间约定】
 * 全部代码挂在同一个全局对象 window.Babel 下（简称 `Babel`）。
 * 好处：不使用 ES Module 也能跨文件访问，直接双击 index.html 就能在浏览器里跑。
 * ========================================================================== */

// 如果还没有全局对象，就先建一个（防止重复声明）
window.Babel = window.Babel || {};

// 构建版本号（用于确认浏览器是否用了最新脚本，改了这里刷新后可见）
Babel.VERSION = '2.14-nightcity';

// 设计系统配色（浅色"Research Workbench"编辑/工业风，参照参考截图）
Babel.COLORS = {
  // 主色板（浅色 · E-Ink/纸张 方向）
  BG: '#ffffff',          // 页面底（浅奶油白）
  BG2: '#f7f7f7',         // 次级底
  PANEL: '#ffffff',       // 面板（暖白纸卡；纯白在纸底上"发蓝发刺"）
  PANEL2: '#f7f6f2',      // 次级面板
  PANEL_DARK: '#24252a',  // 深色强调（文字 / 深块）
  LINE: '#e6e6e6',        // 细分隔线（原 #d9d8d3 对纸底仅 1.25:1，几乎看不见）
  INK: '#0a0b0d',         // 墨字（近黑）
  TEXT: '#141414',        // 正文（深灰黑）
  MUTED: '#6f6f6f',       // 次级/淡文字（原 #9b9fa5 仅 2.33:1 不达标；现 4.6:1）
  YELLOW: '#fff44f',      // 标志黄（选中 / 强调 / 荧光笔）
  YELLOW2: '#d9cd00',
  GREEN: '#8eef5b',       // 绿色强调（填充 / 图章）
  GREEN_TEXT: '#2f7d3a',  // 绿色文字（4.9:1，可读）
  RED: '#ff625d',         // 危险 / 错误（填充）
  RED_TEXT: '#c0392b',    // 红色文字（4.6:1，可读）
  ACCENT: '#e2231a',      // 美术馆展签：唯一强调色（红）
  ACCENT_N: 0xe2231a,
  ORANGE: '#f5a623',

  // 数值色（Phaser 的 rectangle/graphics 只吃数值色）
  LINE_N: 0xe6e6e6,       // 细线
  INK_N: 0x1f2024,        // 墨（硬阴影 / 墨边框）
  CARD_N: 0xfffdf9,       // 暖白卡
  MUTED_N: 0x6f6f6f,      // 说明灰

  // 语义键（映射到浅色板，旧场景自动换肤）
  DARK: {
    bg: '#ffffff',        // 画布底（浅）
    panel: '#ffffff',     // 表面 / 卡片
    card: '#fffdf9',      // 卡片
    fg: '#141414',        // 文字（深灰黑）
    muted: '#6b6f76',     // 次级文字（灰 · 4.6:1）
    border: '#c9c6bd',    // 细分隔线
    brass: '#fff44f',     // 强调黄
    amber: '#f5a623',     // 强调橙
    crimson: '#ff625d',   // 危险红
    dangerText: '#0a0b0d',
  },
  // 词卡（浅色纸面 + 墨字）
  PAPER: {
    paper: '#fffdf9',
    ink: '#0a0b0d',
    border: '#c9c6bd',
    pencil: '#6b6f76',
  },
};

// 字体（复用仓库素材：HarmonyOS Sans SC / Novecento Wide / Gilroy / Space Grotesk）
Babel.FONTS = {
  display: '"Novecento Wide", "HarmonyOS Sans SC", sans-serif', // 宽体标题 / 英文词
  body: '"HarmonyOS Sans SC", sans-serif',                       // 正文（含中文）
  heading: '"Novecento Wide", "HarmonyOS Sans SC", sans-serif',  // 大标题宽体
  latin: '"Gilroy", sans-serif',
  mono: '"Space Grotesk", monospace',
  // 拉丁优先 + 中文回退：词条/句子/数字用它——英文走 Grotesk（字面更"词典"），中文自动落到 HarmonyOS
  mixed: '"Space Grotesk", "HarmonyOS Sans SC", sans-serif',
  sign: '"Gilroy", "HarmonyOS Sans SC", sans-serif',   // 展签风大字（细体）
  num: '"Space Grotesk", "HarmonyOS Sans SC", sans-serif',   // 等宽数字（HP/倒计时/连击不跳动）
};

// 战斗基础数值（数值整体缩小）
Babel.BATTLE = {
  playerTargetHP: 10,  // 玩家本局全局「目标生命值」默认 10
  startCurrency: 15,   // 开局「残页」（货币，随之缩小）
  // ★ 基础攻击力（用户 2026-09-14 明确规则）：**每答对造成的基础伤害恒为 1，不随层数变化**。
  //   这里是唯一真源 —— 层配置里**不再**写 correctDamage（以前每层各写一遍 1，既是重复真源、
  //   漏写还会导致 undefined → NaN 伤害 → 敌人血量 NaN、战斗永不结束）。
  //   伤害的成长**只来自藏品叠加**（correctDamage 类藏品的 TotalEffect 求和），这是设计意图。
  //   要调层难度请改敌方 HP / 倒计时 / 专属机制，**不要**动这个值。
  baseDamage: 1,
};

// 背景音乐（BGM）配置：第一层地图/普通战斗的 BGM 为 Borislav Slavov - Welcome to Fort Joy
Babel.BGM = {
  key: 'bgm',
  url: 'assets/audio/sakujo.mp3',  // 歌名：削除 - ShadyShady（2026-09-16 按用户要求替换原 Fort Joy）
  title: '削除 - ShadyShady',     // 界面显示的曲目名
  volume: 0.35,
};

/* 各层（语域）配置：未来每层都有一条配置，这里是第一层名词语域的示例。
 * combat: 本层普通词战的默认数值。 */
Babel.FLOORS = [
  {
    id: 1,
    name: '回声层',
    en: 'LEXICAL DOMAIN',           // 语域英文名（顶部「01 / 探索 / …」那行用它 ✓）
    entryDesc: '入口 · 初响',            // 本层入口节点的说明（分层 ✓ 别写回类型表里 ✗）
    desc: '万物之名，尚存回声。—— 认识并说出飘荡的词之回响。',
    bgm: { key: 'bgm', url: 'assets/audio/sakujo.mp3', title: '削除 - ShadyShady', volume: 0.35 },   // 本层默认 BGM
    combat: {
      // 基础攻击力不在这里配（恒为 1，见 Babel.BATTLE.baseDamage）；本层只配词难度与各类型战斗
      wordDifficulty: 1,        // 词库难度档位（可被各类型覆盖）
      // 每种节点的战斗参数 + 该层定制的敌人定义（后续每层都可自行改敌人/数值/词难度）
      // enemy: 单个敌人；enemies: 敌人变体池（如 BOSS 随机遇到其中一个）
      types: {
        ordinary: {
          enemyHP: 5, attack: 1, timeLimit: 15,
          enemy: { spriteKey: 'slug-idle', name: '源石虫', displayW: 260, displayH: 168, anim: 'slug-idle-anim', lastFrame: 59 },
        },
        // 紧急：固定 猎狗pro（**乱序拼词**）—— 2026-09-18 与二层普通互换；
        //   意图：一层之内 普通(源石虫·四选一) 与 紧急(猎狗pro·拼词) 机制不同 ✓
        //   ★ 数值 8/1/15（用户 2026-09-18 定）：血量 8 ✓ 攻击 1（温和 ✓ 拼错只扣 1）✓ 倒计时 15 秒（拼写要时间 ✓）
        emergency: {
          enemyHP: 8, attack: 1, timeLimit: 15,
          enemy: { spriteKey: 'hunterpro-idle', name: '猎狗pro', displayW: 130, displayH: 130, anim: 'hunterpro-idle-anim', lastFrame: 56, quiz: 'anagram' },
        },
        rare: {
          enemyHP: 10, attack: 2, timeLimit: 10,
          // 残响之隙隐藏BOSS：里恩（静态立绘，无需镜像；专属 BGM Mili - SAIKAI；循环机制）
          enemy: {
            spriteKey: 'lien-idle', name: '里恩', displayW: 82, displayH: 236, flipX: false,
            enemyHP: 28, mechanics: 'lien', bossKey: 'lien',
            bgm: { key: 'bgm-saikai', url: 'assets/audio/saikai.mp3', volume: 0.4, title: 'SAIKAI' },
            // 循环机制：伤害阶段(正常大词库,正确作答累计命中1~9,依次说台词) → 攻击阶段(9题,答对免疫,倒计时4/3/2,三段浅红/红/深红,全程说 Furioso-Replica) → 下一轮
            lien: {
              hitsPerCycle: 9,
              hitLines: ['一。', '二。', '三。', '四。', '五。', '六。', '七，还剩二。', '八，还剩一。', '九，完成。'],
              complete: '',   // 完成并入第9句『九，完成。』，不再单独显示
              replica: 'Furioso-Replica',
              attack: {
                count: 9,
                countdowns: [4, 4, 4, 3, 3, 3, 2, 2, 2],      // 前3题4s / 中3题3s / 后3题2s
                barColors: [0xffb3a7, 0xff625d, 0xc0392b], // 前3浅红 / 中3红 / 后3深红
                shakeIntensities: [0.010, 0.010, 0.010, 0.018, 0.018, 0.018, 0.028, 0.028, 0.028], // 三段震动逐段增强；每轮循环回到最弱档
                shakeDurations: [220, 220, 220, 240, 240, 240, 260, 260, 260],
              },
            },
          },
        },
        // —— 注：猎狗pro/复仇者/铁络无面者/塔露拉 已正式编入【第二层】的
        //    ordinary/emergency/boss，不再在第一层保留测试类型（否则测试界面会重复列出）。
        //    第一层仅保留自己的真实阵容：源石虫 / 萨卡兹宿主卫巢百夫长 / 里恩 / 安多恩 / 皇帝利刃。
        boss: {
          enemyHP: 12, attack: 2, timeLimit: 12,
          // 第一层 BOSS：两只变体，随机(各 50%)遇到一个；后续可增删/定制
          enemies: [
            { spriteKey: 'andoain-idle', name: '殉道者 · 安多恩', displayW: 190, displayH: 202, anim: 'andoain-idle-anim', lastFrame: 99, mechanics: 'shield', bossKey: 'andoain', bgm: { key: 'bgm-martyr', url: 'assets/audio/martyr.mp3', volume: 0.4, title: '殉道之人' },
              // 答错时的嘲讽台词（随机一句，显示方式与转阶段横幅一致：立绘上方 3 秒）
              taunts: [
                '寻路者，你连它的名字都未说对。',
                '词意走偏，便离真理又远了一步。',
                '误读之物，终归尘土。',
                '真义不在你口中，而在你尚未行至之处。',
                '你答非所问；我等的，是下一个正确的名字。',
              ] },
            { spriteKey: 'emperor-idle', name: '皇帝的利刃', displayW: 180, displayH: 224, anim: 'emperor-idle-anim', lastFrame: 49, enemyHP: 24, attack: 2, timeLimit: 12, mechanics: 'trial', bossKey: 'emperor', bgm: { key: 'bgm-lastjudge', url: 'assets/audio/lastjudge.mp3', volume: 0.4, title: 'Last Judge' },
              // 答错嘲讽（随机一句，立绘上方 3 秒）
              taunts: [
                '连词都读不准，也配受我的审问？',
                '真正的释义藏于无锋处，你只见了锋芒。',
                '我替陛下校准每一道词义；你，却偏出了轨迹。',
                '判词已落——你选错了它的名字。',
                '刀刃之上，容不得半点含混的释义。',
                '一字之差，便与真理背道而驰。',
                '字词出了鞘，你却接不住它的锋芒。',
              ] },
          ],
        },
        // ── 待定（TBD）：**测试暂存区** ─────────────────────────────────────────
        //   新怪物先放这里：在「战斗测试」里单独成一组能打到，但类型 key `tbd` 不进任何
        //   layout.typePool → **地图永不生成、不影响真实进度**；等用户吩咐再挪到真正的层/节点类型。
  //   ★ 2026-09-26 起本区为空（原 5 只已全部转正进第三层 ✓）
        //   本怪 = 最普通的四选一（无机制 / 无 quiz），数值同第一层普通作战。
        //   立绘：素材 `491652654cb0ac3b4c4406fc2de24a5b.webp`（546×800 透明）→ assets/img/adamsmasher-idle.png
        //   **需要镜像** → 不写 flipX（敌人默认镜像、面向逻各斯）。
        //   专属 BGM：P.T. Adamczyk - The Rebel Path（源 320k mp3 → 重编码 192k）
        tbd: {
          enemyHP: 40, attack: 2, timeLimit: 5, wordDifficulty: 1,
          // ★ 2026-09-26：原 5 只已全部转正 —— 亚当重锤 → 三层 rare；
          //   圣徒/奎隆 → 三层 boss；穿刺手/杰斯顿 → 三层 ordinary/emergency
          //   本区现为空 ✓ 保留结构供以后**新怪暂存**用 ✓（加进 enemies 即出现在战斗测试 ✓）
          enemies: [
          ],
        },
      },
    },
    layout: {
      columns: 7,                                        // 7 列：入口 + 5 个中转列 + BOSS → 6 步到 BOSS（2026-09-16 用户要求两层各多一列）
      rows: 3,                                           // 每列 3 条纵向"车道"
      weights: { ordinary: 30, emergency: 16, shop: 11, reward: 10, encounter: 10, exchange: 8, rare: 2 },   // ★ 各类型相对权重（2026-09-17 用户定稿）
      typePool: ['ordinary', 'emergency', 'shop', 'reward', 'exchange', 'encounter'], // 中转节点类型（普通权重类，残响之隙单独低概率）
    },
  },

  // ================= 第二层：回响层 =================
  {
    id: 2,
    name: '回响层',
    en: 'ECHO DOMAIN',               // 语域英文名（二层 ✓）
    entryDesc: '入口 · 叠响',            // 本层入口节点的说明
    desc: '词开始扭曲，外来之物混入。—— 辨清正在回响的每一句话。',
    // 第二层 BGM：2026-09-18 用户要求换成 削除 - Shady Shady [Sunset] ✓（原 The Mist 已删除 ✗）
    bgm: { key: 'bgm-shady-sunset', url: 'assets/audio/shady-sunset.mp3', title: '削除 - Shady Shady [Sunset]', volume: 0.35 },   // 本层默认 BGM
    combat: {
      // 基础攻击力恒为 1（Babel.BATTLE.baseDamage），本层不重复配置
      wordDifficulty: 2,      // 第二层词难度略升
      types: {
        // 普通：固定 萨卡兹宿主卫巢百夫长（**四选一**）—— 2026-09-18 与一层紧急的猎狗pro互换位置 ✓
        //   目的：让"普通 vs 紧急"不仅在数值上、更在**作答机制**上拉开（普通＝四选一，紧急＝乱序拼词）✓
        ordinary: {
          enemyHP: 12, attack: 1.5, timeLimit: 12,
          enemy: { spriteKey: 'centurion-idle', name: '萨卡兹宿主卫巢百夫长', displayW: 180, displayH: 233, anim: 'centurion-idle-anim', lastFrame: 29 },
        },
        // 紧急：固定 复仇者（乱序拼词）—— 与普通（四选一）机制不同 ✓
        emergency: {
          enemyHP: 15, attack: 1.5, timeLimit: 14,
          enemy: { spriteKey: 'avenger-idle', name: '复仇者', displayW: 130, displayH: 130, anim: 'avenger-idle-anim', lastFrame: 118, quiz: 'anagram' },
        },
        // 残响之隙(rare)：**幽影** —— 第二层残响敌人（2026-09-13 顶替里恩；里恩只在第一层保留一份）。
        //   rare 节点 ≈2% 概率出现（floorConfig.pickWeighted），属"隐藏 boss"：数值高于二层关底(30/1.5/13)。
        //   立绘：素材 B_Phantom.webp（270×222 透明）→ assets/img/phantom-idle.png，静态单帧、**不镜像**（flipX:false）
        //   专属 BGM：Christopher Larkin - Phantom（FLAC → mp3 192k）；答对伤害走全局基础攻击力 Babel.BATTLE.baseDamage = 1
        //   【专属机制】静默回响 SILENT ECHO（mechanics:'silence' + quiz:'anagram'）：
        //     英文词只完整闪一瞬(showMs)，字母随后被黑暗逐个吃掉，**不显示中文释义**——
        //     玩家要靠短暂的视觉记忆，用乱序字母块把这个词**拼出来**（拼词，不是选词义）。
        //     考拼写结构记忆（长度/首字母/词缀）。参数全部在此，改数值不用改代码。
        rare: {
          enemyHP: 34, attack: 2, timeLimit: 12,   // timeLimit 仅兜底：本机制按词长实时推导（见 silence）
          enemy: {
            spriteKey: 'phantom-idle', name: '幽影', displayW: 250, displayH: 206, flipX: false,
            mechanics: 'silence',
            quiz: 'anagram',              // 拼词：点乱序字母块拼出英文词（不是四选一选中文释义）
            bossKey: 'phantom',           // ★ 2026-09-26：击败后必掉专属藏品「缄口」（前 3 次答错不扣血）
            bgm: { key: 'bgm-phantom', url: 'assets/audio/phantom.mp3', volume: 0.4, title: 'Phantom' },
            // 【幽影全程沉默】答错/超时嘲讽也只是「……」（2026-09-13 用户指定：台词全部改成沉默，勿"补全"成句子）
            //   单元素即可——`_showEnemyTaunt()` 的"避免连续同句"逻辑要求 length>1，单个不会触发，行为照常。
            taunts: ['……'],
            /* 静默回响参数（阶段一；阶段二 HP ≤ phase2Pct 时覆盖） */
            silence: {
              showMs: 1200,          // 完整显示时长（1.2s）
              perLetterMs: 700,      // ★【条长预算】每个字母在倒计时里占 0.7s（只用于推 T，不是实际消散速度）
              dissolveMs: 490,       // ★【实际消散间隔】每 0.49s 吃掉 1 个字母（= 700 × 70%，用户 2026-09-14 要求快 30%）
              bufferMs: 3500,        // 全消后的记忆缓冲（3.5s）
              minTime: 10,           // 倒计时钳制下限（由词长推导：show + per×n + buffer）
              maxTime: 18,           // 倒计时钳制上限（超长词的兜底）
              // —— 字母块怎么发（2026-09-13 定：不能让"字母清单"直接等于答案，否则排列组合就能解出来）——
              ghostPhase1: 4,        // 阶段一：乱序块 = 该词【去重】字母 + 4 个"幽灵字母"（不属于该词，永不禁用）
              padPhase2: true,       // 阶段二：不给该词字母，改用 a–z【全字母盘】默写
              padRows: 3,            //   全盘排 **3 行**（9/9/8）——2 行时单键只有 40px、字母太小吃不清（用户 2026-09-13 指定）
              padKeyMax: 60,         //   3 行时单键最大 60px（字母约 37px）
              padGap: 6,             //   全盘键间距（比阶段一的 10 更紧，给 3 行留高度）
              keyMin: 52,            // 阶段一：单行若会把键压到 <52px 就自动折成两行（长词 13 块单行只有 41px，太小）
              minLetters: 5,         // 出题过滤：英文词至少 5 个字母（词库里有 a/i/of/it，拼出来没意义）
              minDistinct: 3,        // 出题过滤：至少 3 种不同字母（否则"去重+4幽灵"会退化成 1 真 + 4 假）
              letterpress: true,     // 字母块/进度位用【铅字活字】外观（用户 2026-09-13 选定）：墨底反白 + 侧边阴影 + 摆放角
              tileTiltDeg: 3.5,      // 字母块的摆放角 ±3.5°（用户 2026-09-13：±1.2° 太正、"没有印刷的感觉"）
              tileTiltMin: 1.2,      //   最小倾斜 1.2°：保证**每一块**都看得出歪（否则均匀分布下约 1/4 的块几乎正着）
              tileTiltY: 2,          // 字母块的上下错位 ±2px（手摆的活字不会齐平；这是"印刷感"的另一半）
              slotTiltDeg: 1.4,      // 字窝/消散字母的摆放角 ±1.4°（比块轻，保持"一行"的读感）
              slotTiltMin: 0.5,      //   字窝的最小倾斜
              slotProgress: true,    // 进度位（已拼框）放在"词消失的那一行"（原位结构）
              phase2Pct: 0.5,        // 二阶段阈值：HP ≤ 50%（34 → 17）
              phase2ShowMs: 900,     // 二阶段：展示压到 0.9s
              phase2PerLetterMs: 500,// ★【条长预算】每字母占 0.5s（只用于推 T）
              phase2DissolveMs: 350, // ★【实际消散间隔】每 0.35s 吃 1 个（= 500 × 70%，两端同时向内）
              // 二阶段是"26 键默写"（回忆+拼写），比阶段一难得多 → 缓冲 2.5 → 6.5 → 7.5s。
              // 2026-09-14 用户反馈"二阶段太难"，**整体 +1 秒**：缓冲 +1000ms 之外，
              //   min/max 也必须各 +1s（11→12 / 20→21）—— 否则 5~7 字母词会被地板值吃掉那一秒（加成不生效）。
              phase2BufferMs: 7500,
              phase2MinTime: 12,
              phase2MaxTime: 21,
              phase2Taunt: '……',   // 幽影不言语：转阶段只留沉默（2026-09-13 用户指定；勿"补全"成句子）
              barColorPhase2: 0x8b0d0b,   // 二阶段倒计时条转暗红（数值色）
              // 全消"空响"：**震屏已按用户要求关闭（2026-09-13）**——每道题都震一下太吵，且会晃到正在拼的字母块。
              //   要恢复就把 shakeIntensity 改回 0.018（代码仍按 >0 才会震，属"状态开关"而非死代码）。
              shakeIntensity: 0,
              shakeMs: 240,
              sfx: 'sfx-phantom-void',   // 空响音效（素材库 weapon-223，频谱质心最低 2458Hz）
              sfxVolume: 0.55,
            },
          },
        },
        // BOSS：无面者 与 塔露拉 二选一（各 50%）
        boss: {
          enemyHP: 30, attack: 1.5, timeLimit: 13,
          enemies: [
            // 铁络无面者（语境句子拼词）
            { spriteKey: 'maskless-idle', name: '铁络无面者', displayW: 190, displayH: 250, quiz: 'maskless',   // 透明立绘，但同样套深色图版（并缩到框内 272×264）
              masklessPhase: { phase2Hp: 12, phase1Time: 13, phase2Time: 16 },
              bossKey: 'maskless',
              bgm: { key: 'bgm-battle-shoji', url: 'assets/audio/battle-shoji.mp3', volume: 0.4, title: '通常戦闘' },
              taunts: ['错，消散。', '词不回响。', '遗忘入骨。'],
            },
            // 塔露拉（轨道接字母）
            /* ★★★ 2026-09-30 用户："攻击力改成 1"
             *   ★ 必须写成 **per-enemy 覆盖** ✗✗ 不能改上面的类型默认 ✓
             *     类型默认 `boss: { enemyHP: 30, attack: 1.5, timeLimit: 13 }` 是
             *     **铁络无面者与塔露拉共用**的 ✓（两条敌人定义里都没写 attack ✓ 全继承 ✓）
             *     → 改类型默认会**连铁络无面者一起改** ✓ 那就违反"逐敌定制"红线了 ✓
             *   ★ 依据 `CombatScene` L124：`this.wrongDmg = (enemyDef.attack != null) ? enemyDef.attack : t.attack;`
             *     ⇒ 敌人定义里写 `attack` 即覆盖 ✓ 只影响她自己 ✓
             *   ★ 为什么这么改合理 ✗（数值理由 ✓）：
             *     · 她**一题要 30~40 秒**（7 字母 × 每波 5 秒 ✓ 见 `_startRailWave` ✓）
             *       是全项目最长的单题 ✓ 同时又是"点错一次整题作废"的最重惩罚 ✓
             *     · 双重惩罚叠加 → 原先 1.5 偏狠 ✓ 降到 1（与"每错一次多花一整题时间"更相称 ✓）
             *     · 换个说法：她罚的是**时间** ✓ 就不该再按别人的标准罚**血** ✓ */
            { spriteKey: 'talulah-idle', name: '塔露拉', displayW: 130, displayH: 130, anim: 'talulah-idle-anim', lastFrame: 178, quiz: 'rail',
              attack: 1,                      // ★ 覆盖类型默认的 1.5 → 1（只影响她 ✓ 铁络无面者不变 ✓）
              bossKey: 'talulah',
              /* ★ 答错台词（2026-09-26 补 ✓ 原为空 ✗ 一层两个 BOSS 各有 5~7 句）
               *   语域取自她的官方设定：整合运动领袖／"令人捉摸不透"／
               *   切尔诺伯格被毁的主谋／被"不死的黑蛇"附身／日暮寻路（赎罪线）
               *   ★ 口吻要**压制而不咆哮** ✗ —— 官方描述是"令人捉摸不透"，不是单纯凶狠 ✓ */
              taunts: [
                '词都读不准，也配谈理想。',
                '感染者不需要你的怜悯。',
                '火不会因为你不看它就熄灭。',
                '我烧过一座城。这一句，也一样。',
                '……日暮了。你还没答对。',
              ],
              bgm: { key: 'bgm-talahla', url: 'assets/audio/boss-talahla.mp3', volume: 0.4, title: '黑暗玄廊领主' } },
          ],
        },
      },
    },
    layout: {
      columns: 7,
      rows: 3,
      weights: { ordinary: 30, emergency: 16, shop: 11, reward: 10, encounter: 10, exchange: 8, rare: 2 },   // ★ 各类型相对权重（2026-09-17 用户定稿）
      weights: { ordinary: 30, emergency: 16, shop: 11, reward: 10, encounter: 10, exchange: 8, rare: 2 },   // ★ 各类型相对权重（2026-09-17 用户定稿）
      typePool: ['ordinary', 'emergency', 'shop', 'reward', 'exchange', 'encounter'],
    },
  },
  {
    id: 3,
    name: '残响层',
    en: 'FRACTURED DOMAIN',        // 语域英文名（三层 ✓）
    entryDesc: '入口 · 终响',           // 本层入口节点的说明
    desc: '碎片不再成词，只剩音节。—— 趁湮灭之前，把它们重新拼回名字。',
    // 第三层 BGM（2026-09-26 用户指定）：削除 - ShadyShady[Chamber]
    //   源 321k mp3 → 重编码 192k（与其它 BGM 同档 ✓ 体积省约 40% ✓）
    // ★ 音量 0.35 → **0.5**（2026-09-26 用户："太轻了 响一点，但不要太响" ✓）
    bgm: { key: 'bgm-shady-chamber', url: 'assets/audio/shady-chamber.mp3', title: '削除 - ShadyShady[Chamber]', volume: 0.5 },
    combat: {
      wordDifficulty: 3,        // 第三层词难度再升一档
      types: {
        // 普通：固定 萨卡兹穿刺手组长（**四选一**）
        //   数值（2026-09-26 用户定）：HP 18 / 攻 1.5 / 倒计时 12
        //   立绘：素材 萨卡兹穿刺手组长-默认-战斗-Idle-x1.webm → assets/img/piercer-idle.png
        //   **需要镜像** → 不写 flipX（敌人默认镜像、面向逻各斯）
        ordinary: {
          enemyHP: 18, attack: 1.5, timeLimit: 12,
          enemy: { spriteKey: 'piercer-idle', name: '萨卡兹穿刺手组长', displayW: 220, displayH: 220, anim: 'piercer-idle-anim', lastFrame: 71 },
        },
        // 紧急：固定 杰斯顿（**乱序拼词**）—— 与普通（四选一）机制不同 ✓（照一二层的做法 ✓）
        //   数值（2026-09-26 用户定）：HP 20 / 攻 1.5 / 倒计时 12
        //   立绘：素材 杰斯顿·威廉姆斯-默认-战斗-C1_Attack-x1.webm → assets/img/jesselton-idle.png
        //   **需要镜像** → 不写 flipX
        emergency: {
          enemyHP: 20, attack: 1.5, timeLimit: 12,
          enemy: { spriteKey: 'jesselton-idle', name: '杰斯顿', displayW: 220, displayH: 220, anim: 'jesselton-idle-anim', lastFrame: 85, quiz: 'anagram' },
        },
        // 残响之隙(rare)：**亚当重锤** —— 第三层残响敌人（2026-09-26 用户指定）
        //   ★ 从「待定」区转正 ✓ 走 NIGHT CITY 皮肤 ✓ 二阶段弹幕识别 ✓（参数原样搬来 ✓ 未改动 ✓）
        rare: {
          enemyHP: 40, attack: 2, timeLimit: 12,
          enemy:             {
                        spriteKey: 'adamsmasher-idle', name: '亚当重锤',
                        displayW: 160, displayH: 234,   // 保持源图 546:800 比例
                        bossKey: 'adamsmasher',   // ★ 2026-09-26：击败后必掉专属藏品「军用斯安威斯坦」（残血 ×1.5 伤 + 每题 +3s + 首次 +2 盾）
                        bgm: { key: 'bgm-rebel-path', url: 'assets/audio/rebel-path.mp3', volume: 0.4, title: 'The Rebel Path' },
                        // ★ 只这一场走 NIGHT CITY 皮肤（src/scenes/skins/nightcity.js）；其它敌人无此字段 → 代码路径一行不变
                        skin: 'nightcity',
                        // ★ 二阶段专属机制：弹幕识别（src/scenes/mechanics/barrage.js）
                        //   HP 降到 phase2Hp 及以下 → 进入二阶段：词条从他那儿匀速飞向逻各斯，
                        //   点中真词 = 命中（敌人 −1），任意词碰到逻各斯 = 你 −1，两者都开始下一击。
                        //   参数与 `设计预览/亚当重锤-弹幕识别-预览.html` 逐项一致，可单独调。
                        mechanics: 'barrage',
                        barrage: {
                          phase2Hp: 20,      // 二阶段阈值：HP ≤ 20 进入弹幕识别（2026-09-15 用户定稿；测试期曾用 39）
                          phase3Hp: 10,      // 三阶段阈值：HP ≤ 10 → 弹幕速度再 ×speed3Factor
                          speed3Factor: 1.4, // ★ 三阶段速度倍率（300 × 1.4 = 420 px/s）
                          /* ★★★ 2026-09-29 用户："亚当重锤三阶段感觉有点难" → 2 → **1.4**
                           *   量化依据（设计像素 field 640 ／ base 300）：
                           *     · 2.0 → 600 px/s：单词**可读窗口 1.07s**、每 0.53s 一个词 ✗
                           *       且干扰词是「整词打乱／换一个字母」（`silenec`／`silenca` ✓ fakeType 2 ✓）
                           *       → 1.07 秒内"读完 ＋ 逐字母比对 ＋ 点中"，**物理上不够** ✓
                           *     · 1.4 → 420 px/s：窗口 **1.52s**（＝二阶段 2.13s 的 71% ✓）
                           *       每 0.68s 一个词 ✓ 三阶段仍明显快于二阶段（300 ✓）✓
                           *   ★ 判据：要回到二阶段手感的 70% → 速度需 ≤ 427 → 倍率 1.42 ✓ 故取 **1.4**
                           *   ★ 只改这一个数 ✗ —— `barrage.js` 的 `speedUp()` 本就吃任意倍率 ✓ 一行未动 ✓ */
                          count: 3,          // 每击词数
                          speed: 300,        // 飞行速度 px/s（匀速；爆冲不影响速度）—— 2026-09-15 按用户要求 ×2（原 150）
                          stag: 0.26,        // 发射间隔（秒）
                          fakeType: 2,       // 0=整词打乱 1=换一个字母 2=混合
                          size: 44,          // 字号
                          layers: 22,        // 残影层数
                          gap: 22,           // 相邻残影间距（px）→ 拖影总长 = layers × gap = 484px
                          fall: 0.90,        // 每层衰减
                          ab: 6,             // 色散
                          boost: 2.6,        // 爆冲强度（只影响残影/色散）
                          boostEvery: 6.0,   // 爆冲间隔（秒）
                          boostDur: 1.25,    // 爆冲时长（秒）
                          colA: '#7fc8f0',   // 头（最近层）＝蓝
                          colB: '#7ff2e0',   // 尾（最远层）＝青绿
                          lanes: [212, 300, 388],   // 三条轨道 y
                          field: [322, 962],        // 飞行区间 x（逻各斯 → 重锤）
                        },
                      },
        },
        // 第三层 BOSS：圣徒 / 奎隆 二选一（各 50%）—— 两只都从「待定」区转正 ✓
        //   ★ 两只是**完整成品**（专属皮肤 + 全部机制）✓ 参数原样搬来 ✓ 未改动 ✓
        boss: {
          enemyHP: 45, attack: 1.5, timeLimit: 15,
          enemies: [
              {
                            // ★ 圣徒（2026-09-18 用户要求）：**最最基础的四选一** —— 不写 quiz（＝默认四选一 ✓）
                            //   不写任何 mechanics ✓
                            //   立绘：素材 “圣徒”-默认-战斗-B_Idle_2-x1.webm → assets/img/saint-idle.png（30 帧 6×5 ✓ 已去黑底 ✓）
                            //   **需要镜像** → **不写 flipX**（敌人默认镜像、面向逻各斯 ✓ 见上面亚当重锤那段注释 ✓）
                            //   专属 BGM：塞壬唱片-MSR,Crywolf - Somniomancer [null set] ✓ volume 0.4
                            spriteKey: 'saint-idle', name: '圣徒',
                            displayW: 220, displayH: 220,        // 单帧 180×180 ✓ 显示 220（1.22× ✓）
                offsetY: 18,                          // ★ 往下 18（素材里角色贴着帧最上沿 ✓ 不偏会顶出图版 ✓ 用户要求往下放 ✓）
                            skin: 'saint',                        // ★ 专属战斗皮肤（src/scenes/skins/saint.js ✓ 只本场生效 ✓）
                            /* ★★ 三阶段结构（2026-09-24 用户改阈值 ✓）
                             *   一阶段（血 ≤ 45）：连线阶段 —— 左 3 / 右 3，点击式连线 ✓
                             *   二阶段（血 ≤ 30）：**正常的"三对四"** ✓ 右栏多一个干扰项 ✓
                             *   三阶段（血 ≤ 15）：★ **反向连线** ✓ —— 版面完全沿用二阶段（左 3 / 右 4）✓
                             *                       点词 → 它从最近的错释义反向冲过来 ✓
                             *   ★ 三个阈值只影响**圣徒这一场** ✓ 其它敌人无此字段 → 代码路径一个字节不变 ✓✓ */
                linkFrom: 45,                         // ★ 一阶段：进连线（2026-09-21 ✓）
                linkExtraFrom: 30,                    // ★ 二阶段：血量 ≤ **30** 时右栏多一个干扰项（3 → 4 个 ✓ 2026-09-24 用户定 ✓）
                linkReverseFrom: 15,                  // ★ 三阶段：血量 ≤ **15** 时进「反向连线」（2026-09-24 用户定 ✓）
                anim: 'saint-idle-anim', lastFrame: 174,  // ★ 175 帧全量 ✓（原先只取 30 帧 ✗ 动作不全 ✓）
                            // 数值：按"正常一场"给 ✓ 不继承 tbd 的 5 秒极限倒计时 ✗（那是亚当重锤弹幕专用 ✓）
                            enemyHP: 45, attack: 1.5, timeLimit: 15,   // ★ 45 血（2026-09-21 用户要求 ✓ 打到 44 进入连线阶段 ✓）
                            bgm: { key: 'bgm-somniomancer', url: 'assets/audio/boss-saint.mp3', volume: 0.4, title: 'Somniomancer' },
                          },
              {
                            /* ★ 奎隆（2026-09-24 用户要求 ✓ 加在「待定」区 ✓ 只测试能打到 ✓ 不进地图 ✓）
                             *   全称「奎隆，摩诃萨埵权化」；A_Idle 待机动作 ✓
                             *   立绘：素材 “奎隆，摩诃萨埵权化-默认-战斗-A_Idle-x1.webm”
                             *         → assets/img/quilon-idle.png（479 帧源 → 取**前 160 帧**＝一个完整循环 ✓
                             *            单帧 180×180 ✓ 10 列 × 16 行 ✓ 黑底已抠成透明 ✓）
                             *   **需要镜像** → **不写 flipX**（敌人默认镜像、面向逻各斯 ✓）
                             *   专属 BGM：塞壬唱片-MSR,Steven Grove - 舍盘持难题纳婆罗为谛 ✓ volume 0.4
                             *   ★ 机制：**一阶段「尼卢火」** ✓ 二/三阶段**待设计**（2026-09-24） */
                            spriteKey: 'quilon-idle', name: '奎隆',
                            displayW: 220, displayH: 220,        // 单帧 180×180 ✓ 显示 220（与圣徒同档 ✓）
                            skin: 'quilon',                      // ★ 专属战斗皮肤「授法」A 案（src/scenes/skins/quilon.js ✓ 只本场生效 ✓）
                            anim: 'quilon-idle-anim', lastFrame: 159,   // ★ 160 帧全量 ✓（0~159 ✓）
                            enemyHP: 45, attack: 1.5, timeLimit: 15,    // ★ 45 血（用户 2026-09-24 指定 ✓）
                            /* ★ 机制：**一阶段「尼卢火」**（2026-09-24 用户逐轮定稿 ✓ 见 _tmp_ref/1阶段-尼卢火-定稿.md）
                             *   出处＝官方尼卢火：我方单位/可治疗，天赋「真火性空」＝被治疗后消失；每存在 1 个他受伤 ×0.8（乘算）
                             *   这里：他不攻击你，只"召火"；**答对那个词条 ＝ 治好它** →
                             *     开局 5 朵（各 20 秒独立倒计时、点开才答题）→
                             *     答对：火灭 ＋ 随机给另一朵火 +5 秒 ＋ 答对计数 +1
                             *     答错：火也灭 ＋ 扣目标生命
                             *     自爆：扣目标生命 ＋ **补位新火**（不留灰烬）
                             *     **场上恒 5 朵**（答完/自爆都立刻补位）→ 永远清不完 ✓
                             *     累计**答对 5 次**（＝惩五戒 5 连击）→ 缚解 → 二阶段 ✓
                             *   题库：src/data/fireWords.js ✓ 开关：`fireStage: true` ✓（没有这个字段的敌人一行都不变 ✓）*/
                            fireStage: true,
                            fire: {
                              count: 5,          // 开局火数 ＝ 场上恒定的火数
                              lifeMs: 15000,     // ★ 每朵 **15 秒**（各自独立）＝ 该题的作答时限（2026-09-24 用户："全部火焰倒计时改成15，现在太简单"）
                              bonusMs: 5000,     // 答对 → 随机给另一朵 +5 秒
                              bonusCapMs: 30000, // ★ +5 的上限（＝30s；上限若＝15s 则对满秒的火完全无效 ✗）
                              needRight: 5,      // 累计答对 5 次 → 缚解
                              wrongCost: 1,      // 答错扣目标生命 1.0
                              boomCost: 1,       // 自爆扣目标生命 1.0
                            },
                            /* ★ 三阶段阈值（复用既有字段名 ✓ 皮肤只读不写 ✓）
                             *   入定 SAMADHI（＝开局，一阶段 45）／自在 VIMUTTI（血 ≤30）／无忧觉 ASHOKA（血 ≤15）
                             *   ★★ **2026-09-24 用户定：二阶段 30、三阶段 15** ✓（原 42 / 40 是测试用的 ✓）
                             *     一阶段 45~31（答对 15 题）→ 二阶段 30~16（答对 15 题）→ 三阶段 15~0 ✓
                             *   ★★ 判定顺序有讲究（见 `_phaseOf`）：**先判三阶段再判二阶段** ✗
                             *     所以 `linkReverseFrom` 必须 **小于** `linkExtraFrom` ✓（15 < 30 ✓ 成立 ✓）
                             *     否则三阶段会把二阶段整段吃掉（二阶段一滴血都没有 ✓ 我第一版差点这么配 ✓）
                             *   ★ 二阶段行为：**火的题面方向交替**（英→中 ／ 中→英 一替一个）✓ 见 `_firePickWord` ✓ */
                            linkFrom: 45,
                            linkExtraFrom: 30,
                            linkReverseFrom: 15,
                            bgm: { key: 'bgm-quilon', url: 'assets/audio/boss-quilon.mp3', volume: 0.4, title: '舍盘持难题纳婆罗为谛' },
                          },
          ],
        },
      },
    },
    layout: {
      columns: 7,
      rows: 3,
      weights: { ordinary: 30, emergency: 16, shop: 11, reward: 10, encounter: 10, exchange: 8, rare: 2 },   // 各类型相对权重（照一二层 ✓）
      typePool: ['ordinary', 'emergency', 'shop', 'reward', 'exchange', 'encounter'],
    },
  },
];
