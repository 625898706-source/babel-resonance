/* ============================================================================
 * quilon.js —— 「奎隆，摩诃萨埵权化」专属战斗皮肤 · A 案「授法」（2026-09-24）
 * ----------------------------------------------------------------------------
 * 美术依据：docs/research_quilon_art_brief.md（子代理调研 ✓ 只用它的【查到】/【实测】）
 *   · 三件套 = 银白鬃毛体量感 ＋ 朱红火焰冠 ＋ **背后金轮** ✓
 *     前两件由立绘自带 ✓；**金轮就在背景图里**（右侧 (1118,288) r=436）✓
 *   · 底盘 = 萨卡兹「半圆拱门 ＋ 柱 ＋ 表现主义色块喷溅 ＋ 前景缺损石板蒙版」✓
 *   · 奎隆叠加层 = 宝轮（文明的存续）/ 莲座 / 坛城式地砖 / 梵语经文线 ✓
 *   · 场地 = 6F 枷锁破碎之庙（中轴对称阶梯平台 ＋ 深灰绿积水 ＋ 荷叶 ＋ 暖橙灌木）✓
 *   · 氛围 = 「说法 · 辩论」→ 缓慢、对称、仪式化 ✓ **不要爆炸粒子** ✗
 *   · 三阶段＝入定 SAMADHI ／ 自在 VIMUTTI ／ 无忧觉 ASHOKA ✓（官方英文名 ✓）
 *
 * ★ 风险控制（项目红线：绝不影响其它战斗 ✓）
 *   · **不重写立绘图版** ✗ —— 沿用 CombatScene 的标准深色图版 ✓（与 saint 皮肤同一纪律 ✓）
 *   · **不替换选项按钮** ✗ —— 沿用 Babel.UI.row ✓ 只改线条与字色 ✓
 *   · 所有钩子都在 CombatScene 里以 `this._skin === 'quilon'` 判定 ✓
 *     未拥有该字段的敌人**代码路径一个字节都不变** ✓✓
 *
 * 对外接口（与 saint/nightcity 同形 ✓ CombatScene 只调这六个）：
 *   build(scene)                   进场：铺背景 ＋ 藏掉 E3 浅色底 ＋ 全量换色 ＋ 起两个慢动效
 *   resetOptions(scene)            每题：选项线/字色复位（否则上一题的朱红会留到下一题）
 *   onWord(scene)                  每题：按 HP 判定阶段（入定/自在/无忧觉）＋ 阶段横幅 ＋ 金环对齐
 *   onCorrect(scene, index)        答对：金环亮一下 ＋ 鸽…（不做粒子 ✗）只做「金环脉冲 + 朱红定线」
 *   onWrong(scene, index, timeout) 答错：全屏酒红薄闪（克制 ✓ 不是爆炸 ✗）
 *   clear(scene)                   离场：销毁本皮肤造的所有对象与补间（防场景复用残留 ✗）
 * ========================================================================== */
(function () {
  if (!window.Babel) window.Babel = {};

  /* ---- 色板：全部来自简报的【实测】取色 ✓ 一个都不是我编的 ✓ ---- */
  const K = {
    deepBlue: 0x282838,   // ★ 带蓝调的冷灰蓝黑（不是纯灰 ✗ 这是"方舟味"的关键）
    deepBlue2: 0x181828,
    stone: 0x303030,      // 地图主色
    stoneL: 0x404040,
    black: 0x080808,
    silverN: 0xb8b8c8,    // 冷银
    ivoryN: 0xf8f8f8,     // 象牙白
    bronzeN: 0x9c846c,    // ★ 褪色古铜金（**不用亮金** ✗）
    bronzeHiN: 0xb4b49c,
    vermN: 0xcc543c,      // ★ 主强调朱红
    crimsonN: 0xb43c3c,
    wineN: 0x6c2424,      // 深酒红
    plumN: 0x3c0c24,      // 极暗紫红
    uiRedN: 0xc01d22,     // ★ 官方敌方/BOSS 语义红
    stageN: 0xff4f08,     // ★ 官方阶段/危险橙
    bronzeS: '#9C846C',
    bronzeHiS: '#B4B49C',
    /* ★ 信息数字用色（2026-09-24 用户："血量颜色看不起" ✓ 即看不清 ✗）
     *   原来血量/残页/倒计时数字都用 `bronzeHiS`（#B4B49C 暗铜）✗
     *   —— 那是简报里的**低饱和装饰金** ✓ 用在**功能数字**上对比太低（暗底上糊成一片）✗✓
     *   口径：**装饰用古铜金 ✓ 信息数字用高对比近白/亮金** ✓ 两者不能混 ✗ */
    numS: '#F2EFE4',        // 血量/数值：近白微暖（最高对比 ✓）
    numWarmS: '#E6C88A',    // 倒计时/残页：亮金（与装饰金区分开 ✓ 但仍属暖色系 ✓）
    silverS: '#B8B8C8',
    dimS: '#7E7E92',
    paleS: '#E8E8EE',
    uiRedS: '#C01D22',
    stageS: '#FF4F08',
    vermS: '#CC543C',
    wineS: '#6C2424'
  };

  const Skin = {
    _s(scene, s) {
      return s || Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));
    },

    /* 倒计时条那条**静态渐变**（A 案「苔与金」）——
     * ★ 2026-09-24 用户："这个条也可以删掉了，另外火焰的倒计时条换成这个的颜色"
     *   → 条身不再单独显示 ✓ 这套颜色改去画**火的倒计时弧** ✓
     *   色标（与预览页 bandURL 完全一致 ✓ 别只改一处 ✗） */
    CD_STOPS: [[0.00, 0x304830], [0.30, 0x40463e], [0.62, 0x303030], [0.86, 0x9c846c], [1.00, 0xb4b49c]],
    _cdColorAt(t) {
      const G = this.CD_STOPS;
      const u = t < 0 ? 0 : (t > 1 ? 1 : t);
      for (let i = 0; i < G.length - 1; i++) {
        const t0 = G[i][0], c0 = G[i][1], t1 = G[i + 1][0], c1 = G[i + 1][1];
        if (u >= t0 && u <= t1) {
          const k = (t1 === t0) ? 0 : (u - t0) / (t1 - t0);
          const r = Math.round(((c0 >> 16) & 255) + (((c1 >> 16) & 255) - ((c0 >> 16) & 255)) * k);
          const g2 = Math.round(((c0 >> 8) & 255) + (((c1 >> 8) & 255) - ((c0 >> 8) & 255)) * k);
          const b = Math.round((c0 & 255) + ((c1 & 255) - (c0 & 255)) * k);
          return (r << 16) | (g2 << 8) | b;
        }
      }
      return G[G.length - 1][1];
    },
    /* 倒计时弧的色带（预计算一次 ✓ 免每段都查表 ✓）
     * ★ 为什么不是直接照抄色标：原条有**冷银描边**托着，中段那两块深色（`#40463e`/`#303030`）
     *   才成立 ✓ 但画成**弧**就没有那层衬底了 ✗ 深色糊进深背景 → 看着像"断了一截" ✓
     *   （我自检图里就是这么显示的 ✓ 靠 read_image 看出来的 ✓）
     * ★ 提亮的两次试错（都别重走 ✗）：
     *   ① 往白混 42% → 深绿灰被**去饱和**，绿色没了 ✓
     *   ② 归一化到 max=255（V 拉满）→ 整条变**粉彩** ✓（`#40463e` → `#e9ffe2` ✗）
     *   → 用**只抬亮度下限** ✓
     * ★★ 但 FLOOR=150 时用户仍说"根本看不清楚" ✓（2026-09-24）
     *   病因：① 弧**太细**（4px ✓ 环直径 116，太秀气）② 中段色**明度还是不够**（`#969696`）
     *   修：FLOOR **150 → 215** ／ 弧宽 **4px → 7px** ／ 底环**加深并加粗**（让亮弧衬得出来）
     *   ★ 口径：**深底上的细弧，明度要拉到接近白才读得出来** ✗ 别用"刚好能看见"的标准 ✓ */
    _cdRamp(n) {
      if (this._cdRampCache && this._cdRampCache.length === n) return this._cdRampCache;
      const FLOOR = 215;
      const a = [];
      for (let i = 0; i < n; i++) {
        const c = this._cdColorAt(n === 1 ? 1 : i / (n - 1));
        const r = (c >> 16) & 255, g2 = (c >> 8) & 255, b = c & 255;
        const lum = 0.2126 * r + 0.7152 * g2 + 0.0722 * b;
        const kk = lum > 0 ? Math.max(1, FLOOR / lum) : 1;
        a.push((Math.min(255, Math.round(r * kk)) << 16) |
               (Math.min(255, Math.round(g2 * kk)) << 8) |
               Math.min(255, Math.round(b * kk)));
      }
      this._cdRampCache = a;
      return a;
    },

    /* ----------------------------------------------------------------------
     * 阶段判定（唯一真源 ✓ 一处改、处处生效 ✓）
     *   阈值**不写死** ✗ —— 读敌人定义里既有的三个字段（没有就不切阶段 ✓）
     *   → 以后要改阶段切换点，只改 constants 里的数 ✓ 皮肤一行都不用动 ✓
     * -------------------------------------------------------------------- */
    /* ----------------------------------------------------------------------
     * 阶段判定（唯一真源 ✓ 一处改、处处生效 ✓）
     * -------------------------------------------------------------------- */
    _phaseOf(scene) {
      const d = scene.enemyDef || {};
      const hp = scene.enemyHP;
      /* ★ 火阶段（一阶段）＝ **血量还没跌破二阶段阈值** ✓
       *   ★ 用户 2026-09-24 明确："**按照正常打血量**，后续我会设定血量阈值" ✗
       *     —— 所以**不是**"累计答对 5 次推进" ✗（我上一版理解错了 ✓ 已改）
       *   · 火系统只负责【出题 + 压力】✓ 阶段推进回归**正常打血** ✓
       *   · 阈值沿用既有的 `linkExtraFrom` ✓ 用户以后改数即可 ✓ 皮肤不用动 ✓
       *   ★ 现在只看血量 ✓ 天然不会自引用（原来那个 `_fireCleared` 标记已不需要 ✗）*/
      if (d.fireStage && (hp == null || d.linkExtraFrom == null || hp > d.linkExtraFrom)) return 1;
      if (d.linkReverseFrom != null && hp != null && hp <= d.linkReverseFrom) return 3;
      if (d.linkExtraFrom != null && hp != null && hp <= d.linkExtraFrom) return 2;
      return 1;
    },

    /* ======================================================================
     * ★★ 一阶段「尼卢火」（2026-09-24 用户逐轮定稿 ✓ 见 _tmp_ref/1阶段-尼卢火-定稿.md）
     *   出处＝官方尼卢火：我方单位 / 可治疗，天赋「真火性空」＝**被治疗后消失** ✓
     *   · 他不攻击你，只"召火"；**答对那个词条 ＝ 治好它** ✓
     *   · 开局 5 朵，各 20 秒独立倒计时；**点开一朵才开始答题**（题占满中栏）
     *   · 答对 → 火灭 ＋ **随机给另一朵 +5 秒**（上限 30s）＋ 答对计数 +1
     *   · 答错 → 火也灭 ＋ 掉血（＝用血换时间 ✓）
     *   · 20 秒没点 → 自爆：掉血 ＋ **补位新火**（不留灰烬 ✗）
     *   · **场上恒 5 朵**（答完/自爆都立刻补位）→ 永远清不完 ✓
     *   · 累计**答对 5 次** → 缚解 → 二阶段 ✓
     *   ★ 减伤机制**已删** ✗（场上恒 5 朵 → 减伤永远 67% → 固定值不构成决策 ✗）
     *   ★ 开关：`enemyDef.fireStage` ✓ 没有这个字段的敌人**一行都不变** ✓
     *   ★★ 火横跨**一、二两个阶段** ✗✗（2026-09-24 用户定二阶段＝"火随机中文考英文/英文考中文"）
     *      · 一阶段：火里的题**恒为英→中** ✓
     *      · 二阶段：火**留着**，但题**双向随机**（各 50%）✓ —— 火本身不变，**里面的内容变** ✓
     *      · 三阶段：火**全体撤走** ✓（`_fireEnd` 只在 phase ≥ 3 时收 ✓）
     *      所以这里返回"**还没到三阶段**"✗ 不是"等于一阶段"✓
     * ==================================================================== */
    _isFireStage(scene) {
      const d = scene.enemyDef || {};
      /* ★★★ **只看 `fireStage` 字段** ✗✗（2026-09-24 介词版）
       *   原来是 `fireStage && _phaseOf < 3` ✓ —— 那是**旧三阶段（清火）**时代的定义 ✗
       *   新三阶段**继续用火** ✓（火上写关键词 ✓ 点开考介词 ✓）
       *     → 必须对**所有阶段**都为真 ✓
       *   否则 `_fireBuild` 直接 return → `g.fire` 不存在 → 三阶段**一朵火都没有** ✓（自测抓到的 ✓）
       *   ★ ☋带效果（全是要的 ✓）：`_fireBuild` 会建火 ✓ ／ `fireStageOn` 为真 → CombatScene 不出普通题 ✓
       *     ／ `fireIdle` 为真 → 空题态 ✓ ／ `fireTimed` 为真 → 不起它自己的倒计时 ✓ */
      return !!d.fireStage;
    },
    /* ★ 给 CombatScene 的守卫用：**火阶段且还没有火被点开** → 本题不该存在 ✗
     *   用户 2026-09-24 截图："原来的题还在这干嘛" ✓
     *   病因：开战/超时/答完 都会自动调 `_newWord` → 会自己出一道**与火无关的普通题** ✓
     *         ① 屏幕上留一道废题 ② 它的倒计时空跑，跑完按"超时"扣玩家血 ✓ 双脏 ✓
     *   所以：没有点开的火 → `_newWord` **直接跳过** ✓ 由"点开火"来触发出题 ✓ */
    fireIdle(scene) {
      const g = scene._kq;
      return !!(this._isFireStage(scene) && g && g.fire && g.fire.open < 0);
    },
    /* ★ 给 CombatScene 的守卫用：**火阶段**（不论有没有点开的火）
     *   → 它**不该起自己的每题倒计时** ✗ 一切由火自己计时 ✓
     *   用户 2026-09-24："第二题开始点起来怎么没反应了" ✓
     *   根因：战斗自带的 `timeLimit 15s` 与火的 20 秒**两套计时同时在跑** ✗
     *     ① 它到点 → `_doTimeoutReal()`，而那条路**只给 nightcity 挂了 onWrong 钩子** ✗
     *        → 火的 `open` / `alive` **不被清理** → 状态错位 ✓ 表现就是"点了没反应" ✓
     *     ② 它还会写 `cdBar` / `cdText` → 与火的横条**抢同一个控件** ✓（截图里条不对就是这个）
     *   → 火阶段一律由火计时 ✓ CombatScene 的每题倒计时停用 ✓ */
    fireTimed(scene) {
      /* ★★ 改成“一/二/三阶段都跳过每题倒计时” ✗✗（2026-09-24 用户：“还莫名其妙显示超时”）
       *   病因：三阶段是 `_phaseOf >= 3` ✓ 而 `_isFireStage` 已改成 `< 3` ✓
       *     → 三阶段**不再**被认作火阶段 ✓ `fireTimed` 返回 false ✓
       *     → CombatScene 就**照常起每题倒计时** ✓ 到点走 `_doTimeoutReal` → 显示“超时” ＋ 扣血 ✓
       *   修：这里改成“**只要 `fireStage` 就跳过**”✗（＝三个阶段的作答都不靠 CombatScene 的倒计时 ✓）
       *   ★ 三阶段自己的时限由**发射词飞到你**来表达 ✓ 不需要第二条倒计时 ✓ */
      return this._isFireStage(scene);
    },
    /* ★★ 给 CombatScene 的**出题守卫**用：整个火阶段都不许它自己出题 ✗✗
     *   （2026-09-24 用户："还是有这种情况，先出现几个中文，然后一瞬间这几个中文会变" ✓ 真因在这）
     *   ★ 病因：我只挡住了"**没有火被点开**"的那种（`fireIdle`）✗
     *     但还有一条路：**点开火答完 → `_delayedNext` 700ms 后自己调 `_newWord`** ✓
     *     那一刻题还开着 → `fireIdle` 为假 → 守卫放行 → 走了 **CombatScene 的普通出题** ✓
     *     而普通出题是 `btn.setVisible(true)` **先显**、`setText()` **后写** ✓
     *     → **先露出上一题的中文，再被换成新的** ✓ 就是那一瞬 ✓
     *     （紧接着皮肤自己的出题又换一遍 ✓ 观感就是"答案变了一下" ✓）
     *   → 修：守卫改成**整个火阶段** ✓ 火阶段的出题**只由 `fireNewWord` 负责** ✓
     *     ★ 与 `fireIdle` 的区别：`fireIdle` 只管"要不要起题"（空题态 ✓）
     *       `fireStageOn` 管"**这一阶段所有出题都归皮肤**"（含答完后的重建 ✓）*/
    fireStageOn(scene) {
      return this._isFireStage(scene);
    },
    /* ★★★ 三阶段减伤 ✗✗（2026-09-24 用户："一阶段减伤50%，二阶段减伤40%，三阶段30%"）
     *   返回**乘数**（0.5 / 0.6 / 0.7 ✓）而非"减免百分比" ✗
     *     —— 调用方直接 `dmg *= mul` ✓ 少一次换算 ✓ 少一处出错 ✓
     *   ★ 由 `CombatScene` 在**所有伤害加成算完之后**调用 ✗（用户明确要求 ✓）
     *   ★ 只奎隆有 → 别的敌人没有这个钩子 → `mul` 恒为 1 ✓ 零影响 ✓ */
    _dmgCutByPhase(scene) {
      /* ★★ 阶段越后、减伤越多 ✗（2026-09-24 用户："三个阶段倒过来，30 40 50"）
       *   → 一阶段 30% ✓ 二阶段 40% ✓ 三阶段 50% ✓
       *   ★ 本函数是减伤的**唯一真源** ✗：
       *     显示文案（`_dmgCutLabel`）与 乘数钩子（`damageMul`）**都从这里算** ✓
       *     → 改一处、两处自动跟着变 ✓ */
      const ph = this._phaseOf(scene);
      if (ph >= 3) return 0.50;      // 三阶段 无忧觉：减伤 50%
      if (ph >= 2) return 0.60;      // 二阶段 自在：  减伤 40%
      return 0.70;                   // 一阶段 入定：  减伤 30%
    },
    /* 给 CombatScene 的钩子（返回乘数 ✓）*/
    damageMul(scene) {
      return this._dmgCutByPhase(scene);
    },
    /* 给 CombatScene 的钩子：**实际伤害落下后飘字** ✗（2026-09-24）*/
    onDamageDealt(scene, dmg) {
      if (typeof dmg !== 'number' || !isFinite(dmg) || dmg <= 0) return;
      this._dmgFloatShow(scene, dmg);
    },
    /* 奎隆立绘牌下方那行「伤害减免 XX%」✗（用户："要在奎隆下面显示好"）
     *   ★ 位置：`cy + 196*s` ✗ —— 敌人血条数值在 `cy + 170*s`、我方血条在 `cy + 230*s`
     *     两者之间那条空带 ✓ 不压任何既有元素 ✓
     *   ★ 阶段变化时改文案 ＋ 换色（减得越少越"危险" ✓ 血红 → 骨白 ✓）*/
    _dmgCutLabel(scene, s) {
      const g = scene._kq; if (!g || !g.dmgCutTxt) return;
      const ph = this._phaseOf(scene);
      const pct = Math.round((1 - this._dmgCutByPhase(scene)) * 100);
      const name = ph >= 3 ? '无忧觉' : (ph >= 2 ? '自在' : '入定');
      /* ★ 符印版：百分比是盘里的大字 ✓ 阶段名在下一行 ✓ */
      if (g.dmgCutNum && g.dmgCutNum.setText) g.dmgCutNum.setText(String(pct));
      if (g.dmgCutStage && g.dmgCutStage.setText) g.dmgCutStage.setText(name);
      /* 阶段色：减得越少越危险 ✓（血红 → 橙 → 镀金 ✓）*/
      const stageCol = ph >= 3 ? '#c8a24a' : (ph >= 2 ? '#e0a06a' : '#ff8a62');
      if (g.dmgCutStage && g.dmgCutStage.setColor) g.dmgCutStage.setColor(stageCol);
      if (g.dmgCutPct && g.dmgCutPct.setColor) g.dmgCutPct.setColor(stageCol);
      if (g.dmgCutRule && g.dmgCutRule.setFillStyle) {
        g.dmgCutRule.setFillStyle(ph >= 3 ? 0xc8a24a : 0xc2402c, 0.55);
      }
      g.dmgCutPctVal = pct;
    },

    _fireCfg(scene) {
      const f = (scene.enemyDef && scene.enemyDef.fire) || {};
      /* ★★★ 加时类藏品（`timeLimit`）在火阶段**改为 ÷5 计入每朵火的寿命**
       *   （2026-09-26 用户："加时类藏品对奎隆不生效，我的想法是所有加时类藏品效果
       *     对奎隆的每个火效果/5"）
       *   ★ 为什么原来"不生效"✗：火阶段由 `fireTimed()` 让 CombatScene 的**每题倒计时整个停用**
       *     （见 CombatScene `_startCountdown` 开头的守卫 ✓）
       *     → `timeLimit` 加上去的秒数**没有任何地方消费** ✓ 纯无效 ✓
       *   ★ 现在：`lifeMs` 也随加时藏品增长 ✓ 但**除以 5** ✗
       *     当前三件：慢一拍 +1s ／ 缓吐气 +0.5s ／ 长明灯 +2s（合计 +3.5s）
       *     → 每朵火 +0.20 / +0.10 / +0.40 ／ 全带 +0.70s（15 → 15.7s ✓）
       *   ★ 为什么必须除 ✗：普通战斗里 +3.5s 是"每题多 3.5 秒" ✓
       *     而火是**每朵 15 秒一次判定** ✓ 五朵并行 ✓ 直接加 3.5 会被放大成 +17.5s 总时长 ✓
       *   ★ 上限仍由 `capMs`（30s）在**回血时**管 ✓ 出生即 ≤15.7s ✓ 碰不到 ✓ */
      const timeBonus = (Babel.TotalEffect ? Babel.TotalEffect('timeLimit') : 0) / 5;
      const life = (f.lifeMs != null ? f.lifeMs : 20000) + timeBonus * 1000;
      /* ★ 结算记账：把**实际吃到的**秒数上报（2026-09-26 ✓ 这里已经是 ÷5 之后的值 ✓）
       *   ★ 覆盖 `CombatScene` 记的那个 ✗ —— 那边记的是"每题 +Xs"（普通战斗口径 ✓）
       *     火阶段真正生效的是这个数 ✓ 所以以本行为准 ✓
       *   ★ 只记一次 ✗ —— `_fireCfg` 只在建场时调一次 ✓（L303 ✓ 我用 grep 确认过 ✓）*/
      if (scene && scene._runStats) scene._runStats.bonusTime = timeBonus;
      return {
        count: f.count != null ? f.count : 5,
        lifeMs: life,
        bonusMs: f.bonusMs != null ? f.bonusMs : 5000,
        capMs: f.bonusCapMs != null ? f.bonusCapMs : 30000,
        need: f.needRight != null ? f.needRight : 5,
      };
    },

    /* ★★ 题卡横条倒计时 —— **已按用户要求删除** ✗（2026-09-24："算了，不要横条计时了"）
     *   用户原话经过两轮：先说"要有这个词的横条倒计时（时间和圆环一致，减少速度也一致）"，
     *   看到实物后改口："**算了，不要横条计时了**" ✓ 于是**条连同数字、标签全部收起** ✓
     *   时间**只由每朵火的圆环**表达 ✓（一套计时 ✓ 不再有两处显示同一件事 ✓）
     *   ★ 保留 `_fireBar` 这个函数但**只用来把条清空/隐藏** ✗ 不删 ✓
     *     （`cdBar` 是 CombatScene 的控件 ✓ 我们只是不用它 ✓ 不销毁它 ✓）*/
    _fireBar(scene, f) {
      if (!scene || !scene.cdBar) return;
      if (scene.cdBar.setVisible) scene.cdBar.setVisible(false);
      if (scene.cdText && scene.cdText.setVisible) scene.cdText.setVisible(false);
      const g = scene._kq;
      if (g && g.cdLabel && g.cdLabel.setVisible) g.cdLabel.setVisible(false);
      if (g && g.cdGrad && g.cdGrad.setVisible) g.cdGrad.setVisible(false);
      if (g && g.cdMask && g.cdMask.setVisible) g.cdMask.setVisible(false);
    },
    /* 五个固定落点：**都在中栏之外** ✓
     *   中栏占用：选项 308~972 / 词卡 300~980 ✓  立绘牌内侧边 360 与 920 ✓
     *   → 左右空档正好放 x=400 / 880 ✓ 第五朵放上缘 x=640 ✓ 一个都不压 ✓ */
    FIRE_SLOTS: [{ x: 400, y: 190 }, { x: 400, y: 330 }, { x: 880, y: 190 },
                 { x: 880, y: 330 }, { x: 640, y: 104 }],
    /* ★ 点开一朵火后，它**停在奎隆头顶的正中线上** ✓ 而且**不缩小** ✓
     *   （用户 2026-09-24："到中线上去，另外大小不要缩小"）
     *   · 中线 ＝ 立绘牌中心 `x = 1130` ✓（与牌、与"奎隆"名字、与血条**同一竖轴** ✓）
     *   · 大小**保持原尺寸**（scale 1 ✓ 与其它四朵一致 ✓ 不再缩成 0.55 ✗）
     *   ★ 高度是算过的：立绘牌顶边 y=160 ✓ 页眉线 y=52
     *     原尺寸环直径 116 → 圆心放 y=104 时占 **46~162** ✓ 上不压页眉线、下不压牌 ✓
     *   ★ 原来两个并排位（1078/1182）已按用户要求**取消** ✗ 只留正中一个 ✓
     *     （同一时刻只会有一朵被点开 ✓ 所以不会叠 ✓ 若将来允许多朵停放，需要另设纵向错位 ✓） */
    FIRE_PARK: { x: 1130, y: 104 },

    /* 建一阶段全套（火 + 答对计数 + 每帧计时） */
    _fireBuild(scene) {
      if (!this._isFireStage(scene)) return;
      const g = scene._kq; if (!g) return;
      const s = this._s(scene);
      const cfg = this._fireCfg(scene);
      g.fire = { list: [], open: -1, right: 0, asked: 0, done: false, used: [], cfg: cfg, objs: [],
                 glowT: 0, refreshedPhase: 1, lastDir: null };   // glowT 供"最紧急火"的呼吸相位用 ✓
      /* ★ `asked` ＝ **出过的题数（对错都算）** ✓
       *   "最紧急火提示"的触发条件是它（不是 `right` ✓ 见 `_fireHotIdx` ✓）
       * ★ `refreshedPhase` ＝ **已经为哪个阶段整场刷过火** ✓
       *   开场是 1 ✓（一阶段的题在建场时已经抽好了 ✓ 不用刷 ✓）
       *   进二阶段时 `_fireEnd` 会把它改成 2 并整场重抽 ✓ → 于是二阶段一进去就是双向 ✓ */
      /* ★ 「已答对 N 次」这行**已删** ✗（2026-09-24 用户："这个删掉"）
       *   它原来放在 (994, 490) ✓ 而血量数字 `hpnum` 在 (994, 494) →
       *   **两者重叠 4px** ✓ 屏幕上糊成一团（用户截图就是这个 ✓ 我算错位置了 ✓）
       *   ★ 删掉后：作答进度不再显示 ✓ **最紧急火提示**本身就承担了"接下来打哪朵"的指引 ✓ */
      for (let i = 0; i < cfg.count; i++) this._fireSpawn(scene, i);
      this._fireRefresh(scene);
      this._fireBar(scene, null);          // 开局没有点开的火 → 条归零、数字清空 ✓
      /* 每帧计时：挂在 scene 的 update 事件上 ✓ **不改 CombatScene** ✓ */
      g.fire.onTick = (t2, dt) => { this._fireTick(scene, dt); };
      scene.events.on('update', g.fire.onTick);
    },

    /* 生成/补位一朵火（slot 固定 → 补位不换位置 ✓） */
    _fireSpawn(scene, slot) {
      const g = scene._kq; if (!g || !g.fire) return;
      const s = this._s(scene);
      const cfg = g.fire.cfg;
      const pos = this.FIRE_SLOTS[slot % this.FIRE_SLOTS.length];
      const w = this._firePickWord(scene);
      if (!w) return;
      const old = g.fire.list[slot];
      if (old && old.box && old.box.destroy) { try { old.box.destroy(); } catch (e) {} }
      const size = 116 * s, r = size / 2;
      const box = scene.add.container(pos.x * s, pos.y * s).setDepth(21);
      /* ==================================================================
       * ★★★ 绘制顺序是这里的**唯一坑**（2026-09-24 折腾了一整轮才找到 ✗ 别再弄反 ✓）
       *   容器内的显示顺序 ＝ **加入顺序** ✓ 后加的盖前面的 ✓
       *   ✗ 我原来的顺序：`arc → ring → hole` → **弧被底环和中心圆盘整个盖住** ✓
       *     底环 半径 58/宽 8（盖 54~62）＋ 中心盘 半径 54（alpha 0.92）
       *     ⇒ 弧在 54~62，**几乎全被盖**，只剩外缘一丝 → 截图里那圈"极淡的红" ✓
       *     这就是我一直看到的"红在哪／看不清楚／什么都看不见"的**真正根因** ✗
       *     （我却一直在改颜色、改形状、改粗细 ✗ 全是无用功 ✓）
       *   ✓ 正确顺序：**底环 → 中心盘 → 弧（最后）** ✓ 弧在最上层 ✓
       * ================================================================== */
      /* ------------------------------------------------------------------
       * ★ 底环两态（照抄预览 C 案 ✓ 用户 2026-09-24："百分百还原"）
       *   常态 `.ringbg{border:8px solid #0b0b12}` → **近黑 8px**
       *   最紧急 `.fire.C.hot .ringbg{border-color:#5a1f14}` → **暗红棕 8px**
       *   ★ 用两个 Graphics 常驻、只切 `visible` ✗ 不每帧重画（省 ✓ 无闪烁 ✓）
       * ------------------------------------------------------------------ */
      const ringBase = scene.add.graphics();
      ringBase.lineStyle(Math.max(3, Math.round(8 * s)), 0x0b0b12, 1);
      ringBase.strokeCircle(0, 0, r);
      const ringHot = scene.add.graphics();
      ringHot.lineStyle(Math.max(3, Math.round(8 * s)), 0x5a1f14, 1);
      ringHot.strokeCircle(0, 0, r);
      ringHot.setVisible(false);                 // 默认常态 ✓
      const hole = scene.add.circle(0, 0, r - 4 * s, 0x14141c, 0.92);
      hole.setStrokeStyle(1, K.bronzeN, 0.55);
      const arc = scene.add.graphics();          // ★ 最后加 → 在最上层 ✓
      /* ★ 外扩光环（2026-09-24 加强项 ✓ 用户："还是不明显"）
       *   ★★ 试错记录（别重走 ✗）
       *     ① 独立 Graphics + `strokeCircle` + **物体 alpha** → **压根渲染不出来** ✗
       *        （alpha 设到 0.65、又把它加到容器最上层 ✓ 仍不可见 ✓ 两次实测 ✓）
       *     ② 正解：**在"最紧急"那朵外面再画两道同心弧** ✗ 不用独立对象 ✓
       *        · 复用 `arc` 这个 Graphics ✓（它的 `arc()` **本项目已验证能渲染** ✓ 主弧就是它画的）
       *        · alpha 走 `lineStyle(color, alpha)` ✓（图形自身 alpha ✓ 稳定）
       *        → 见 `_fireRefresh` 里 isHot 分支的那两段 ✓
       *   ★ 所以这里**不再建 glow 对象** ✗（建了也不用 ✓ 白占一层 ✓）*/
      /* ★★ 火上写什么 ✗✗（2026-09-24 用户定：三阶段**只显示关键词**）
       *   一/二阶段：题面本身（`w.word` ✓ 英文词 或中文释义 ✓）
       *   三阶段：**关键词**（`w.key` 如 `subject` ✓）→ 保留“点开才知道考什么”的悬念 ✓
       *   ★ 字号自适应 ✓（关键词最长 13 字母如 `concentrate` ✓ 火环内径约 96px ✓）*/
      const kTxt = (this._phaseOf(scene) >= 3 && w.key) ? w.key : w.word;
      const kSize = (this._phaseOf(scene) >= 3)
        ? (kTxt.length <= 8 ? 17 : (kTxt.length <= 11 ? 15 : 13))
        : 15;
      const wTxt = Babel.UI.text(scene, 0, -6 * s, kTxt, {
        font: Babel.FONTS.num, size: Math.round(kSize * s) + 'px', color: K.bronzeHiS, origin: [0.5, 0.5]
      }).setDepth(22);
      const tTxt = Babel.UI.text(scene, 0, 14 * s, '', {
        font: Babel.FONTS.num, size: Math.round(12 * s) + 'px', color: K.silverS, origin: [0.5, 0.5]
      }).setDepth(22);
      /* ★ glow 加到**最后** ✗ —— 容器里后加的盖前面的 ✓
       *   加在最前面时它会被后面的底环/中心盘压住 ✓（alpha=0.65 却几乎看不见 ✓ 我实测过 ✓）*/
      box.add([ringBase, ringHot, hole, arc, wTxt, tTxt]);
      hole.setInteractive({ useHandCursor: true });
      hole.on('pointerup', () => { this._fireOpen(scene, slot); });
      g.fire.objs.push(box, arc, ringBase, ringHot, hole, wTxt, tTxt);
      g.fire.list[slot] = {
        slot: slot, box: box, arc: arc, hole: hole,
        ringBase: ringBase, ringHot: ringHot,
        wTxt: wTxt, tTxt: tTxt,
        word: w.word, senses: [w.zh].concat(w.bad),
        /* ★ 三阶段的**关键词**（火上显示的就是它 ✓）
         *   ★ 必须**存进火对象** ✗ 不能只写进显示文字 ✓
         *     （自测拓到：`f.key` 恒为 undefined → “5 朵火各不相同”那条断言形同虚设 ✓）*/
        key: w.key || null,
        /* ★ 三阶段：整条短语的**中文释义**（骨架下面那行 ✓）
         *   ★ 同样必须**存进火对象** ✗（与 key 同一个坑 ✓ 自测拓到 ✓）*/
        zhPhrase: w.zhPhrase || null,
        full: w.full || null,
        /* ★ 出题方向（二阶段随机 ✓ 一阶段恒为 en2zh ✓）：'en2zh' | 'zh2en'
         *   `word` 存的是**题面**（en2zh 时是英文、zh2en 时是中文 ✓）
         *   `senses[0]` 恒为**正确选项**（en2zh 时是中文释义、zh2en 时是英文单词 ✓）
         *   → 渲染层不用关心方向，它只管"题面 + 四个选项" ✓ 逻辑最简 ✓ */
        dir: w.dir || 'en2zh',
        /* ★★★ 这道题考的**英文词** ✗✗（2026-09-30 用户："奎隆问题和圣徒一样"）
         *   症状：结算「对题」里奎隆那组的 49 个词**全是同一个词**（如 `supper`）✓
         *   病因（与圣徒那次同源 ✗）：记账取的是 `scene._target` ✗
         *     · `_target` **只在两处赋值** —— `CombatScene` L702 / L743 ✓
         *       而这两处都是**词卡 quiz 的分支**（anagram / maskless）✗
         *     · 奎隆火阶段**从不经过那里** → `_target` 一直是**上一张词卡的词** ✓
         *       → 整场 49 题全记成那个词 ✓
         *   ⇒ 修法（照抄圣徒的思路 ✓）：**在题目生成时就把词存到题目对象上** ✗
         *     不要依赖"场景上某个共享字段"✓ 那种字段的生命周期不由这题管 ✓
         *   ★ 取哪个词，按**方向**定 ✗（问自己：玩家答的那个"英文词"是哪个 ✓）：
         *     · `en2zh`（题面是英文）→ 题面就是答案 → `w.en`
         *     · `zh2en`（题面是中文）→ 答案是**选项里的那个英文** → `w.options[w.correctIndex]`
         *     · `prep`（三阶段）→ 题面是骨架 `be subject ___` ✗
         *       真正考的词是 `w.key`（`subject` ✓ 也是火上显示的那个 ✓）
         *   ★ 兜底顺序要写全 ✗：`w.en` → `w.key` → `''`（宁可为空也别记错词 ✓）*/
        logEn: (function () {
          const d = w.dir || 'en2zh';
          if (d === 'zh2en') {
            const oi = (w.correctIndex != null && w.correctIndex >= 0) ? w.correctIndex : 0;
            return (w.options && w.options[oi]) ? String(w.options[oi]) : (w.en || '');
          }
          if (d === 'prep') return w.key || w.en || '';
          return w.en || w.key || '';
        })(),
        /* ★ 正确项下标（2026-09-24）：走全局库时**不是 0** ✗ 必须存下来 ✓
         *   `sensesCorrect` ＝ 在 `senses`（正确项在前）里的下标 → 恒为 0 ✓
         *   `bankCorrect`  ＝ 全局库原始 `options` 里的下标（仅本地库回退时为 -1 ✓）*/
        sensesCorrect: 0, bankCorrect: (w.correctIndex != null ? w.correctIndex : -1),
        bankOptions: w.options || null,
        /* ★ `shuffled` 初值必须是 null ✗ —— 它是"这一题的选项顺序" ✓
         *   在 `fireNewWord` 里**第一次**渲染时才洗一次并记住 ✓
         *   以后重入的渲染（`_delayedNext` 的 700ms 回调）**复用**它 ✓ 不再重洗 ✓
         *   → 每题只洗一次 ✓ 正确项位置不会中途跳 ✓ */
        shuffled: null,
        left: cfg.lifeMs, total: cfg.lifeMs, alive: true, corner: false, scale: 1,
        /* ★★★ 点火时刻**留空** ✗✗（2026-09-24 修正）
         *   病因：原来在这里就取了 `this._fireClock(scene)` ✗
         *     而"建场"到"玩家真正看到这一帧"之间还有一段时间 ✓
         *       （切场景 / 立绘与 BGM 解码 / 第一次渲染 ✓）
         *     → `_fireTick` 用绝对时间算剩余 ✓ 于是那段被算成"已经过掉了" ✓
         *     → 第一眼看到的就是 **12s** 而不是 15s ✓
         *       （上一次打过圣徒 → 第二次进奎隆时切换更慢 → 少得更多 ✓ 与用户描述完全一致 ✓）
         *   修：**t0 留 null** ✓ 由 `_fireTick` 在它**自己第一次跑到这朵火时**才定 ✓
         *     —— `_fireTick` 里 `(f.t0 != null ? f.t0 : (f.t0 = now))` **本来就写好了** ✓
         *       只是这里提前把它填上了 ✗ 于是那句兜底永远轮不到 ✓
         *   ★★ 口径：**"限时"应从"玩家能看见的那一刻"起算** ✗
         *     不是从"对象被创建的那一刻" ✓（创建 ≠ 可见 ✓）*/
        t0: null,
        r: r, size: size, sx: pos.x * s, sy: pos.y * s
      };
    },

    /* ★★ 抽词：改走**全局大词库** ✗（2026-09-24 用户："这个走全局大词库（注意一局游戏当中不能重复的机制）"）
     *   · 用 `Babel.WORDBANK.draw(floor, difficulty)` ✓
     *     —— 它内部**已经**用 `Babel.RunState.usedWords` 保证**同一局内不重复** ✓
     *        （大词库 3500+ 条 ✓ 本局共用一份记录 ✓ 跨战斗也不会重 ✓ 正是用户要的"一局不重复" ✓）
     *   · 它返回 `{ en, options(已打乱), correctIndex }` ✓
     *     ⇒ 所以**不能**再假设"正确项是下标 0" ✗ 要把 `correctIndex` 一起存下来 ✓
     *   · 回退链：全局库没词 → 用旧的 `FIRE_WORDS`（保留 ✓ 防呆 ✓）→ 都没词才返回 null ✓
     *   · `used` 那套（本阶段自己的去重）**不再需要** ✗（交给全局库 ✓ 我保留字段免得别处引用报错 ✓）*/
    _firePickWord(scene) {
      const g = scene._kq; if (!g || !g.fire) return null;
      /* ★★★ 三阶段「无忧觉」：改抽**介词搭配** ✗✗（2026-09-24 用户定稿）
       *   ★ 这里返回的结构与一/二阶段**同形** ✓ 所以下游（火上文字、出题、选项、判分、
       *     火灭、补位、掉血、倒计时）**一行都不用改** ✓
       *   ★ 只回三阶段的题 ✓（`_phaseOf >= 3` 门控 ✓ 一二阶段与其它战斗零影响 ✓）*/
      if (this._phaseOf(scene) >= 3) {
        const prep = this._prepPick(scene);
        if (prep) return prep;
        /* 词库空 / 抽不出 → 落回下面的大词库 ✓ 不留空题 ✓ */
      }
      const RS = Babel.RunState || {};
      const floor = RS.floor != null ? RS.floor : 0;
      const diff = (scene.difficulty != null) ? scene.difficulty : (RS.difficulty != null ? RS.difficulty : 1);
      /* ★★ 本阶段自己的"一局内已用"表 ✗（用户："注意一局游戏当中不能重复的机制"）
       *   ★ 为什么不能只靠全局库的 `usedWords`：
       *     ① 它是**整个 RunState 共用**的 ✓ 前半局别的战斗already用掉的词会算进去 ✓（那是对的 ✓）
       *     ② 但它有"候选不足 → 清空从头再来"的兜底 ✗ 真跑空时会**放出重复词** ✓
       *     ③ 大词库 3500+ 条 + 本场最多几十题 ✓ 实际很难跑空 ✓ 但**不能靠"很难"** ✗
       *   → 所以在这里再记一份 `g.fire.usedBank` ✓ 抽到已用过的就**重抽**（最多 30 次）✓
       *     重抽仍失败才接受（防死循环 ✓）—— 那种情况说明全库真的用尽了 ✓
       *   ★ 这份表**跨战斗**保留（存在 `RunState.fireUsed` ✓ 用户明确要"一局内不重复" ✓）*/
      if (!Array.isArray(RS.fireUsed)) RS.fireUsed = [];
      const used2 = RS.fireUsed;
      const acceptW = function (w) {
        return w && w.en && w.options && w.options.length >= 4 && used2.indexOf(w.en) < 0;
      };
      try {
        if (Babel.WORDBANK && Babel.WORDBANK.draw) {
          let w = null;
          for (let k = 0; k < 30; k++) {
            const cand = Babel.WORDBANK.draw(floor, diff);
            if (!cand) break;
            if (acceptW(cand)) { w = cand; break; }
            w = w || cand;                     // 留个兜底（万一 30 次都撞 ✓ 别返回 null ✓）
          }
          if (w && w.en && w.options && w.options.length >= 4) {
            used2.push(w.en);
            g.fire.used.push(w.en);
            /* ★★ 二阶段「双向考」：方向**交替**出现 ✗✗
             *   （2026-09-24 用户："新生成的火中文英文交替出现，避免出现极端情况"）
             *   ★ 原来是**每朵独立掷 50/50** ✓ 会撞出"连续 4~5 朵都是同一方向"的极端 ✓
             *   → 改成**交替**：上一朵是英→中，这一朵就中→英 ✓ 反之亦然 ✓
             *   · 于是任意连续 5 朵里最多 3 英 2 中（或反之）✓ 不会出现"全是英文"✓
             *   · 玩家也能预期"下一朵大概是反的"✓ 比纯随机更好读 ✓
             *   ★ 起点：进场第 1 朵掷一次 50/50（保证每次开局不总是同一种 ✓）
             *     之后严格交替 ✓ 跨阶段也连续 ✓（状态存在 `g.fire.lastDir` ✓）
             *   ★ 只有**二阶段**走双向 ✗ 一阶段恒为 en2zh（用户没要求改一阶段 ✓）*/
            const twoWay = (this._phaseOf(scene) >= 2);
            let dir = 'en2zh';
            if (twoWay) {
              const last = g.fire.lastDir;
              if (last === 'en2zh') dir = 'zh2en';
              else if (last === 'zh2en') dir = 'en2zh';
              else dir = (Math.random() < 0.5) ? 'zh2en' : 'en2zh';   // 首朵：掷一次 ✓
              g.fire.lastDir = dir;
            }
            if (dir === 'zh2en') {
              const zh = w.options[w.correctIndex];
              const pool = (w.uniq && w.uniq.length) ? w.uniq : [];
              const badEn = [];
              let guard2 = 0;
              while (badEn.length < 3 && guard2 < 200) {
                guard2++;
                const c = pool[Math.floor(Math.random() * pool.length)];
                if (!c) break;
                if (c[1] === zh) continue;                    // ★ 释义不同（这就是去重 ✓）
                if (c[0] === w.en) continue;                  // ★ 不能是正确项自己 ✓
                if (badEn.indexOf(c[0]) >= 0) continue;        // ★ 英文不重复 ✓
                badEn.push(c[0]);
              }
              /* 干扰项凑不够 3 个（词库异常）→ 退回英→中 ✓ 不留残题 ✓ */
              if (badEn.length === 3) {
                const opts2 = [w.en].concat(badEn);
                return { word: zh, zh: w.en, bad: badEn,
                         options: opts2, correctIndex: 0, fromBank: true, dir: 'zh2en' };
              }
            }
            return { word: w.en, zh: w.options[w.correctIndex],
                     bad: w.options.filter(function (_, i) { return i !== w.correctIndex; }),
                     options: w.options, correctIndex: w.correctIndex, fromBank: true, dir: 'en2zh' };
          }
        }
      } catch (e) { /* 全局库异常 → 落回下面的本地库 ✓ 不留空 ✓ */ }
      const all = Babel.FIRE_WORDS || [];
      if (!all.length) return null;
      let cand = all.filter(function (w) { return g.fire.used.indexOf(w.word) < 0; });
      if (!cand.length) { g.fire.used = []; cand = all.slice(); }
      const w2 = cand[Math.floor(Math.random() * cand.length)];
      g.fire.used.push(w2.word);
      return { word: w2.word, zh: w2.zh, bad: w2.bad.slice(),
               options: null, correctIndex: -1, fromBank: false };
    },

    /* ★★ 三阶段抽一条介词搭配 ✗（与 `_firePickWord` 同一套“一局不重复”手法 ✓）
     *   返回形状与一/二阶段**完全一致** ✓
     *     word   ＝ 骨架（`be subject ___` ✓ 题面）
     *     senses ＝ 四个介词✓ **正确项在第 0 位** ✓（与 `_firePickWord` 同约定 ✓）
     *     bad    ＝ 后三个干扰项 ✓
     *     key    ＝ 关键词（火上只显示它 ✓）
     *     full/zh＝ 完整短语与释义 ✓（答完的反馈用 ✓）
     *   ★ `usedPrep` 存在 `RunState` 上 ✓ → **一局内跨战斗也不重复** ✓（与 `fireUsed`/`antonymUsed` 同一思路 ✓）*/
    _prepPick(scene) {
      const g = scene._kq; if (!g || !g.fire) return null;
      const all = Babel.PREP_WORDS || [];
      const pool = Babel.PREP_POOL || [];
      if (!all.length || pool.length < 4) return null;
      const RS = Babel.RunState || {};
      if (!Array.isArray(RS.usedPrep)) RS.usedPrep = [];
      let cand = all.filter(function (e) { return RS.usedPrep.indexOf(e.k) < 0; });
      if (!cand.length) { RS.usedPrep = []; cand = all.slice(); }   // 全用完 → 重开一周 ✓
      const e = cand[Math.floor(Math.random() * cand.length)];
      RS.usedPrep.push(e.k);
      /* 干扰项：从介词池里取 3 个 ✓ 排除正确项 ✓ */
      const bad = [];
      let guard = 0;
      while (bad.length < 3 && guard < 200) {
        guard++;
        const c = pool[Math.floor(Math.random() * pool.length)];
        if (!c || c === e.p || bad.indexOf(c) >= 0) continue;
        bad.push(c);
      }
      if (bad.length < 3) return null;                              // 池子异常 → 交回上层 ✓
      /* ★★ 形状必须对齐 `_fireSpawn` 的取用方式 ✗✗
       *   它写的是：`word: w.word` ／ `senses: [w.zh].concat(w.bad)` ✓
       *   → 所以我要给：
       *       `word`  ＝ 骨架（`be subject ___` ✓ 题面 ✓）
       *       `zh`    ＝ **正确的介词**（✓ 它会被放在 `senses[0]` ✓→正确项在第 0 位 ✓）
       *       `bad`   ＝ 三个干扰介词 ✓
       *       `options`＝ 四个介词（`length >= 4` ✓ 供校验用 ✓）
       *   ★ 口径：**自定义题库时，要照下游的“取用方式”给数据** ✗
       *     不是照自己的直觉命名 ✓（我原来给的是 `senses` ✓ 下游压根不看它 ✓）*/
      return {
        word: e.s,
        zh: e.p,
        bad: bad.slice(),
        options: [e.p].concat(bad),
        correctIndex: 0,
        key: e.k, full: e.full, zhPhrase: e.zh, tag: e.tag,
        fromBank: true, dir: 'prep'
      };
    },

    /* 点开一朵火 → 它缩到角落、题目占满中栏 ✓ */
    _fireOpen(scene, slot) {
      const g = scene._kq; if (!g || !g.fire) return;
      const f = g.fire.list[slot];
      if (!f || !f.alive) return;
      if (g.fire.open >= 0) this._fireCorner(scene, g.fire.open, false);
      g.fire.open = slot;
      this._fireCorner(scene, slot, true);
      /* ★★ 先把四个选项**清空并藏起来** ✗（2026-09-24 用户："点开后一瞬选项会是其他几个单词，
       *   然后马上又会改变并固定下来"）
       *   病因：选项按钮上还留着**上一题的文字** ✓ 而它们此刻可见 ✓
       *     `_delayedNext` 那 700ms 里也可能被短暂看到 ✓ → 就是那一瞬的"其他几个单词" ✓
       *   修：出题前先清空+藏 ✓ 等 `fireNewWord` 填好新文字再显 ✓ → 中间那一下看不见 ✓ */
      (scene.optionButtons || []).forEach(function (b) {
        if (!b) return;
        if (b.list && b.list[1] && b.list[1].setText) b.list[1].setText('');
        if (b.setVisible) b.setVisible(false);
      });
      if (scene._shown) scene._shown = [];
      /* ★ 点开新一朵时，先把**三阶段的中文提示**清掉 ✗（2026-09-24）
       *   ★ 为什么放这里 ✗ —— 与“清空四个选项”同一处 ✓
       *     下一步 `_newWord` 会把新题填进去 ✓ 中间**不会被别处清掉** ✓
       *   ★ 别放在“空题态”那条分支里 ✗ —— 它在“火开着”时不执行 ✓ 而我当初就错放在那里 ✓ */
      if (g.prepHint) { try { g.prepHint.setText('').setVisible(false); } catch (e) {} }
      this._fbHide(scene);                          // ★ 换题 → 上一题的碑铭收起来 ✓
      /* ★ 出题交给 CombatScene 的既有路径 ✓ 皮肤只在 `_newWord` 里把词/选项换掉 ✓ */
      if (scene._newWord) scene._newWord();
    },

    /* 停到"奎隆头顶中线" / 还原到自己的落点
     *   ★ 用容器 `setScale` ✓ 图形都在容器里一起缩 ✓
     *   ★ 用户 2026-09-24 口径："**到中线上去，另外大小不要缩小**"
     *     → 停放时 `scale = 1`（**与原尺寸一致** ✗ 不再缩到 0.55 ✓）
     *     → 位置固定 `(1130, 104)` ✓ 不按 slot 号、也不按"已停几朵" ✗（只可能有一朵 ✓）*/
    _fireCorner(scene, slot, corner) {
      const g = scene._kq; if (!g || !g.fire) return;
      const f = g.fire.list[slot]; if (!f) return;
      const s = this._s(scene);
      f.corner = !!corner;
      const k = corner ? 1 : 1;                    // ★ 两边都是 1 → 不缩 ✓（保留变量便于日后要缩）
      if (f.box.setScale) f.box.setScale(k);
      if (f.box.setPosition) {
        const P = this.FIRE_PARK;
        f.box.setPosition(corner ? P.x * s : f.sx, corner ? P.y * s : f.sy);
      }
    },

    /* ======================================================================
     * ★★ 最紧急火提示（C 案「呼吸提亮」✓ 2026-09-24 用户选定 ✓）
     *   口径（用户原话）：
     *     · "**从打了一个题开始**，最快倒计时结束的题要有视觉上的提示"
     *       → 触发条件 ＝ `g.fire.right >= 1`（**答对过至少 1 题** ✓ 开局五朵都是 20 秒，
     *         此时标"最紧急"没有意义 ✗）
     *     · "如果有多个一样的就选其中一个" ✓ → 并列时**取下标最小的那一朵** ✓ 只标一朵 ✗
     *   ★ C 案的视觉（**不改轮廓** ✓ 最克制 ✓）：
     *     ① 弧**变亮**（朱红 → 亮朱红 `0xE86B4F`）② 弧**加粗**（8 → 10px）
     *     ③ 整朵**轻微放大回缩**（1.00 ↔ 1.07 ✓ 呼吸 ✓）
     *     ④ 中心盘描边 → 阶段橙 ✓
     *     ＋ **呼吸周期随剩余时间收紧**（还早 2.2s → 快爆 0.8s ✓ 越急跳得越快 ✓）
     *   ★ 只有**当前开着题**的那一朵**不参与** ✗（它正被你答，标"最紧急"没意义 ✓）
     * ==================================================================== */
    _fireHotIdx(scene) {
      const g = scene._kq;
      if (!g || !g.fire) return -1;
      /* ★★ 触发条件：**只要出过一题**（不论对错）就开 ✓
       *   用户 2026-09-24："第一题后**即使答错也要**开始高亮显示最快扣血的"
       *   → 原来用 `right >= 1`（只数答对）✗ → 答错就一直不亮 ✓ 已改成 `asked >= 1` ✓ */
      if ((g.fire.asked || 0) < 1) return -1;
      /* ★★ 用户追加口径："**只在还在选题的时候触发该效果，答题过程中不要**"
       *   → 只要有任意一朵被点开（正在答题）→ **整体不标** ✓ */
      if (g.fire.open >= 0) return -1;
      const list = g.fire.list || [];
      let idx = -1, mn = Infinity;
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        if (!f || !f.alive) continue;
        if (f.left < mn) { mn = f.left; idx = i; }        // ★ 严格小于 → 并列时取**下标最小**的 ✓
      }
      return idx;
    },

    /* 呼吸相位：周期随紧迫度收紧 ✓ 同时把 scale / 光环 写进活跃的那一朵 ✓
     *   ★ 加强项（用户："还是不明显" ✓ 2026-09-24）：
     *     ① 呼吸幅度 `1.07 → 1.14`
     *     ② **外扩光环**：一圈朱红向外扩散并淡出 ✓ 周期与呼吸同步 ✓
     *     ③ 弧宽 `10 → 12px`（在 `_fireRefresh` 里 ✓）
     *     ④ **词提亮**（`#FFD9C8` ✓ 在 `_fireRefresh` 里 ✓）
     *     ⑤ 秒数**常驻橙**（在 `_fireRefresh` 里 ✓）*/
    _fireHotApply(scene, dtMs) {
      const g = scene._kq;
      if (!g || !g.fire) return;
      const hot = this._fireHotIdx(scene);
      g.fire.hotIdx = hot;
      g.fire.glowT = (g.fire.glowT || 0) + dtMs;
      const list = g.fire.list || [];
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        if (!f || !f.alive || !f.box || !f.box.setScale) continue;
        if (i !== hot) {
          if (f.scale !== 1) { f.box.setScale(1); f.scale = 1; }
          continue;
        }
        /* 剩余越少 → 周期越短 ✓ 越急跳得越快 ✓
         * ★ 基准随 `lifeMs` 缩放 ✗ —— 用户把火改成 15 秒后（2026-09-24），
         *   写死 0.8~1.4s 就显得"跳得太慢" ✓ 现在按 `f.total` 归一：
         *   满时 ≈ 总时长的 6.5%，快爆 ≈ 3.5% ✓ 15s → 0.98~0.53s ✓ 20s → 1.30~0.70s ✓ 都跟手 ✓ */
        const p = Math.max(0, Math.min(1, f.left / f.total));
        const cyc = Math.max(420, f.total * (0.035 + 0.03 * p));
        const ph = (g.fire.glowT % cyc) / cyc;            // 0~1
        /* ① 呼吸 1.00 ~ 1.14（余弦 ✓ 端点/中点与 CSS `ease-in-out` 一致 ✓）*/
        const k = 1 + 0.14 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
        f.scale = k;
        f.box.setScale(k);
        /* ② 外扩光环：**反相**呼吸（呼吸到最大时它最淡 ✓ 形成"心跳"感 ✓）
         *    同时 scale 1.00 → 1.22 向外扩散 ✓ */
      }
    },

    /* 每帧：弧长 + 秒数 + 自爆 + 最紧急火的呼吸 ✓
     * ======================================================================
     * ★★★ 计时为什么**不用 `left -= dt`**（2026-09-24 用户："15秒好像不是真的15秒，
     *     感觉要快很多"／"第一次没问题，第二次测试就快了" ✓ 查了两轮才定下来 ✓）
     *   用 dt 累加有两个先天弱点（都会表现为"变快" ✗）：
     *     ① **单位依赖**：`update` 事件第二参的单位随版本而变（3.80 是**秒** ✓）
     *        我原来直接当毫秒用 → 永远小于 500 → 防跳帧钳制每帧生效 → 每帧恒减 16ms ✗
     *     ② **调用次数依赖**：`left -= dt` 是**累加式** ✓
     *        只要 `_fireTick` 在一帧里被调 2 次（监听重复挂 ✓ 或别处也调 ✓），
     *        时间就**直接快一倍** ✗ —— 这正是"第二次变快"最像的成因 ✓
     *   → 改成**绝对时间**：只记"点火时刻"，剩余 ＝ 时长 −（现在 − 点火时刻）✓
     *     · 与 dt 单位无关 ✓ 与一帧被调几次**完全无关**（重复调用只是重复算同一个值 ✓）
     *     · 也不怕掉帧（掉帧时下一帧自然补上 ✓ 反而更准 ✓）
     *     · **唯一**怕的是系统时钟倒退（不会发生 ✓）
     *   ★ 口径：**凡是"按 dt 累加"的倒计时，一律改成"记起点 ＋ 取当前时间差"** ✗
     *     累加式对"被多调一次"毫无抵抗力 ✓ 而绝对式天然免疫 ✓
     * ==================================================================== */
    /* ★★★ 时钟源必须**整个战斗固定成一个** ✗✗（2026-09-24 自测连抓两次的真坑 ✓）
     *   我第一版：`_fireSpawn` 建 `t0` 时用 `performance.now()`，
     *     而 `_fireTick` 取"现在"时用 `game.loop.now` ✓
     *   两者**不同源**（`game.loop.now` 从**游戏启动**计、`performance.now` 从**页面加载**计 ✓）
     *   ⇒ `now - t0` 变成负数/巨大值 → `left` 立刻算成 0 →
     *     **五朵火在同一帧全部自爆** ✗（自测里表现为"用掉 0ms" ✓ 是我自己写出来的 bug ✓）
     *   → 根治：**在 scene 上记下"本场用哪个时钟"** ✓ 第一次问到就定下来 ✓
     *     之后 `_nowMs` 永远走同一分支 ✓ 建 `t0` / 算 `+5` / 每帧取时 全都同源 ✓ */
    _nowMs(scene) {
      /* ★★★ 时钟来源（2026-09-24 实测定死 ✗✗ 两轮才定下来）
       *   第一轮：用 `scene.game.loop.now` ✗
       *     → 实机角标实测 **它是冻结的**（`now` 恒 13170 ✓ `dt` 恒 0 ✓ 词永远不动 ✓）
       *   第二轮：改成"第一次调用时选一个来源并锁死" ✗
       *     → 而首次调用发生在**一阶段**（那时 `scene.time` 还没就绪 ✓）
       *       于是锁成了 'loop' ✓ 之后即使 `time.now` 可用也不再升级 ✗ 还是不动 ✓
       *   现在：**每次按优先级现取** ✗ 不锁死 ✓
       *     ① `scene.time.now` —— Phaser Clock 自己维护的"当前时间 ms" ✓
       *        **定义明确是毫秒** ✓（不像 `update` 事件第二参，单位随版本变 ✓）✓ 首选 ✓
       *     ② `scene.game.loop.now`（兜底 ✓ 有的版本它是对的 ✓）
       *     ③ `performance.now()` ／ ④ `Date.now()`
       *   ★ 只有调用方**显式**要 'perf' / 'date' 时才强制 ✓（自测与特殊场景用 ✓）
       *   ★ 口径：**不要用"第一次探测结果"去锁死一个环境能力** ✗
       *     首次探测往往发生在"环境还没就绪"的时候 ✓ 锁死就等于永久选错 ✓
       *     （这条与 44.40/44.41 是同一族坑：**别信"当时看起来对"的那个来源** ✓）*/
      const forced = scene && scene._kqClock;
      if (forced === 'perf' && typeof performance !== 'undefined' && performance.now) {
        scene._kqClockSrc = 'perf';
        return performance.now();
      }
      if (forced === 'date') { scene._kqClockSrc = 'date'; return Date.now(); }
      const tk = scene && scene.time;
      if (tk && typeof tk.now === 'number' && tk.now > 0) {
        scene._kqClockSrc = 'time.now';
        return tk.now;
      }
      const loop = scene && scene.game && scene.game.loop;
      if (loop && typeof loop.now === 'number' && loop.now > 0) {
        scene._kqClockSrc = 'loop.now';
        return loop.now;
      }
      if (typeof performance !== 'undefined' && performance.now) {
        scene._kqClockSrc = 'perf';
        return performance.now();
      }
      scene._kqClockSrc = 'date';
      return Date.now();
    },
    /* 本场时刻（**唯一入口** ✗ 谁要时间都调它 ✓）
     * ★★★ 真凶在这（2026-09-24 实机角标 ＋ 自测一起定出来的）
     *   我原来写的是：`if (g.fire && typeof g.fire.clockNow === 'number') return g.fire.clockNow;` ✗
     *   · `g.fire.clockNow` 是**火阶段**每帧写的值 ✓
     *   · 三阶段火**已被清掉**（`g.fire = null` ✓）→ 那个字段**永远停在最后一个值** ✓
     *   · 偏偏 `_fireClock` 还**优先**读它 → 三阶段永远拿到同一个死时间 ✓
     *     ⇒ `dt = now − flyT0` **恒为 0** ✓ **词永远不动** ✓
     *     （实机角标：`dt=0 now=13170 t0=13170` ✓ 与推断完全对上 ✓）
     *   → 修：**删掉那个缓存分支** ✗ 直接读活时钟 ✓
     *   ★ 口径：**"缓存上一个阶段的时刻"很危险** ✗ 阶段一变它就是死值 ✓
     *     而且它**不报错、不崩** ✓ 只是永远不动 ✓ 最难查的一类 ✓
     *   ★ 还有一条：**旧的 workaround 要跟着新实现一起清** ✗
     *     当初加这个缓存是为了"防两个时钟混用" ✓ 而那个问题已由 `_nowMs` 的优先链解决 ✓
     *     缓存留着反而制造了更严重的 bug ✓ */
    _fireClock(scene) {
      return this._nowMs(scene);
    },
    _fireTick(scene, dtMs) {
      const g = scene._kq;
      if (!g || !g.fire) return;
      const now = this._nowMs(scene);
      /* ★ 这行只是**留个痕迹**便于调试 ✗ 已经**没人读它**了 ✓
       *   （_fireClock 曾优先读它 ✓ 那正是三阶段词不动的真凶 ✓ 见 _fireClock 注释 ✓）*/
      g.fire.clockNow = now;
      /* 诊断计数（临时 ✓ 定位完删 ✗）：一帧被调几次、每秒几次 */
      const f0 = g.fire;
      if (f0.dbgNow == null) f0.dbgNow = now;
      f0.dbgTicks = (f0.dbgTicks || 0) + 1;
      f0.dbgCell = f0.dbgCell || { t0: now, n0: 0 };
      if (now - f0.dbgCell.t0 >= 1000) {
        f0.dbgPerSec = Math.round((f0.dbgTicks - f0.dbgCell.n0) * 1000 / (now - f0.dbgCell.t0));
        f0.dbgCell.t0 = now; f0.dbgCell.n0 = f0.dbgTicks;
      }
      (g.fire.list || []).forEach((f) => {
        if (!f || !f.alive) return;
        /* 绝对时间：剩余 ＝ 时长 − 已过 ✓（与 dt、与调用次数都无关 ✓）*/
        f.left = f.total - (now - (f.t0 != null ? f.t0 : (f.t0 = now)));
        if (f.left <= 0) this._fireBoom(scene, f.slot);
      });
      this._fireRefresh(scene);
      this._fireHotApply(scene, 16);     // 相位用固定步长即可（视觉 ✓ 不影响计时 ✓）
      this._bgSpinApply(scene);          // ★ 坛城转速按阶段调（幂等 ✓ 见函数注释 ✓）
      this._dmgCutLabel(scene, this._s(scene));   // ★ 减伤文案跟阶段走（幂等 ✓）
      this._fireEnd(scene);              // ★ 血量跌破阈值 → 火全撤 ✓（唯一的退场判定 ✓）
      this._fireCheckDead(scene);        // ★ 兜底：本帧若有扣玩家血 → 归零就收场 ✓
    },

    /* ★★ 玩家死了就收场 ✗✗（2026-09-24 用户："0血怎么没死"）
     *   病因：`_playerHit()` 会把 `scene._isDead` 置 true ✓ 但**没人检查它** ✗
     *     · 只有 `_delayedNext()`（答题之后那条路）会查 ✓
     *     · 而**火自爆也会扣血**（`_fireBoom` → `_playerHit`）✓ 那条路径之后没人查 →
     *       目标生命归零了战斗还在跑 ✓ 就是用户看到的现象 ✓
     *   → 凡是在本阶段扣了玩家血的地方，都调一次这个检查 ✓
     *   ★ 用 `try` 包住 ✗ 免得收场过程中的异常反过来卡住 tick ✓ */
    _fireCheckDead(scene) {
      try {
        if (scene && scene._isDead && scene._endBattle) scene._endBattle(false);
      } catch (e) { /* 收场异常不该卡住本帧 ✓ */ }
    },

    /* 自爆：掉血 ＋ **补位新火**（不留灰烬 ✗ 用户口径 ✓） */
    _fireBoom(scene, slot) {
      /* ★ 自爆也要告诉玩家发生了什么 ✗（2026-09-24）
       *   （一阶段火烧到底 → 你掉血 ✓ 但原来只有一声闪 ✓ 没有文字 ✓）*/
      this._fbPending = { ok: false, pre: '', ans: '火已烧尽', zh: '那朵火烧到底了' };
      const g = scene._kq; if (!g || !g.fire) return;
      const f = g.fire.list[slot];
      if (!f || !f.alive) return;
      /* ★ 结算记账：本场烧尽自爆的火数（2026-09-26 ✓ 只统计**真的**炸掉的那朵 ✓
       *   放在 `alive` 判定**之后** ✗ —— 已死的火不会被重复计数 ✓ */
      if (scene._runStats) scene._runStats.fireBoom++;
      f.alive = false;
      try { if (scene._playerHit) scene._playerHit(); } catch (e) {}   // ★ 复用现成掉血管线 ✓
      this._fireCheckDead(scene);                                      // ★ 扣完血立刻查死 ✗ 见函数注释 ✓
      this._fireFlash(scene, false);
      /* ★★★ 关键：**先记下"炸的是不是正在答的那朵"** ✗✗（2026-09-24）
       *   用户："别的火炸了为什么我现在在答的题下面选项都要炸？"
       *   病因：上一轮修"自爆后选项残留"时 ✗ 我加了**无条件的 `_fireWipeQ`** ✗
       *     → 它把整道题（题面 ＋ 四个选项 ＋ 题卡）全清了 ✓ **不管炸的是哪一朵** ✗
       *     → 玩家正在答 A 火 ✗ B 火炸了 → A 火的选项全没了 ✓
       *   修：**只在"炸的正是正在答的那朵"时才清题** ✗
       *     · 炸的是别的火 → 只补位 ＋ 闪一下 ＋ 掉血 ✓ **不碰当前这道题** ✓
       *     · 炸的是正在答的那朵 → 照旧清干净 ✓（这才是上一轮要修的那条 ✓）
       *   ★★ 口径：**"清某个 UI"的代码，必须带上"凭什么是它"的条件** ✗
       *     （上一轮我修得对 ✓ 但**清的范围太大** ✗）*/
      const wasOpen = (g.fire.open === slot);
      if (wasOpen) {
        g.fire.open = -1;
        if (scene.wordText) scene.wordText.setVisible(false);
      }
      this._fireSpawn(scene, slot);                                    // ★ 补位 ✓
      this._fireRefresh(scene);
      if (wasOpen) {
        /* ★ 炸的正是正在答的那朵 → 整道题清干净 ✓（顺序：先清、再写反馈 ✓）*/
        this._fireWipeQ(scene);
        if (this._fbPending) {
          try {
            this._fbPaint(scene, this._fbPending);
            if (scene.feedback && scene.feedback.setText) scene.feedback.setText('');
          } catch (e) {}
        }
        if (scene._answerHint && scene._answerHint.setVisible) scene._answerHint.setVisible(false);
      } else {
        /* ★ 炸的是**别的**火 → 只提示一句 ✗ **不碰当前这道题** ✓
         *   ★ 不写碑铭 ✓ —— 碑铭会盖掉当前题刚显示的反馈 ✓ 那就是干扰 ✓ */
        try {
          if (scene.feedback && scene.feedback.setText) {
            scene.feedback.setText('一朵火烧尽了').setColor(Babel.COLORS.RED);
          }
        } catch (e) {}
      }
    },

    /* ★★★ 伤害飘字 ✗（2026-09-24：让"最终乘算"看得见 ✓）*/
    /* ★★★ 敌人血条渐变（案 5「朱与铜」✗ 2026-09-24 用户选定）
     *   色标：酒红 → 朱红 → 褪色古铜 → 暗铜高光 ✓（全部来自现有色板 ✓）
     *   ★ 不再跨阶段变色 ✗（原来 `onWord` 里有一句按阶段刷朱红/官方红 ✓ 已删 ✗）
     *   ★ 用 `keep()` 登记 ✓ 离场时 `clear()` 会统一销毁 ✓ */
    _enemyBarGradBuild(scene, s, cx, cy) {
      const g = scene._kq; if (!g || !scene.enemyBar) return;
      /* ==================================================================
       * ★★★ 整条自己画 ✗✗（2026-09-24 修："怎么变成两条了"）
       *   病因：我只画了**渐变那一层** ✗ 坐标是按"条心 = cy+126"反推的 ✓
       *     而 CombatScene 那只**原生条仍在原位** ✓ 两者错开 → 屏幕上就是**两条** ✓
       *   ★★ 根因：**一条血条由两处分别画** ✗ 只要坐标算错一点就露馅 ✓
       *   修：**皮肤接管整条** ✗ —— 条底、渐变、刻度全用**同一套坐标**画 ✓
       *     · 原生条整条**隐藏** ✗（它自带的刻度线也一并藏 ✓）
       *     · **保留 `scene.enemyBar` 对象** ✓（CombatScene 会调它的 `setRatio` ✓）
       *       再包一层 `setRatio`：既转发给原生条（保持状态一致 ✓）又更新我的渐变 ✓
       *   ★ 几何**只算一次** ✓ 全部从这四个数派生 ✓
       * ================================================================ */
      const barW = 272 * s, barH = 16 * s;
      const barL = cx + 490 * s - barW / 2;
      const barCy = cy + 112 * s;                 // ★ 条的**竖直中心**（唯一真源 ✓）  ⚠ 用 112 不是 126 ✗ —— 126 时条底会压住 "ENEMY HP" 标签（原生几何就叠 5px ✓）
      const barCx = barL + barW / 2;
      const barTop = barCy - barH / 2;

      /* ---- ① 原生条整条藏掉（含它自带的 8 条刻度线 ✓）---- */
      try {
        if (scene.enemyBar.setVisible) scene.enemyBar.setVisible(false);
        const bgObj = scene.enemyBar._bg;
        const barObj = scene.enemyBar._bar;
        if (bgObj && bgObj.setVisible) bgObj.setVisible(false);
        if (barObj && barObj.setVisible) barObj.setVisible(false);
      } catch (e) {}

      /* ---- ② 自己画条底（冷银描边 ✓ 与其它 UI 同族 ✓）---- */
      const bgG = scene.add.graphics().setDepth(3);
      bgG.fillStyle(0x2a2a3c, 1);
      bgG.fillRect(barL, barTop, barW, barH);
      bgG.lineStyle(Math.max(1, Math.round(1 * s)), K.silverN, 0.55);
      bgG.strokeRect(barL, barTop, barW, barH);

      /* ---- ③ 渐变（案 5「朱与铜」✗ 68 段 ✓）---- */
      const GRAD = [
        [0.00, 0x6c2424], [0.36, 0xcc543c], [0.72, 0x9c846c], [1.00, 0xb4b49c]
      ];
      const gr = function (tt) {
        for (let i = 0; i < GRAD.length - 1; i++) {
          const t0 = GRAD[i][0], c0 = GRAD[i][1], t1 = GRAD[i + 1][0], c1 = GRAD[i + 1][1];
          if (tt >= t0 && tt <= t1) {
            const k2 = (t1 === t0) ? 0 : (tt - t0) / (t1 - t0);
            const r0 = (c0 >> 16) & 255, g0 = (c0 >> 8) & 255, b0 = c0 & 255;
            const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
            return ((Math.round(r0 + (r1 - r0) * k2) << 16) |
                    (Math.round(g0 + (g1 - g0) * k2) << 8) |
                     Math.round(b0 + (b1 - b0) * k2));
          }
        }
        return GRAD[GRAD.length - 1][1];
      };
      const gradG = scene.add.graphics().setDepth(4);
      const N = 68;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        gradG.fillStyle(gr((t0 + t1) / 2), 1);
        gradG.fillRect(Math.round(barL + barW * t0 + 1), Math.round(barTop + 2),
                       Math.ceil(barW * (t1 - t0)) + 1, Math.round(barH - 3));
      }
      /* ---- ④ 刻度（每 1/9 一条 ✓ 用**同一套坐标** ✓）---- */
      const tickG = scene.add.graphics().setDepth(5);
      tickG.fillStyle(0x0b0b0f, 0.34);
      for (let i = 1; i < 9; i++) {
        tickG.fillRect(Math.round(barL + barW * (i / 9)), Math.round(barTop + 2),
                       Math.max(1, Math.round(1 * s)), Math.round(barH - 3));
      }

      /* ---- ⑤ 裁切：只显示"剩余量"那一截 ✓（渐变不缩放 ✓）---- */
      const mk = (scene.make && scene.make.graphics) ? scene.make.graphics() : scene.add.graphics();
      mk.fillStyle(0xffffff, 1);
      mk.fillRect(0, 0, barW, barH);
      if (mk.setVisible) mk.setVisible(false);
      const mask = mk.createGeometryMask ? mk.createGeometryMask() : null;
      if (mask) { gradG.setMask(mask); mk.setPosition(barL, barTop); }
      /* 刻度不裁 ✓（它们是“量程”，不是“剩余”✓）*/

      g.enemyBarGrad = gradG;
      g.enemyBarMask = mk;
      g.enemyBarBgG = bgG;
      g.enemyBarTickG = tickG;
      /* ---- ⑥ 包 `setRatio`（只包一次 ✗）---- */
      if (!scene.enemyBar._gradWrapped) {
        const rawSet = scene.enemyBar.setRatio;
        scene.enemyBar.setRatio = function (r0) {
          if (rawSet) rawSet.call(this, r0);
          const r = Math.max(0, Math.min(1, (r0 == null ? 1 : r0)));
          if (g.enemyBarMask && g.enemyBarMask.setScale) g.enemyBarMask.setScale(r, 1);
        };
        scene.enemyBar._gradWrapped = true;
      }
      scene.enemyBar.setRatio(scene.enemyHP / scene.enemyMaxHP);
      return { grad: gradG, mask: mk, bg: bgG, tick: tickG };
    },
    /* ★ **阶段变了也不换颜色** ✗✗（2026-09-24 用户：
     *   "不要跨阶段变血条颜色"）
     *   原来这里写的是 `setColor(ph === 3 ? uiRedN : vermN)` ✓ 现在改成空函数 ✗
     *   ★ 但**不删除调用点** ✓ 保留一个同名方法（以后想加别的阶段反馈还有地方写 ✓） */
    _enemyBarTint() { /* 渐变颜色固定 ✓ 不随阶段变 ✗ */ },

    /* ★★★ 伤害飘字 ✗（2026-09-24：让"最终乘算"看得见 ✓）
     *   在敌人血条旁飘出：`-0.5` 或 `-1.5` ✓（一位小数 ✓ 不带无用的 0 ✓）
     *   ★ 用 `Babel.fmt1` 格式化 ✓（与血量显示同一口径 ✓）
     *   ★ 动效：向上漂 26px ✓ ＋ 淡出 ✓ 共 800ms ✓（不抢碑铭的戏 ✓）*/
    _dmgFloatShow(scene, dmg) {
      const g = scene._kq; if (!g) return;
      const s = this._s(scene);
      const cx = (scene.scale && scene.scale.width ? scene.scale.width : 1280) / 2;
      const cy = (scene.scale && scene.scale.height ? scene.scale.height : 720) / 2;
      const txt = '-' + Babel.fmt1(dmg);
      if (g.dmgFloat) { try { g.dmgFloat.destroy(); } catch (e) {} g.dmgFloat = null; }
      if (g.dmgFloatTw && g.dmgFloatTw.stop) { try { g.dmgFloatTw.stop(); } catch (e) {} g.dmgFloatTw = null; }
      if (!scene.add || !scene.add.text) return;
      const x = cx + 560 * s, y = cy + 170 * s - 26 * s;
      g.dmgFloat = scene.add.text(x, y, txt, {
        fontFamily: (Babel.FONTS && Babel.FONTS.num) || 'monospace',
        fontSize: Math.round(22 * s) + 'px', color: '#ffd9a0'
      }).setOrigin(0.5, 0.5).setDepth(62);
      g.dmgFloatTw = scene.tweens.add({
        targets: g.dmgFloat, y: y - 26 * s, alpha: 0, duration: 800, ease: 'Cubic.easeOut',
        onComplete: function () { try { if (g.dmgFloat) g.dmgFloat.destroy(); } catch (e) {} g.dmgFloat = null; }
      });
      g.tweens.push(g.dmgFloatTw);
    },

    /* ★★ 画碑铭式反馈 ✗（案 1 ✓ 三段颜色 ✓ 居中对齐 ✓）
     *   `parts = { tag, pre, ans, zh, ok }` ✓
     *   ★ 三段各自定宽后**整体居中** ✓
     *     （Phaser 没有 flex ✓ 只能自己算宽度 ✓）*/
    _fbPaint(scene, parts) {
      const g = scene._kq;
      if (!g || !g.fbTag) return;
      const s = this._s(scene);
      const cx = (scene.scale && scene.scale.width ? scene.scale.width : 1280) / 2;
      const gold = parts.ok ? 0xc8a24a : 0xe2231a;
      const goldS = parts.ok ? '#c8a24a' : '#e2231a';
      const tagTxt = parts.ok ? '◆ 判词无误 ◆' : '◆ 判词谬误 ◆';
      const ansTxt = (parts.pre ? (parts.pre + '  ') : '') + (parts.ans || '');
      const zhTxt = parts.zh ? ('  ' + parts.zh) : '';
      /* 设文字 + 取宽 */
      g.fbTag.setText(tagTxt).setColor(goldS).setVisible(true);
      g.fbAns.setText(ansTxt).setColor(parts.ok ? K.paleS : goldS).setVisible(true);
      g.fbZh.setText(zhTxt).setColor(K.bronzeS).setVisible(true);
      const w1 = (g.fbTag.width || 0), w2 = (g.fbAns.width || 0), w3 = (g.fbZh.width || 0);
      const total = w1 + 14 * s + w2 + w3;
      let x = cx - total / 2;
      g.fbTag.setPosition(x, g.fbTag.y); x += w1 + 14 * s;
      g.fbAns.setPosition(x, g.fbAns.y); x += w2;
      g.fbZh.setPosition(x, g.fbZh.y);
    },
    /* 把碑铭收起来 ✗（空题态 / 接着出题时 ✓）*/
    _fbHide(scene) {
      const g = scene._kq;
      if (!g) return;
      ['fbTag', 'fbAns', 'fbZh'].forEach(function (k) {
        if (g[k] && g[k].setVisible) { try { g[k].setVisible(false); } catch (e) {} }
      });
    },

    /* 答对/答错后收尾（由 onCorrect / onWrong 调 ✓） */
    _fireResolve(scene, ok, isTimeout) {
      const g = scene._kq;
      if (!g || !g.fire) return;
      const slot = g.fire.open;
      const cfg = g.fire.cfg;
      if (slot < 0) return;
      const f = g.fire.list[slot];
      /* ★★★ 先把**反馈内容**算好 ✗✗（2026-09-24 用户：
       *   “我的意思是需要有东西显示我答错或者答对了”）
       *   病因：CombatScene **确实写了** `feedback`（“正确！/错了！” ✓）
       *     但紧接着皮肤的 `_fireWipeQ` **把它擦掉了** ✗
       *       （那句擦除是“答完消失得快点”时加的 ✓）
       *     → 结果**三个阶段都看不到对错** ✓
       *   修：在 `_fireWipeQ` **之后**写回去 ✓（见下面的调用处 ✓）且内容更具体 ✓
       *     · 答对 → `正确！` ＋ 正确项（三阶段再带上中文短语释义 ✓）
       *     · 答错 → `错了！正确答案：＜正确项＞` ✓（教学价值 ✓）
       *     · 超时 → `超时！正确答案：…` ✓ */
      const rightTxt = (f && f.senses && f.senses.length) ? f.senses[0] : '';
      const extra = (f && f.zhPhrase) ? f.zhPhrase : '';
      /* ★★★ 记账快照 ✗✗（2026-09-26 修"每局总结里奎隆的错题全是空的"）
       *   病因：本方法**末尾**会调 `_fireWipeQ` 把 `scene.wordText` 清空、
       *     而 `_fireOpen` 早就把 `scene._shown = []` 清过了 ✓
       *     → 随后 `_playerHit()` → `onWrong` → `RunState.logAnswer` 读到的
       *       `wordText.text` 与 `_shown[correctIndex]` **都是空串** ✓
       *     → 总结里就成了「(空) ｜ (空) ｜ (未拼出) ｜ 第3层·奎隆·四选一」✓
       *   ★ 修法：**在清题之前**把玩家真正看到的东西记到火对象上 ✓
       *     然后 `logAnswer` 优先读它 ✓（见 RunState.logAnswer 的 `_fireLog` 分支 ✓）
       *   ★ `f.word` 三阶段是**骨架**（`be subject ___`）✓ 一/二阶段是英文词 ✓ 都对 ✓ */
      if (f) {
        f.logWord = f.word;
        f.logZh = (g && g.prepHint && g.prepHint.text) ? String(g.prepHint.text) : '';
        f.logOptions = (f.senses || []).slice();     // ★ 副本 ✗ 免得被后续清掉 ✓
        f.logCorrect = f.senses ? f.senses[0] : '';
      }
      /* ★★ 答错/超时 → 前面加「正解」两字 ✗（案 1 的版式 ✓）
       *   ★ 答对**不加**（判词已经说明了 ✓ 再加就啰嗦 ✓）*/
      this._fbPending = {
        ok: !!ok,
        pre: ok ? '' : (isTimeout ? '超时 · 正解' : '正解'),
        ans: rightTxt,
        zh: extra
      };
      if (f) f.alive = false;
      /* ★ 结算记账：本场被治灭的火数（2026-09-26 ✓ 答对/答错**都会**灭火 ✓ 与 `fireBoom` 区分开 ✗）
       *   （只有"答完这一题导致它灭"才算 ✓ 自爆走 `_fireBoom` 另计 ✓）*/
      if (f && scene._runStats) scene._runStats.fireOut++;
      g.fire.open = -1;
      g.fire.asked = (g.fire.asked || 0) + 1;      // ★ 出过的题数（对错都算 ✓ 供"最紧急火"触发 ✓）
      if (ok) {
        g.fire.right++;
        /* ★ 随机给**另一朵**火 +5 秒（刚补位那朵本来就满 ✓ 候选里只取还活着的 ✓）
         *   上限 30s ✓ —— 上限若＝20s 则对满秒的火完全无效，奖励白给 ✗ */
        const others = (g.fire.list || []).filter(function (x) { return x && x.alive; });
        if (others.length) {
          const pick = others[Math.floor(Math.random() * others.length)];
          /* ★ +5 秒：基准是**绝对时间的 t0** ✗ → 把 t0 **往后挪** ✓ 不是改 left ✓
           *   （left 现在是由 `t0` 算出来的 ✓ 只改 left 会在下一帧被覆盖回去 ✓ 我差点又踩 ✓）*/
          const now2 = this._fireClock(scene);
          /* ★ 兜底：那朵火可能还**没被 tick 过**（	0 == null ✓）
           *   → 先给它定上现在 ✓ 否则 curLeft 是 NaN → 加时变成 NaN ✓ 且不报错 ✓ */
          if (pick.t0 == null) pick.t0 = now2;
          const curLeft = pick.total - (now2 - pick.t0);
          const newLeft = Math.min(cfg.capMs, curLeft + cfg.bonusMs);
          pick.t0 = now2 - (pick.total - newLeft);      // 反推 t0 → left 恰为 newLeft ✓
          pick.left = newLeft;
        }
      }
      this._fireSpawn(scene, slot);          // 答完立刻补位 → 场上恒 5 朵 ✓
      this._fireRefresh(scene);
      /* ★ 立刻清题面 ✗（用户："消失得快点，现在有点卡手"）
       *   放在 `_fireSpawn` 之后 ✓ —— 这样这一帧显示的就是"补位后的新火 + 空题面" ✓
       *   玩家随即回到"选题"状态，不用干等 `_delayedNext` 那 700ms ✓ */
      this._fireWipeQ(scene);
      /* ★★★ 清完之后**把反馈写回去** ✗✗（2026-09-24）
       *   顺序很重要 ✗：`_fireWipeQ` 里有 `feedback.setText('')` ✓
       *     它把 CombatScene 刚写的字擦掉了 ✓ → 我们的必须在**它之后**写 ✓ */
      if (this._fbPending) {
        try {
          this._fbPaint(scene, this._fbPending);
          /* ★ 让出 `scene.feedback` ✗（它在同一位置 ✓ 不让就重叠成两行 ✓）*/
          if (scene.feedback && scene.feedback.setText) scene.feedback.setText('');
        } catch (e) {}
      }
      this._fbPending = null;
      /* ★ 这里**不再**收阶段 ✗ —— 阶段由**血量**推进 ✓（用户 2026-09-24 明确："按照正常打血量"）
       *   血量跌破 `linkExtraFrom` 的那一刻，`_fireTick` 里的 `_fireEnd` 会把火全体撤走 ✓ */
    },

    /* ★★ 坛城转速的**唯一真源** ✗（2026-09-24 用户："二阶段背景的转速变快30%"）
     *   改转速只改这一个函数 ✓ 别处不要再去动 `bgSpin.tw` ✓
     *   ★ 用 `setTimeScale`（Phaser 原生 ✓）而不是改 `duration` ✗
     *     改 duration 会让 tween 重新计算进度 → **环会跳一下** ✗
     *     timeScale 是"播放倍率" ✓ 进度不动 ✓ 切换时视觉连续 ✓
     *   ★ 幂等：值没变就直接返回 ✓（`_fireTick` 每帧都调它 ✓）*/
    _bgSpinFor(phase) {
      /* 一阶段 1.00（原样 ✗ 不动）／二阶段起 **6.00**（一圈 72s → **12s** ✓）
       * ★ 倍率的来历（2026-09-24 用户两轮实测反馈）：
       *   ① 先做了 **1.30**（"变快30%"）→ 用户："转速并没变" ✗
       *      自测**量角度**证明 1.30 生效（4.97 → 6.44 度/秒 ✓）→ 结论"幅度不够"✓
       *   ② 调到 **3.00**（一圈 24s）→ 用户："确实变快了，但是不明显" ✗ → 再调到 **6.00** ✓
       *   ★ 口径：**"有变化但不明显"就是幅度还不够** ✗
       *     这类"缓慢循环动效"的体感阈值比想象的高得多 ✓
       *     （72→24 秒是 3 倍差距 ✓ 但两者都还是"慢"✓ 落在同一个体感档位 ✓；
       *       要到 12 秒才跨到"明显在转"那一档 ✓）
       *   ★ 但仍然必须**先量出"生效了"再调幅度** ✗ 别把真 bug 当成幅度不够 ✓ */
      /* ★★★ 三阶段**再快一倍** ✗✗（2026-09-24 用户："三阶段背后的背景轮子转速再加快
       *   （要肉眼能感觉到的转速再加快一倍）"）
       *   一阶段 1.00（一圈 72s ✓ 原样不动 ✗）
       *   二阶段 6.00（一圈 12s ✓ 不动 ✗）
       *   三阶段 **12.00**（一圈 **6s** ✓ ＝ 二阶段的两倍 ✓）
       *   ★ 参照这个倍率的历史：1.30 →("并没变") 3.00 →("不明显") 6.00 →("确实变快了")
       *     6.00 才刚跨进"明显在转"那一档 ✓ 所以"再快一倍"取 12.00 ✓ 不保守 ✗ */
      if (phase >= 3) return 12.00;
      return (phase >= 2) ? 6.00 : 1.00;
    },
    _bgSpinApply(scene) {
      const g = scene._kq;
      if (!g || !g.bgSpin || !g.bgSpin.tw) return;
      const want = this._bgSpinFor(this._phaseOf(scene));
      if (g.bgSpinScale === want) return;                 // ★ 幂等 ✓
      g.bgSpinScale = want;
      const tw = g.bgSpin.tw;
      try {
        if (tw.setTimeScale) tw.setTimeScale(want);       // ★ Phaser 原生调速 ✓ 进度不变 ✓
        else if (tw.timeScale != null) tw.timeScale = want;   // 兜底（老版本直接赋字段 ✓）
      } catch (e) { /* 调速失败不影响其余表现 ✓ 不抛 ✓ */ }
    },

    /* 火退场检测（每帧由 `_fireTick` 调 ✓）
     *   ★ 唯一的火退场路径 ＝ **血量跌破三阶段阈值** ✓ 不靠任何计数 ✗
     *   ★★ 由"跌破二阶段"改成"跌破**三阶段**" ✗✗（2026-09-24）
     *     因为用户把二阶段定义为「**火里的内容变双向**」✓ 火必须留着 ✓
     *     只有进三阶段（无忧觉）才把火全部收走 ✓ 那一阶段另做机制 ✓
     *   ★ 副作用：答完题会给敌人掉血（`_onAnswer` 的正常流程 ✓）→ 血量会自己往下走 ✓
     *     所以二阶段不会卡住 ✓ 会自然滑向三阶段 ✓ 正是想要的节奏 ✓ */
    _fireEnd(scene) {
      const g = scene._kq;
      if (!g || !g.fire) return;
      /* ★★ 阶段变换 → **整场火刷新一次** ✗✗（2026-09-24 用户："二阶段直接所有火刷新一次，
       *   否则一开始还是英文居多"）
       *   ★ 病因：进二阶段时，场上那 5 朵火**还挂着旧题** ✓
       *     而那些旧题是**一阶段抽的**（恒为英→中 ✓）→ 进二阶段的头十几秒
       *     屏幕上仍然全是英文题面 ✓ 观感就是"双向"根本没生效 ✓
       *   → 修：每进入一个新阶段（2 / 3）→ 把 5 朵火**全部重新抽题 ＋ 倒计时重置** ✓
       *   ★ 用 `g.fire.refreshedPhase` 记住"已经为哪个阶段刷过" ✗
       *     否则每帧都会重刷 → 题永远换不完 ✓（这种自触发循环一定要有幂等标记 ✓）*/
      const ph = this._phaseOf(scene);
      if (ph >= 2 && g.fire.refreshedPhase !== ph) {
        g.fire.refreshedPhase = ph;
        this._fireRefreshAll(scene);
      }
        /* ★★★ 三阶段**不再清火** ✗✗（2026-09-24 介词版）
         *   原来这里是 `if (ph < 3) return; this._fireClear(scene);` ✓
         *     —— 那是**旧设计**（三阶段换成反义词拖拽、把火全清掉 ✓）留下的 ✗
         *   新设计：三阶段**继续用火** ✓（火上写关键词 ✓ 点开考介词 ✓）
         *     → 敢删掉它 ✓ 否则一进三阶段火就全没了 ✓
         *   ★ 上面 `ph >= 2` 的刷新条件**正好覆盖三阶段** ✓
         *     → 进三阶段时 5 朵火会自动换成**介词题** ✓（不用另写 ✓）*/
    },

    /* ★ 整场刷新：5 朵火全部重新抽题 ＋ 倒计时重置为满 ✓
     *   · 复用 `_fireSpawn`（它会重建显示对象、重置 `t0`、清空 `shuffled` ✓）
     *   · 题目的**方向**由 `_firePickWord` 按当前阶段重新掷 ✓ → 二阶段自然变成双向 ✓
     *   ★ 不闪"空场"✗ —— `_fireSpawn` 是就地重建（先 destroy 旧的再建新的 ✓ 同一帧完成 ✓）*/
    _fireRefreshAll(scene) {
      const g = scene._kq;
      if (!g || !g.fire || g.fire.done) return;
      const n = (g.fire.cfg && g.fire.cfg.count) || 5;
      /* ★★★ **正在答题的那朵也要换** ✗✗（2026-09-24 介词版）
       *   原来是 `if (g.fire.open === i) continue;` ✓
       *     理由是“别把玩家答到一半的题换掉” ✓（那条本身对 ✓）
       *   但**阶段变了**就是另一回事 ✓：进三阶段时那道题**必须换成介词题** ✗
       *     否则玩家继续答一道**旧阶段的题** ✓ 而火上的关键词已经是新的 ✓ 自相矛盾 ✓
       *   修：刷新时把它**也重生** ✓ 并把它**关掉**（回选题态 ✓）
       *     —— 玩家点开下一朵就行 ✓ 不会卡住 ✓*/
      const wasOpen = g.fire.open;
      for (let i = 0; i < n; i++) {
        const f = g.fire.list[i];
        if (!f) continue;
        this._fireSpawn(scene, i);
      }
      if (wasOpen >= 0) {
        /* 把刚才那朵收回原位 ✓ 并清掉“正在答”状态 ✓ */
        try { this._fireCorner(scene, wasOpen, false); } catch (e) {}
        g.fire.open = -1;
        this._fireBar(scene, null);
        if (scene.wordText) scene.wordText.setText('');
        (scene.optionButtons || []).forEach(function (b) { if (b && b.setVisible) b.setVisible(false); });
      }
      /* ★★ 刷新后把**交替的起点**对齐到"最后一朵" ✗（2026-09-24）
       *   这样**下一朵新生成的火**正好跟最后一朵相反 ✓
       *   否则刷出来的 5 朵是"从上次的落点接着交替" ✓ 有可能前两朵同向 ✓ 读起来乱 ✓
       *   （找不到就不动 `lastDir` ✓ 下一次照旧交替 ✓ 不留坏状态 ✓）*/
      const alive = (g.fire.list || []).filter(function (x) { return x && x.alive; });
      if (alive.length && alive[alive.length - 1].dir) {
        g.fire.lastDir = alive[alive.length - 1].dir;
      }
      this._fireRefresh(scene);
    },

    /* ★ 立即清题面（2026-09-24 用户："一题答完（答对/答错）后上面的英文和下面的选项消失得快点，
     *   现在有点卡手"）
     *   · 病因：`CombatScene._delayedNext()` 是**全局 700ms** ✓ 那 700ms 里被答的词与四个选项
     *     **还留在屏幕上** ✗ 而火阶段答完就该**立刻回到"选题"状态** ✓
     *   · 全局那 700ms **不能动** ✗（其它六个战斗都在用它 ✓）→ 在本阶段单独**提前清题面** ✓
     *   · 清完立刻调一次 `onWord` ✓ 让"空题态"马上生效（藏卡/藏选项 ✓ 让 `idle` 为真 ✓）*/
    _fireWipeQ(scene) {
      const s = this._s(scene);
      if (scene.wordText) {
        scene.wordText.setText('');
        if (scene.wordText.setColor) scene.wordText.setColor(K.paleS);
      }
      (scene.optionButtons || []).forEach(function (b) {
        if (!b) return;
        if (b.setVisible) b.setVisible(false);
        if (b.list) {
          if (b.list[1] && b.list[1].setText) b.list[1].setText('');
          const rr = b.list[0];
          if (rr && rr.disableInteractive && rr.input && rr.input.enabled) rr.disableInteractive();
        }
      });
      if (scene._shown) scene._shown = [];
      if (scene.feedback && scene.feedback.setText) scene.feedback.setText('');
    },

    /* 刷新：弧 + 秒数 + 计数 */
    _fireRefresh(scene) {
      const g = scene._kq; if (!g || !g.fire) return;
      const cfg = g.fire.cfg;
      const s = this._s(scene);
      (g.fire.list || []).forEach(function (f) {
        if (!f || !f.alive || !f.arc) return;
        const p = Math.max(0, Math.min(1, f.left / f.total));
        /* ★ 是不是"最紧急"那一朵 ✓（由 `_fireHotApply` 每帧算好 ✓ 这里只负责上色 ✓）
         *   C 案：**变亮（亮朱红）+ 加粗（8→10px）** ✓ 轮廓不变 ✓ 最克制 ✓ */
        const isHot = (f.slot === g.fire.hotIdx);
        f.arc.clear();
        /* ★★ 颜色**逐字照抄预览的 C 案** ✗ 不许自己另调 ✓（用户 2026-09-24："百分百还原"）
         *   预览 CSS：`.fire.C.hot .arc{ background:conic-gradient(from -90deg, #FF6A48 ...) }`
         *   → 热 = `0xFF6A48` ✓（我原来写成 `0xE86B4F` ✗ 那是预览的悬停色，不是这个 ✓）
         *   ★ 加强项（用户："还是不明显"）→ 热态弧宽 **10 → 12px** ✓ */
        f.arc.lineStyle(Math.max(4, Math.round((isHot ? 12 : 8) * s)),
                        isHot ? 0xff6a48 : K.vermN, 1);
        f.arc.beginPath();
        const sweep = Math.PI * 2 * p - 0.017;
        f.arc.arc(0, 0, f.r, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, sweep), false);
        f.arc.strokePath();
        /* ★ 外扩光环：**画成两道同心弧**（radius 不同 ✓ 用图形自身 alpha ✓）
         *   内道 = 亮橙（贴着实弧外沿）✓ 外道 = 更淡更远 ✓
         *   ★ 用同一个 `arc` Graphics 的 `arc()` ✗ 不用独立对象 ✓（独立对象渲染不出来 ✓ 试过）
         *   ★ alpha 走 `strokePath` 前设的 `lineStyle(..., alpha)` ✓ 稳定 ✓ */
        if (isHot) {
          f.arc.lineStyle(Math.max(2, Math.round(3 * s)), 0xff6a48, 0.55);
          f.arc.beginPath();
          f.arc.arc(0, 0, f.r + 7 * s, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, sweep), false);
          f.arc.strokePath();
          f.arc.lineStyle(Math.max(2, Math.round(2 * s)), 0xff6a48, 0.26);
          f.arc.beginPath();
          f.arc.arc(0, 0, f.r + 13 * s, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, sweep), false);
          f.arc.strokePath();
        }
        /* 中心盘描边：最紧急的转成**阶段橙** ✓（预览：`.hole{border-color:rgba(255,79,8,.85)}` ✓ 一致）*/
        if (f.hole && f.hole.setStrokeStyle) f.hole.setStrokeStyle(1, isHot ? K.stageN : K.bronzeN, isHot ? 0.85 : 0.55);
        /* ★★ 底环换色 ✗ 这一步我原来**漏了** ✓（用户："和网页 html 的效果一点都不一样"）
         *   预览 CSS：`.fire.C.hot .ringbg{ border-color:#5a1f14 }` ＝ **暗红棕** ✓
         *   → 热的那朵显示 `ringHot`（暗红棕）✓ 其余显示 `ringBase`（近黑）✓
         *   ★ 两个 Graphics 常驻 ✓ 只切 `visible` ✗ 不每帧重画底环（省 ✓ 且无闪烁 ✓）*/
        if (f.ringBase && f.ringBase.setVisible) f.ringBase.setVisible(!isHot);
        if (f.ringHot && f.ringHot.setVisible) f.ringHot.setVisible(!!isHot);
        f.tTxt.setText(Math.ceil(f.left / 1000) + 's');
        /* ★ 秒数：**最紧急那朵常驻橙** ✓（加强项 ✓ 原来看不出"这朵不一样"）
         *   其余：被 +5 过的（> 基准 20 秒）才标橙 ✓ */
        f.tTxt.setColor((isHot || f.left > f.total + 50) ? K.stageS : K.silverS);
        /* ★ 词色：最紧急那朵**提亮** ✓（加强项 ✓ 预览 C 案 `.fire.C.hot .w{color:#FFD9C8}`）*/
        if (f.wTxt && f.wTxt.setColor) f.wTxt.setColor(isHot ? '#FFD9C8' : K.bronzeHiS);
      });
      /* ★ 题卡横条：与圆环**读同一个 `f.left`** ✓ 完全同步 ✓（点开的那一朵 ✓）*/
      const openF = (g.fire.open >= 0) ? g.fire.list[g.fire.open] : null;
      this._fireBar(scene, (openF && openF.alive) ? openF : null);
      /* ★ 「已答对 N 次」计数**已删** ✗（用户 2026-09-24："这个删掉" ✓ 它与血量数字重叠 ✓）*/
    },

    /* 一阶段收尾：把火与计数全销毁 ✓（否则会跟着进二阶段 ✓） */
    _fireClear(scene) {
      const g = scene._kq; if (!g) return;
      /* ★★ 火与三阶段**各自独立判断** ✗✗（2026-09-24 自测抓出来的）
       *   病因：原来第一行是 `if (!g || !g.fire) return;` ✗
       *     而**三阶段时 `g.fire` 已经是 null** ✓（`_fireEnd` 已把它清掉 ✓）
       *     → 三阶段的每帧回调**永远 off 不掉** ✓ 对象也销毁不掉 ✓
       *       → 场景复用后残留 ✓ 而且 `clear()` 静默什么都没做 ✓ 最难查 ✓
       *   ★ 口径：**一个"清理函数"里混了多个子系统时，每个子系统要各自判存在** ✗
       *     共用一个 `return` 会让"其中一个不存在"把全部清理都吞掉 ✓ */
      if (g.fire) {
        try { if (g.fire.onTick) scene.events.off('update', g.fire.onTick); } catch (e) {}
        (g.fire.list || []).forEach(function (f) {
          try { if (f && f.box && f.box.destroy) f.box.destroy(); } catch (e) {}
        });
        (g.fire.objs || []).forEach(function (o) { try { if (o && o.destroy && o !== g.fire.counter) o.destroy(); } catch (e) {} });
        try { if (g.fire.counter && g.fire.counter.destroy) g.fire.counter.destroy(); } catch (e) {}
        g.fire.list = []; g.fire.objs = []; g.fire.counter = null; g.fire.done = true;
      /* ★ 三阶段的中文提示也要清掉 ✗（防残留 ✓）*/
      if (g.prepHint) { try { g.prepHint.setText(''); g.prepHint.setVisible(false); } catch (e) {} }
      }
    },

    _fireFlash(scene, ok) {
      const g = scene._kq; if (!g) return;
      try {
        if (ok && g.flashOk) { g.flashOk.setAlpha(0.14); g.tweens.push(scene.tweens.add({ targets: g.flashOk, alpha: 0, duration: 260 })); }
        if (!ok && g.flashBad) { g.flashBad.setAlpha(0.26); g.tweens.push(scene.tweens.add({ targets: g.flashBad, alpha: 0, duration: 420 })); }
      } catch (e) {}
    },

    /* 一阶段出题：CombatScene 的 `_newWord` 会**先**走到这里 ✓
     *   返回 true ＝ 皮肤已接手（把词与四个选项都换好了）→ 它直接 return ✓ */
    fireNewWord(scene, cardTop, s, fs) {
      const g = scene._kq;
      if (!this._isFireStage(scene) || !g.fire || g.fire.open < 0) return false;
      const f = g.fire.list[g.fire.open];
      if (!f || !f.alive) return false;

      /* ★★ 流程开始时**先藏**、填完再显 ✗（2026-09-24 用户："点进来以后答案会突然改一下"）
       *   上次我只在 `_fireOpen` 里藏了一次 ✗ 不够 ——
       *   只要这条流程中间有任何一步让按钮可见 ✓ 旧文字就会被看到一帧 ✓
       *   → 现在**在流程内部再藏一次** ✓ 与 `_fireOpen` 那次形成双保险 ✓
       *   ★ 整段用 `try` 包住 ✓ 出错时**兜底走 CombatScene 的普通出题**（返回 false ✓）
       *     而不是留下"看不见的选项" ✓ 那种更难查 ✓ */
      try {
        (scene.optionButtons || []).forEach(function (b) {
          if (!b) return;
          if (b.list && b.list[1] && b.list[1].setText) b.list[1].setText('');
          if (b.setVisible) b.setVisible(false);
        });

        /* ★★★ 选项顺序**每题只洗一次** ✗✗（2026-09-24 用户："随机数量选项会变"）
         *   病因：`fireNewWord` 每次调用都重新 `_fireShuffle` ✓
         *     而**同一道题会被出两次**：
         *       ① `_fireOpen` → `_newWord` → 皮肤出题 ✓
         *       ② 答完后 `_delayedNext` 的 **700ms 回调** → `_newWord` → 又出一次 ✓
         *     → 第二次**重新洗牌** → 四个选项被重排 ✓
         *       正确项从第 5 位跳到第 4 位 ✓ 观感就是"答案变了一下" ✓
         *   → 修：`f.shuffled` **已存在就复用** ✓ 只在 `_fireSpawn` 里清空（每题一次 ✓）
         *   ★ 口径：**"纯显示用的随机"必须只做一次并记住** ✗
         *     重入的渲染路径（重绘/重建/回调）不能再掷一次骰子 ✓ */
        const cols = (f.shuffled && f.shuffled.length === f.senses.length)
          ? f.shuffled
          : this._fireShuffle(f.senses.slice());
        f.shuffled = cols;
        /* ★ 正确项 ＝ `senses[0]`（`_firePickWord` 保证了"正确项排在最前" ✓）
         *   所以下标是 `indexOf` 的结果 ✗ **不是写死的 0** ✓
         *   （原来写 `correctIndex: 0` 只在本地库时代成立 ✓ 走全局库后必须算 ✓）*/
        f.correctIndex = cols.indexOf(f.senses[0]);
        if (f.correctIndex < 0) f.correctIndex = 0;      // 兜底（理论上不会发生 ✓）
        scene.currentWord = { en: f.word, zh: f.senses[0] };
        scene.correctIndex = f.correctIndex;
        scene._shown = cols;
        scene._curWord = { en: f.word, zh: f.senses[0] };
        if (scene.wordText) {
          scene.wordText.setText(f.word).setVisible(true);
          /* ★★ 两级字号（2026-09-24 用户："二阶段火随机中文考英文，或者英文考中文"）
           *   · 题面是**英文** → 56px（拉丁字面窄 ✓ 原样 ✓）
           *   · 题面是**中文** → **46px** ✗ 中文笔画密 ✓ 56px 会糊成一团 ✓
           *   ★ 判据看 `f.dir` ✗ 不要去猜字串里有没有汉字（不稳 ✓）*/
          /* ★ 三阶段题面是**骨架**（`be subject ___` ✓ 最长 20 字符 ✓）
           *   → 字号降到 **40** ✓（680px 卡片宽 ✓ 40px 下 20 字符约 480px ✓ 放得下 ✓）
           *   ★ 一/二阶段一行不变 ✓ */
          const bigFs = (f.dir === 'prep') ? 40 : (f.dir === 'zh2en' ? 46 : 56);
          scene.wordText.setFontSize(fs(bigFs));
          /* ★★ 三阶段：骨架下面显示**中文短语释义** ✗（2026-09-24 用户要求）
           *   ★ 只在 `dir === 'prep'` 时填字并显形 ✓ 其余方向**清空并藏起来** ✓
           *     （一/二阶段与其它战斗零影响 ✓）*/
          if (g.prepHint) {
            if (f.dir === 'prep' && f.zhPhrase) {
              g.prepHint.setText(f.zhPhrase).setVisible(true);
            } else {
            }
          }
          /* ★ 词要**居中到圆环中间（莲的位置）** ✓（用户 2026-09-24："词居中到圆环中间（莲的位置）"）
           *   环心/莲心在 `y = 232` ✓（见 build 里的 `CARD_RING.y`）
           *   原来放在 `cardTop + 45`（＝190）✗ 那是当初为了**躲开已删掉的那排义链胶囊** ✓
           *   胶囊早已移除 ✓ 所以现在可以正落到环心 ✓ */
          scene.wordText.setY(232 * s);
          scene.wordText.setColor(K.paleS);
        }
        for (let i = 0; i < 4; i++) {
          const btn = scene.optionButtons[i]; if (!btn) continue;
          const rr = btn.list[0];
          const label = btn.list[1];
          label.setText(cols[i] || '');
          /* ★ 选项字号跟方向走（2026-09-24）✗
           *   · 中文选项（en2zh）→ 22px ✓ 原样 ✓（中文词组短 ✓ 最长的也就 8 个字 ✓）
           *   · 英文选项（zh2en）→ **19px** ✗ 拉丁字母宽 ✓ 大词库里有 'sexual harassment'
           *     这类 18 字符的长条目 ✓ 22px 会溢出 320px 的按钮 ✓
           *   ★ 只在**中→英**方向降字号 ✓ 英→中一行不变 ✓ 一阶段零影响 ✓ */
          /* ★ 三阶段选项是**介词**（极短 ✓ 如 `to`/`with` ✓）→ 字号给到 **26** ✓ 读起来像一道题 ✓ */
          const optFs = (f.dir === 'prep') ? 26 : (f.dir === 'zh2en' ? 19 : 22);
          if (label.setFontSize) label.setFontSize(fs(optFs));
          if (rr && rr.input) rr.input.enabled = true;
        }
        if (scene._answerHint) {
          scene._answerHint.setColor(K.bronzeS);
          /* ★ 三阶段提示语换成“选择正确的介词” ✗（原文案是“选择正确的中文释义” ✓不对了 ✓）
           *   ★ 只在三阶段改 ✓ 一/二阶段与其它战斗一字不变 ✓ */
          if (f.dir === 'prep' && scene._answerHint.setText) scene._answerHint.setText('选择正确的介词');
        }
        /* ★★★ 必须把 `answering` 置回 true ✗✗（用户 2026-09-24 报"第二题点选项不判对错" ✓）
         *   病因：这一行在我早前重写文件时**被弄丢了** ✓（`_fireResolve` 收尾时把它置成 false ✓）
         *   `_onAnswer` 第一行就是 `if (!this.answering) return;`
         *   → 题目显示正常、按钮也可见可交互（`btn0=VE` ✓）
         *     但**点选项全被第一行挡掉** ✓ 表现就是"点了没反应" ✓
         *   ★ 口径：**任何自己实现出题的皮肤，都必须走完 CombatScene 出题路的这三件事**：
         *       ① `scene.answering = true` ② `scene._shown` ③ `scene.correctIndex` ✓ 缺一不可 ✓ */
        scene.answering = true;
        /* ★ 填完**最后**才显 ✗（全程不可见 → 不存在"闪一下旧答案" ✓）*/
        for (let i = 0; i < 4; i++) {
          const bb = scene.optionButtons[i];
          if (bb && bb.setVisible) bb.setVisible(true).setAlpha(1);
        }
        return true;
      } catch (e) {
        /* 出题失败：把按钮放回来（别留"看不见的选项" ✓）＋ 交回 CombatScene ✓ */
        try {
          (scene.optionButtons || []).forEach(function (b) { if (b && b.setVisible) b.setVisible(true); });
        } catch (e2) {}
        return false;
      }
    },

    _fireShuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },

    /* ======================================================================
     * ① 进场
     * ==================================================================== */
    build(scene, opts) {
      const s = this._s(scene);
      const W = scene.scale.width, H = scene.scale.height;
      const cx = W / 2, cy = H / 2;
      scene._kq = { objs: [], tweens: [], timers: [], phase: 0 };   // phase 必须是 0（不是 undefined ✓ 否则首题会误弹转阶段横幅 ✗）
      const g = scene._kq;
      const keep = (o) => { g.objs.push(o); return o; };

      /* ---- 背景：真素材 PNG（1560×960 ✓ cover 铺满 ✓ 不留边）----
       *   ★ depth -14：必须**高于 E3 自己的背景层**（它在 -10/-9 ✗ 否则会被洗白 ✓ 见 nightcity 的教训） */
      if (scene.textures.exists('skin-quilon-bg')) {
        const bg = scene.add.image(cx, cy, 'skin-quilon-bg').setDepth(-14);
        bg.setScale(Math.max(W / bg.width, H / bg.height));      // cover ✓
        keep(bg);
      } else {
        keep(scene.add.rectangle(0, 0, W, H, K.deepBlue2).setOrigin(0, 0).setDepth(-14));
      }
      /* 藏掉 E3 的亮色氛围贴图（vignette/grain）：深底皮肤上它们会"发灰"✗ */
      try {
        (scene.children && scene.children.list ? scene.children.list : []).forEach(function (o) {
          const k = o && o.texture && o.texture.key;
          if ((k === 'vignette' || k === 'grain') && o.setVisible) o.setVisible(false);
        });
      } catch (e) { /* 找不到就算了 ✓ 不影响本体 */ }

      /* ---- 坛城慢转环（＝rotation tween ✓ 简报：仪式化的缓慢动效 ✓）
       *   ★ 2026-09-24 挪位（用户："这块在转的东西是否也可以移到中间" ✓）：
       *     原来对齐背景里那枚宝轮 (1118,288) r=436 ✗ —— 但**游戏视角是 cover 裁过的** ✗
       *     → 那圈只有左下一小段弧露在画面里，看着像"屏幕一角有个东西在转"，没有归属 ✗✓
       *     现在把它放到**词卡正中** (cx, 235)，半径 214（卡宽 680 / 2 = 340 ✓ 环在卡内 ✓）
       *     → 环心正好是那朵莲花（莲花烘在背景里 ✓ 见 §44.14）✓ 这就是"坛城"：环 + 心 ✓ */
      const CARD_RING = { x: cx, y: 232 * s, r: 186 * s };
      /* ★ 三阶段专用：骨架下方的**中文短语释义** ✗（2026-09-24 用户：“词组下面要有中文显示”）
       *   ★ 只在三阶段显示 ✓ 其余场景它一直是**空的且不可见** ✓（零影响 ✓）*/
      /* ★★★ 萨卡兹风味作答反馈・案 1「碑铭」✗✗（2026-09-24 用户选定）
       *   版式：`◆ 判词无误 ◆ ／ to  受……影响；取决于`
       *   ★ 三段不同颜色 → **必须三个文本对象** ✗（单个 `scene.feedback` 只能一个颜色 ✓）
       *   ★ 放在 `cy + 340*s` 那一带 ✓（＝`scene.feedback` 的位置 ✓ 页脚线之下 ✓）
       *   ★ 三个阶段**共用** ✗（都走 `_fireResolve` ✓）*/
      const fbY = cy + 340 * s;
      g.fbTag = Babel.UI.text(scene, cx - 300 * s, fbY, '', {
        font: Babel.FONTS.display, size: Math.round(26 * s) + 'px', color: K.bronzeHiS, origin: [0, 0.5]
      }).setDepth(24).setVisible(false);
      g.fbAns = Babel.UI.text(scene, cx - 300 * s, fbY, '', {
        font: Babel.FONTS.num, size: Math.round(24 * s) + 'px', color: K.paleS, origin: [0, 0.5]
      }).setDepth(24).setVisible(false);
      g.fbZh = Babel.UI.text(scene, cx - 300 * s, fbY, '', {
        font: Babel.FONTS.body, size: Math.round(20 * s) + 'px', color: K.bronzeS, origin: [0, 0.5]
      }).setDepth(24).setVisible(false);

      g.prepHint = Babel.UI.text(scene, cx, 232 * s + 72 * s, '', {
        font: Babel.FONTS.body, size: Math.round(20 * s) + 'px', color: K.bronzeHiS, origin: [0.5, 0.5]
      }).setDepth(22).setVisible(false);
      const ring = scene.add.graphics();
      ring.lineStyle(Math.max(1, Math.round(1.6 * s)), K.bronzeHiN, 0.34);
      ring.strokeCircle(0, 0, CARD_RING.r);
      ring.lineStyle(Math.max(1, Math.round(1 * s)), K.bronzeN, 0.22);
      ring.strokeCircle(0, 0, CARD_RING.r * 0.90);
      for (let i = 0; i < 32; i++) {                            // 32 道短刻痕（坛城齿 ✓ 转起来才看得出 ✓）
        const a = (i / 32) * Math.PI * 2;
        const r0 = CARD_RING.r * 0.90, r1 = CARD_RING.r;
        ring.lineBetween(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
      }
      for (let i = 0; i < 8; i++) {                             // 8 道长辐（慢转时给出"轮"的读感 ✓）
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const r0 = CARD_RING.r * 0.34, r1 = CARD_RING.r * 0.86;
        ring.lineBetween(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
      }
      const holder = scene.add.container(CARD_RING.x, CARD_RING.y, [ring]).setDepth(-9);   // ★ 在词条之下（词卡是 depth 0 ✓）
      /* ★ 环心那朵莲花（D 案「莲花座」✓ 用户选定 ✓）——
       *   2026-09-24 从**背景**挪到**皮肤**里（用户："这个莲花在中间" ✓）：
       *     挪进 holder 之后它会**跟着环一起转** ✓ 才是"坛城：环 + 心" ✓
       *     （留在背景里的话它是死的 ✗ 环转眼不动，两个圆心也对不齐 ✗） */
      if (scene.textures.exists('skin-quilon-lotus')) {
        const lm = scene.add.image(0, 0, 'skin-quilon-lotus');
        lm.setDisplaySize(186 * s, 186 * s).setAlpha(0.42);
        holder.add(lm);
      } else {
        const lm = scene.add.graphics();                        // 兜底：贴图没载入也不崩 ✓
        lm.lineStyle(Math.max(1, Math.round(1.2 * s)), K.bronzeHiN, 0.34);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          lm.lineBetween(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s, Math.cos(a) * 58 * s, Math.sin(a) * 58 * s);
        }
        holder.add(lm);
      }
      keep(holder);
      /* ★★ 坛城转速：**按阶段变** ✗✗（2026-09-24 用户："二阶段背景的转速变快30%（一定要和一阶段隔离开）"）
       *   · 一阶段：`timeScale = 1.00`（72 秒一圈 ✓ 原样 ✓ **绝对不动** ✓）
       *   · 二阶段：`timeScale = 1.30`（≈55.4 秒一圈 ✓ 快 30% ✓）
       *   · 三阶段：**12.00**（一圈 6s ✓ 2026-09-24 用户要求“再加快一倍” ✓）
       *   ★★ **隔离**怎么做（用户重点强调）：
       *     ① 全部在**奎隆皮肤文件**里 ✓ 其它皮肤/敌人**一个字节都不碰** ✓
       *     ② 调速用 `setTimeScale`（**Phaser Tween 原生** ✓ 不改 duration ✓ 不重建 tween ✓）
       *        → `progress` 保持不变 ✓ **切阶段时环不会跳一下** ✓
       *     ③ 只在这个 tween 对象上调 ✓ `g.bgSpin` 是本皮肤私有的引用 ✓
       *     ④ 只有 `enemyDef.fireStage` 的敌人会走到这里 ✓（＝只有奎隆 ✓）
       *   ★ 幂等：`g.bgSpinScale` 记住上次设过的值 ✓ 相同就不重复调 ✓
       *     （`_fireTick` 每帧都会调这个函数 ✓ 没幂等会每帧 set 一次 ✓ 虽无害但脏 ✓）*/
      g.bgSpin = { holder: holder, tw: scene.tweens.add({
        targets: holder, rotation: Math.PI * 2, duration: 72000, repeat: -1
      }), baseDur: 72000 };
      g.tweens.push(g.bgSpin.tw);
      g.bgSpinScale = 1;
      this._bgSpinApply(scene);

      /* ---- 地砖微光：三枚"坛城格"的呼吸（缓慢 ✓ 对称 ✓ 不抢戏 ✓）---- */
      const glowG = scene.add.graphics().setDepth(-12);
      const tiles = [[300, 660], [780, 700], [1250, 660]];
      tiles.forEach(function (t, i) {
        const gg = scene.add.graphics().setDepth(-12);
        gg.fillStyle(K.bronzeN, 0.10);
        gg.fillCircle(t[0], t[1], 90 * s);
        const tw = scene.tweens.add({
          targets: gg, alpha: { from: 0.25, to: 0.85 }, duration: 2600 + i * 420,
          yoyo: true, repeat: -1, delay: i * 600
        });
        g.tweens.push(tw);
        g.objs.push(gg);
      });
      keep(glowG);

      /* ---- 页眉：**先藏掉 E3 的白底与墨线**（否则白条压在新皮肤上 ✗ 踩过），
       *   再"只重上色"地复用 E3 的文字对象（不动它们的文案与刷新逻辑 ✓）---- */
      const hud = scene._hud || {};
      if (hud.bg && hud.bg.setVisible) hud.bg.setVisible(false);
      if (hud.rule && hud.rule.setVisible) hud.rule.setVisible(false);
      if (hud.pill) hud.pill.setFillStyle(K.uiRedN, 0.92).setStrokeStyle(0);
      if (hud.pillText) hud.pillText.setColor('#F4F4F8');
      if (hud.stageText) hud.stageText.setColor(K.silverS);
      if (hud.curText) hud.curText.setColor(K.numWarmS);         // 残页 → 亮金（信息数字，要高对比 ✓）
      if (scene._hudHP) scene._hudHP.setColor(K.numS);           // 目标生命 → 近白（信息数字 ✓）
      /* ★ 血量数字加粗（2026-09-24 用户："血量颜色看不起" ✓）—— 数字小 + 暗色 = 双重难读 ✓
       *   数值行本来就是等宽字体 ✓ 加粗后轮廓清楚 ✓ 不换字号（保持与 E3 同一排版 ✓） */
      try {
        if (scene._hudHP && scene._hudHP.setFontStyle) scene._hudHP.setFontStyle('bold');
        [scene.enemyHPText, scene.playerHPText].forEach(function (t) {
          if (t && t.setFontStyle) t.setFontStyle('bold');
        });
        /* ★ 加粗之后**再刷一次颜色** ✓ —— Phaser 的 setFontStyle 会重建 style 对象，
         *   先设色再加粗有被重置的风险（宁可多刷一次 ✓ 成本为零 ✓） */
        if (scene._hudHP && scene._hudHP.setColor) scene._hudHP.setColor(K.numS);
        [scene.enemyHPText, scene.playerHPText].forEach(function (t) {
          if (t && t.setColor) t.setColor(K.numS);
        });
      } catch (e) { /* 不支持就算了 ✓ 不影响本体 */ }
      /* 页眉那条横线：画一条冷银细线（E3 的已藏 ✓） */
      keep(scene.add.rectangle(0, 52 * s, W, Math.max(1, Math.round(1 * s)), K.silverN, 0.26)
        .setOrigin(0, 0).setDepth(3));

      /* ---- 词卡细线 → 褪色古铜金（E3 的灰线在冷灰底上几乎看不见 ✗）---- */
      if (scene._cardRule && scene._cardRule.setFillStyle) scene._cardRule.setFillStyle(K.bronzeN, 0.85);
      if (scene._cardBotRule && scene._cardBotRule.setFillStyle) scene._cardBotRule.setFillStyle(K.bronzeN, 0.85);
      if (scene.wordText) scene.wordText.setColor(K.paleS);
      if (scene._answerHint) scene._answerHint.setColor(K.bronzeS);

      /* ---- 选项底线 → 古铜金（每题由 resetOptions 再刷一次 ✓）---- */
      (scene.optionButtons || []).forEach(function (b) {
        if (b && b._rule && b._rule.setFillStyle) b._rule.setFillStyle(K.bronzeN, 0.5);
        const label = b && b.list && b.list[1];
        if (label && label.setColor) label.setColor(K.paleS);
        const key = b && b.list && b.list[2];
        if (key && key.setColor) key.setColor(K.bronzeHiS);
      });

      /* ---- 倒计时：条挪到词卡上方 + **条身静态渐变**（2026-09-24 用户定稿 A 案「苔与金」✓）
       *   口径（用户明确两点 ✗✓）：
       *     ① 渐变是**条身从左到右**的 ✓ —— **开局就是这样** ✓ **不随时间变** ✗
       *     ② 色要**萨卡兹风** ✓ —— 全部从**官方关卡地图实测**取（见 skill §44.18）：
       *        苔绿/橄榄 #40463E（占 43.6%）/ 石材 #303030（30%）/ 褪色古铜金 #9C846C ✓
       *   ★ 实现要点（关键 ✗ 别写错）：渐变必须**铺满整条**再被裁 ✗
       *     不能直接画在 bar 的 fill 上 —— 那个 fill 是靠 `scaleX` 收缩的 ✗
       *     → 收缩会把渐变一起压扁 ✗✓（"条身渐变"就变成了"随时间变淡的色块" ✗）
       *     正解：渐变画成**满宽的独立 Graphics** ＋ `GeometryMask` 按剩余量裁切 ✓
       *       （GeometryMask 是本项目已验证的用法 ✓ 见 SummaryScene 的滚动区 ✓）
       *   ★ 影响面：只包装**这一场**的 `scene.cdBar.setRatio` ✓ 通用代码一个字不动 ✓ */
      try {
        const cw = (scene._cardRule && scene._cardRule.width) ? scene._cardRule.width + 96 * s : 680 * s;
        const cardL = cx - cw / 2, cardR = cx + cw / 2;
        const cardTop = (scene.wordText ? scene.wordText.y : cy - 141 * s) - 74 * s;
        if (scene.cdBar) {
          if (scene.cdBar.setY) scene.cdBar.setY(cardTop - 22 * s);
          if (scene.cdBar.setBg) scene.cdBar.setBg(K.deepBlue2, K.silverN);   // 条底：冷银描边（把条框出来 ✓）
          if (scene.cdBar.setColor) scene.cdBar.setColor(0x40463e);           // 兜底色 = 渐变起点（苔绿）
          /* ——— 条身渐变（A 案「苔与金」）———
           *   左端 苔绿 #304830 → 中 苔/橄榄 #40463E → 石材 #303030 → 右端 褪色古铜金 #9C846C→#B4B49C */
          const GRAD = [
            [0.00, 0x304830], [0.30, 0x40463e], [0.62, 0x303030],
            [0.86, 0x9c846c], [1.00, 0xb4b49c]
          ];
          const gr = (t) => {
            for (let i = 0; i < GRAD.length - 1; i++) {
              const t0 = GRAD[i][0], c0 = GRAD[i][1], t1 = GRAD[i + 1][0], c1 = GRAD[i + 1][1];
              if (t >= t0 && t <= t1) {
                const k2 = (t1 === t0) ? 0 : (t - t0) / (t1 - t0);
                const r0 = (c0 >> 16) & 255, g0 = (c0 >> 8) & 255, b0 = c0 & 255;
                const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
                return ((Math.round(r0 + (r1 - r0) * k2) << 16) |
                        (Math.round(g0 + (g1 - g0) * k2) << 8) |
                         Math.round(b0 + (b1 - b0) * k2));
              }
            }
            return GRAD[GRAD.length - 1][1];
          };
          /* 条的实际几何：位图条一定在条底框内（框 = 字体 6px + 原点 0.5）✓
           *   bar 的矩形本身没暴露出来 ✗ 所以从条底的"框"反推 ✓ 比写死数字稳 ✓ */
          const barL = cardL + 20 * s, barW = cw - 40 * s;
          const barH = 12 * s;                          // 与 CombatScene 造条时一致 ✓
          /* ★ _makeBar 用 setOrigin(0, 0.5) ✓ 所以 setY 设的是**竖直中心** ✗
           *   → 画矩形必须减半高 ✓（不减就是整条偏下半个条高 ✓ 我差点写错 ✓） */
          const barTop = (cardTop - 22 * s) - barH / 2;
          const gradG = scene.add.graphics().setDepth(5);
          const N = 68;                                  // 68 段 → 视觉上就是连续渐变 ✓ 成本极低 ✓
          for (let i = 0; i < N; i++) {
            const t0 = i / N, t1 = (i + 1) / N;
            gradG.fillStyle(gr((t0 + t1) / 2), 1);
            gradG.fillRect(Math.round(barL + barW * t0 + 1), Math.round(barTop + 2),
                           Math.ceil(barW * (t1 - t0)) + 1, Math.round(barH - 3));
          }
          keep(gradG);
          /* 裁切：只显示"剩余量"那一截（渐变**不缩放** ✓ 只是被裁 ✓） */
          const mkMask = scene.make && scene.make.graphics ? scene.make.graphics() : scene.add.graphics();
          mkMask.fillStyle(0xffffff, 1);
          mkMask.fillRect(0, 0, barW, barH);             // ★ setScale 是相对原始尺寸的 ✓ 内容按原始尺寸画 ✓
          if (mkMask.setVisible) mkMask.setVisible(false);
          const mask = mkMask.createGeometryMask ? mkMask.createGeometryMask() : null;
          if (mask) { gradG.setMask(mask); mkMask.setPosition(barL, barTop); }
          /* 包装这一场的 setRatio（**只这一场** ✗ 通用代码不动 ✓） */
          const rawSet = scene.cdBar.setRatio;
          scene.cdBar.setRatio = function (r0) {
            if (rawSet) rawSet.call(this, r0);
            const r = Math.max(0, Math.min(1, (r0 == null ? 1 : r0)));
            if (mask && mkMask.setScale) mkMask.setScale(r, 1);
          };
          scene.cdBar.setRatio(1);                       // 先按满条画一次 ✓
          g.cdMask = mkMask; g.cdGrad = gradG;           // 供 clear() 兜底（虽然 keep 已登记 ✓）
          /* ★ 2026-09-24 用户最终口径："**算了，不要横条计时了**" ✓
           *   → 条身渐变（A 案「苔与金」）**不显示** ✗ 时间只由火的圆环表达 ✓
           *   → 可见性由 `_fireBar(scene, null)` 统一收起 ✓（空题态/有题态都收起 ✓）
           *   ★ `g.cdGrad` 是我自己 `scene.add.graphics()` 造的 ✗
           *     `cdBar.setVisible(false)` **管不到它** ✓ 必须单独藏 ✓ */
          gradG.setVisible(false);
          if (mkMask.setVisible) mkMask.setVisible(false);
        }
        if (scene.cdText) {
          scene.cdText.setDepth(6);
          scene.cdText.setColor(K.numWarmS);
          if (scene.cdText.setPosition) scene.cdText.setPosition(cardR - 22 * s, cardTop - 52 * s);
          else { if (scene.cdText.setY) scene.cdText.setY(cardTop - 52 * s); if (scene.cdText.setX) scene.cdText.setX(cardR - 22 * s); }
        }
        g.cdLabel = keep(Babel.UI.text(scene, cardL + 20 * s, cardTop - 46 * s, '剩余时间',
          { font: Babel.FONTS.body, size: Math.round(13 * s) + 'px', color: K.silverS, origin: [0, 0.5] }).setDepth(6));
      } catch (e) { /* 位置拿不到就保持 E3 原样 ✓ 不崩 ✓ */ }

      /* ---- 阶段徽标：**已按用户要求删除** ✗（2026-09-24："这个删掉"）
       *   原来在 (cx, 66) 显示「入定 · SAMADHI / 自在 · VIMUTTI / 无忧觉 · ASHOKA」✓
       *   → 现在**不在屏幕上写阶段名** ✓ 阶段的差别只走颜色/横幅等演出 ✓ */
      g.badge = null;

      /* ---- 底栏：藏掉 E3 那条浅色分隔线，改画古铜金细线（藏品文字沿用 E3 ✓）---- */
      const footY = cy + 296 * s;
      const fo = scene._footObjs || [];
      const footRule = fo[0];
      if (footRule && footRule.setFillStyle) footRule.setFillStyle(K.bronzeN, 0.35);
      (fo || []).forEach(function (o) {
        if (o && o.setColor && o !== footRule) o.setColor(K.bronzeHiS);   // 底栏文字 → 古铜金
      });

      /* ---- 敌我血条：**自己重刷一遍，别信默认** ✗（2026-09-24 用户两次说看不见 ✓）
       *   · 条底：`#181828` 太接近背景 → 抬到 `#2A2A3C` ＋ 冷银描边（把条"框"出来 ✓）
       *   · 我方填充：冷银，条本来的浅蓝在深底上偏暗 ✗
       *   · 敌方填充：朱红；**三阶段**换官方语义红 `#C01D22`（在 onWord 里按阶段再刷 ✓）
       *   · 数值数字：近白 `#F2EFE4` ＋ 加粗（小字 + 暗色是双重难读 ✓） */
      if (scene.enemyBar && scene.enemyBar.setBg) scene.enemyBar.setBg(0x2a2a3c, K.silverN);
      if (scene.enemyBar && scene.enemyBar.setColor) scene.enemyBar.setColor(K.wineN);
      /* ★★★ 敌人血条改**渐变** ✗✗（2026-09-24 用户：
       *   "不要跨阶段变血条颜色，直接做成渐变颜色，比如之前的倒计时条这样"）
       *   ★ 机制照抄倒计时条那套：68 段 Graphics 画满整条 ✓
       *     ＋ GeometryMask 裁出"剩余量" ✓ → 渐变**不缩放** ✓ 只被裁 ✓ */
      const _hbg = this._enemyBarGradBuild(scene, s, cx, cy);
      if (_hbg) {
        ['grad', 'mask', 'bg', 'tick'].forEach(function (k) { if (_hbg[k]) keep(_hbg[k]); });
      }
      if (scene.playerBar && scene.playerBar.setBg) scene.playerBar.setBg(0x2a2a3c, K.silverN);
      if (scene.playerBar && scene.playerBar.setColor) scene.playerBar.setColor(0x9fc6d8);

      /* ★★★ 奎隆专属：立绘牌下方那行「伤害减免 XX%」✗✗（2026-09-24 用户）
       *   位置 `cy + 196*s` ✓：敌人血条数值在 `cy + 170*s` 、我方血条在 `cy + 230*s`
       *     → 两者之间那条空带 ✓ **不压任何既有元素** ✓
       *   ★ 只在奎隆这场存在 ✗（整个 build 都在 `skin === 'quilon'` 分支里 ✓）*/
      /* ★★★ 减伤指示器（符印版 ✗ 2026-09-24 用户：
       *   "加入这里的这一圈要转动，另外圈的刺不要顶到血量，稍微小一点"）
       *   构成：棘冠（转 ✓）＋ 深盘＋内环＋百分比＋右侧两行文案＋底下一道细线 ✓
       *   ★ 用 **一个容器** 装全部 ✓ 这样只算一次坐标 ✓ 且整块可一起隐藏 ✓
       *   ★ 棘冠用 `scene.add.star`（Phaser 自带多角星 ✓ 16 角、内外半径不同 ✓）
       *     **旋转用 tween** ✓（连续匀速 ✓ 12 秒一圈 ✓）*/
      const indW = 272 * s, indH = 150 * s;
      g.dmgCutG = scene.add.container(cx + 490 * s - indW / 2, cy + 186 * s).setDepth(23);
      const _cx0 = 22 * s, _cy0 = 17 * s;                  // 棘冠与圆盘的中心（相对容器 ✓）
      g.dmgCutSun = scene.add.star(_cx0, _cy0, 16, 12 * s, 17 * s, 0x7d1710, 0.95)
        .setStrokeStyle(Math.max(1, Math.round(1.2 * s)), 0xc2402c, 0.85);
      g.dmgCutSun2 = scene.add.star(_cx0, _cy0, 16, 5.5 * s, 8.5 * s, 0xc2402c, 0.55);
      g.dmgCutDisc = scene.add.circle(_cx0, _cy0, 12 * s, 0x0b0b0f, 1)
        .setStrokeStyle(Math.max(1, Math.round(1.8 * s)), 0xc2402c, 1);
      g.dmgCutDisc2 = scene.add.circle(_cx0, _cy0, 8.6 * s, 0x0b0b0f, 0)
        .setStrokeStyle(Math.max(1, Math.round(1 * s)), 0x8a8078, 0.55);
      g.dmgCutNum = Babel.UI.text(scene, _cx0 - 1.6 * s, _cy0, '50', {
        font: Babel.FONTS.num, size: Math.round(16 * s) + 'px', color: '#efe7d8', origin: [0.5, 0.5]
      }).setDepth(24);
      g.dmgCutPct = Babel.UI.text(scene, _cx0 + 8.2 * s, _cy0 + 3 * s, '%', {
        font: Babel.FONTS.num, size: Math.round(7 * s) + 'px', color: '#c8a24a', origin: [0.5, 0.5]
      }).setDepth(24);
      g.dmgCutTxt = Babel.UI.text(scene, 52 * s, _cy0 - 7 * s, '伤害减免', {
        font: Babel.FONTS.body, size: Math.round(15 * s) + 'px', color: '#efe7d8', origin: [0, 0.5]
      }).setDepth(24);
      g.dmgCutStage = Babel.UI.text(scene, 52 * s, _cy0 + 9 * s, '入定', {
        font: Babel.FONTS.body, size: Math.round(10 * s) + 'px', color: '#c8a24a', origin: [0, 0.5]
      }).setDepth(24);
      g.dmgCutRule = scene.add.rectangle(4 * s, _cy0 + 24 * s, 232 * s, Math.max(1, Math.round(1 * s)), 0xc2402c, 0.55)
        .setOrigin(0, 0.5);
      g.dmgCutG.add([g.dmgCutSun, g.dmgCutSun2, g.dmgCutDisc, g.dmgCutDisc2,
                     g.dmgCutNum, g.dmgCutPct, g.dmgCutTxt, g.dmgCutStage, g.dmgCutRule]);
      g.dmgCutObjs = [g.dmgCutG, g.dmgCutSun, g.dmgCutSun2, g.dmgCutDisc, g.dmgCutDisc2,
                      g.dmgCutNum, g.dmgCutPct, g.dmgCutTxt, g.dmgCutStage, g.dmgCutRule];
      /* ★ 棘冠旋转（持续 ✓ 12 秒一圈 ✓ 与坛城环同一手法 ✓）*/
      g.dmgCutSpin = scene.tweens.add({
        targets: [g.dmgCutSun, g.dmgCutSun2],
        rotation: Math.PI * 2, duration: 12000, repeat: -1, ease: 'Linear'
      });
      g.tweens.push(g.dmgCutSpin);
      this._dmgCutLabel(scene, s);

      /* ---- 反馈闪层（答对/答错各一层 ✓ 克制 ✓ 无粒子 ✗）---- */
      g.flashOk = keep(scene.add.rectangle(0, 0, W, H, K.bronzeN, 0).setOrigin(0, 0).setDepth(60));
      g.flashBad = keep(scene.add.rectangle(0, 0, W, H, K.wineN, 0).setOrigin(0, 0).setDepth(60));

      this.onWord(scene);
      /* ★ 一阶段「尼卢火」：**最后**建（要在 flash 层与 onWord 之后 ✓
       *   火是 depth 21/22 的实体，且按 `fireStage` 门控 ✓） */
      this._fireBuild(scene);
    },
    /* ---- 一阶段：建火（在 build 末尾调 ✓ 只在 fireStage 且一阶段生效 ✓）---- */
    /* （火子系统本体在本文件上半部分的 `_fireBuild` 等 ✓ 这里只是进场钩子 ✓） */

    /* ======================================================================
     * ② 每题：按 HP 判阶段（入定 → 自在 → 无忧觉 ✓ 官方三阶段名 ✓）
     *    ★ 阈值**故意不写死** ✗ —— 用敌人定义里既有的字段读（没有就不换阶段 ✓）
     *      这样奎隆那条 `enemyHP` 以后要改，皮肤不用跟着改 ✓
     * ==================================================================== */
    onWord(scene, sIn) {
      const g = scene._kq; if (!g) return;
      const s = this._s(scene, sIn);
      if (scene.wordText) scene.wordText.setColor(K.paleS);

      const d = scene.enemyDef || {};
      const hp = scene.enemyHP;
      /* 三阶段判据 = _phaseOf（唯一真源 ✓）
       * 奎隆这会儿还没定机制 ✓ 所以把既有三个字段当"阶段阈值"用：
       *   linkFrom(45)=开局入定 / linkExtraFrom(30)=自在 / linkReverseFrom(15)=无忧觉 ✓ */
      const ph = this._phaseOf(scene);

      /* ★ 阶段名**不再写在屏幕上** ✗（用户 2026-09-24："这个删掉" ✓）
       *   原来这里往徽标写「入定/自在/无忧觉」✓ 现在删掉 ✓
       *   阶段的差别改由：血条色（三阶段官方红）+ 转阶段横幅 来体现 ✓ 更干净 ✓ */
      /* 血条：阶段三换**官方语义红**（简报：游戏里就是这么用的 ✓ 玩家会认 ✓） */
      /* ★★★ **不再跨阶段改血条色** ✗✗（2026-09-24 用户：
       *   "不要跨阶段变血条颜色，直接做成渐变颜色"）
       *   原来：`setColor(ph === 3 ? uiRedN : vermN)` ✓ → 现在血条是**固定渐变** ✓
       *   ★ 但这里**保留调用** ✓（空函数 ✓ 以后想加别的阶段反馈有地方写 ✓）*/
      this._enemyBarTint(scene, ph);
      /* 倒计时条：**不再改色** ✗ —— 现在条身是**静态渐变**（A 案「苔与金」✓ 用户口径）
       *   原来这里按阶段刷"古铜金→朱红→官方红" ✗ 那是"随时间/阶段变色"的手感 ✓ 已被取代 ✓
       *   （`_newWord` 里那行 `cdBar.setColor(0xf5a623)` 仍会刷兜底色 ✓ 但渐变 Graphics 在它之上 ✓ 看不见 ✓） */

      /* ★★★ 转阶段横幅**已删** ✗✗（2026-09-24 用户："转阶段中间的提示词都删掉，太难看了"）
       *   原来进二/三阶段会在 `y = 120*s` 弹一句：
       *     二阶段「自在 · 缚已解」／三阶段「无忧觉 · 棒喝」✓
       *   → 现在**不弹** ✗
       *   ★ `g.phase = ph` **必须保留** ✗✗ —— 它是"本帧的阶段值"记账 ✓
       *     删了会让 `prev !== 0 && ph > prev` 那类判断失去依据 ✓（以后要加别的阶段表现还要用 ✓）
       *   ★ 只删**显示** ✗ 不删**状态记账** ✓ —— 这是删 UI 时的通用口径 ✓
       *   ★ 原来的文案留在这里备查（万一以后想改成别的表现 ✓）：
       *     二阶段「自在 · 缚已解」／三阶段「无忧觉 · 棒喝」 */
      g.phase = ph;

      /* ======================================================================
       * ★★ 一阶段「尼卢火」：**没有点开的火时，屏幕上不该有题** ✗
       *   用户 2026-09-24 截图指出："原来的题还在这干嘛" ✓
       *   病因：开战时 `_newWord` 会照常出**一道普通四选一**（词卡里留着一个和火无关的词 ✗），
       *         点开火之后**它不会被清掉** → 题卡与火的题**同屏** ✓ 很脏 ✓
       *   修：火阶段且 `fire.open < 0` → **把题卡整体藏掉** ＋ 词条位改成一句提示 ✓
       *   ★ 题卡就是 `scene.card` 容器 ✓ 与 rail 分支同一手法（`card.setVisible(false)`）✓
       *   ★ 只在本阶段生效 ✓ 二/三阶段与其它战斗一行都不变 ✓
       * ==================================================================== */
      if (this._isFireStage(scene) && g.fire && g.fire.open < 0) {
        if (scene.card && scene.card.setVisible) scene.card.setVisible(false);
        if (scene._cardRule && scene._cardRule.setVisible) scene._cardRule.setVisible(false);
        if (scene._answerHint && scene._answerHint.setVisible) scene._answerHint.setVisible(false);
        this._fbHide(scene);   // ★ 空题态 → 碑铭也收起来 ✓
        /* 没有正在答的题 → 也没有"剩余时间"这回事 ✓ 条与数字一并藏 ✓ */
        if (scene.cdBar && scene.cdBar.setVisible) scene.cdBar.setVisible(false);
        if (scene.cdText && scene.cdText.setVisible) scene.cdText.setVisible(false);
        if (g.cdLabel && g.cdLabel.setVisible) g.cdLabel.setVisible(false);
        if (g.cdGrad && g.cdGrad.setVisible) g.cdGrad.setVisible(false);
        if (g.cdMask && g.cdMask.setVisible) g.cdMask.setVisible(false);
        (scene.optionButtons || []).forEach(function (b) { if (b && b.setVisible) b.setVisible(false); });
        /* ★ 词条位**什么都不写** ✗（用户 2026-09-24："这个字去掉" ✓
         *   原来这里写「点 一 朵 火 · 开 始 答 题」✓ 现在留空 ✓ 五朵火本身就说明了一切 ✓）*/
        if (scene.wordText) {
          scene.wordText.setText('');
          scene.wordText.setVisible(false);
        }
        return;
      }
      /* ---- 火阶段但**有**火开着：题目由 `fireNewWord` 接管 ✓ 这里把被藏的东西放回来 ✓ ---- */
      if (this._isFireStage(scene) && g.fire && g.fire.open >= 0) {
        if (scene.card && scene.card.setVisible) scene.card.setVisible(true);
        if (scene._cardRule && scene._cardRule.setVisible) scene._cardRule.setVisible(true);
        if (scene._answerHint && scene._answerHint.setVisible) scene._answerHint.setVisible(true);
        /* ★ 横条倒计时**不放回来** ✗（用户 2026-09-24："算了，不要横条计时了"）
         *   时间只由**那朵火的圆环**表达 ✓ 一套计时 ✓ */
        this._fireBar(scene, null);
        /* 词条：火的词用近白 ✓ */
        if (scene.wordText) scene.wordText.setColor(K.paleS);
      }
      /* ---- 三阶段「无忧觉」：反义词拖拽（2026-09-24 用户构想 ✓）----
       *   ★ 放在最后 ✗ 让火阶段的两条分支先处理 ✓ 互不干扰 ✓ */
    },

    /* ======================================================================
     * ③ 答对：金环脉冲 ＋ 一层极薄的金雾（**不做粒子/碎玻璃** ✗ 简报：不要爆炸 ✗）
     * ==================================================================== */
    onCorrect(scene, index) {
      const g = scene._kq; if (!g) return;
      const s = this._s(scene);
      /* ★ 一阶段「尼卢火」：答对 ＝ 把火治好 ✓
       *   → 火灭 ＋ 随机给另一朵 +5 秒 ＋ 答对计数 +1 ＋ **立刻补位** ✓
       *   ★ 走 CombatScene 的既有管线掉血：火阶段 `enemyHP` 会被 `_onAnswer` 扣 1 ✓
       *     （他"打不动血"是**观感**上的：一阶段结算只推计数，血条由下面的"收阶段"一次性推过去 ✓） */
      if (this._isFireStage(scene) && g.fire) {
        /* ★★ 记账（2026-09-26）：与 `onWrong` 同款 ✗ —— 先取火对象 ✓ 再收题 ✓
         *   （`_fireResolve` 末尾会清题面 ＋ 清 `g.fire.open` ✓ 之后就拿不到了 ✓）
         *   ★ 答**对**也要记 ✓ —— 总结屏 3「对题」的词表读的就是 `logAnswer` 的 `en` ✓ */
        const _f = g.fire.list && g.fire.open >= 0 ? g.fire.list[g.fire.open] : null;
        this._fireResolve(scene, true);
        this._writeFireLog(scene, _f, _f && _f.logCorrect ? String(_f.logCorrect) : '');
        this._fireFlash(scene, true);
        /* ★★ 立刻刷血条（2026-09-24 用户："怎么后面答对没有伤害了？"）
         *   真相：伤害**确实扣了**（自测 8 题逐题 44→37 ✓ 每题 −1 ✓）
         *     但 `enemyBar.setRatio` / `enemyHPText` 只在 `_delayedNext()` 里 **700ms 后**
         *     才更新 ✓（而我刚又把"正确！"也立刻擦了 ✗）
         *     → 当下屏幕上**没有任何血量变化** ✓ 观感就是"没伤害" ✓
         *   → 本阶段在伤害落下后**立刻**刷一次 ✓ 与其它战斗无关 ✓ */
        try { if (scene._refreshBars) scene._refreshBars(); } catch (e) {}
        try { if (scene._updateBossStatus) scene._updateBossStatus(); } catch (e) {}
        /* ★ 答对一般不掉玩家血 ✓ 但藏品/异常也可能掉 ✓ 顺手查一次（幂等 ✓）*/
        this._fireCheckDead(scene);
        try {
          const b = (scene.optionButtons || [])[index];
          if (b && b._rule && b._rule.setFillStyle) b._rule.setFillStyle(K.vermN, 1);
        } catch (e) {}
        return;
      }
      try {
        if (g.flashOk) {
          g.flashOk.setAlpha(0.14);
          const tw = scene.tweens.add({ targets: g.flashOk, alpha: 0, duration: 260 });
          g.tweens.push(tw);
        }
        /* 正确项那条底线定成朱红（＝"这一对定住了" ✓ 与圣徒的"段定住"同一语义 ✓） */
        const b = (scene.optionButtons || [])[index];
        if (b && b._rule && b._rule.setFillStyle) b._rule.setFillStyle(K.vermN, 1);
      } catch (e) { /* 视觉失败不影响结算 ✓ */ }
    },

    /* ======================================================================
     * ④ 答错：全屏酒红薄闪（克制 ✓ 不是爆炸 ✗）
     * ==================================================================== */
    onWrong(scene, index, isTimeout) {
      const g = scene._kq; if (!g) return;
      /* ★ 一阶段「尼卢火」：答错 ＝ 火也灭（用血换时间 ✓）＋ **照样补位** ✓
       *   掉血**由 CombatScene 的 `_playerHit()` 负责** ✗ 皮肤不重复扣 ✓ */
      if (this._isFireStage(scene) && g.fire) {
        /* ★★ 先写记账快照 ✗（2026-09-26）—— `_fireResolve` 内部会清题面 ✓
         *   所以必须在**它之前**把"玩家点了什么"记下来 ✓（火对象上的 log* 字段由
         *   `_fireResolve` 在清题前填好 ✓ 这里只补"玩家那一侧" ✓）
         *   ★ 顺序：`_fireResolve` 会清 `g.fire.open` ✗ → 之后拿不到是哪朵火 ✓
         *     所以**先取火对象** ✓ 再调 `_fireResolve` ✓ */
        const _f = g.fire.list && g.fire.open >= 0 ? g.fire.list[g.fire.open] : null;
        this._fireResolve(scene, false, isTimeout);
        this._writeFireLog(scene, _f, isTimeout ? '（超时）' : (index >= 0 && _f && _f.logOptions ? String(_f.logOptions[index] || '') : ''));
        this._fireFlash(scene, false);
        return;
      }
      try {
        if (g.flashBad) {
          g.flashBad.setAlpha(isTimeout ? 0.30 : 0.24);
          const tw = scene.tweens.add({ targets: g.flashBad, alpha: 0, duration: 420 });
          g.tweens.push(tw);
        }
      } catch (e) { /* 同上 ✓ */ }
    },

    /* ★★★ 把"奎隆火这一题玩家看到/选了什么"写到 `scene._fireLog` ✗✗
     *   （2026-09-26 修"每局总结里奎隆的错题全是空的"）
     *   由 `RunState.logAnswer` 读取 —— 它在 `wordText` / `_shown` 都被清空后才会跑 ✓
     *   ★ 参数：
     *     `f`  ＝ 那朵火（上面 `_fireResolve` 已把 `logWord/logZh/logOptions/logCorrect` 填好 ✓）
     *     `ur` ＝ 玩家那一侧（答对＝正确项 ✓ 答错＝他点的那项 ✓ 超时＝『（超时）』✓）
     *   ★ 必须**每题覆盖写** ✗ —— 不清会让上一题的快照被下一题读到 ✓ */
    _writeFireLog(scene, f, ur) {
      try {
        if (!scene) return;
        if (!f) { scene._fireLog = null; return; }
        /* ★★★ 题面口径按**阶段**取 ✗✗（2026-09-30 修"词表里混进中文"）
         *   用户截图：屏 3 词表里出现「出现；在外」「平行线；对比」这样的**中文** ✓
         *   病因（`_firePickWord` 的三个分支字段名不统一 ✗ 是历史遗留 ✓）：
         *     · 一阶段 `en2zh` → `word` = **英文词** ✓
         *     · 二阶段 `zh2en` → `word` = **中文释义** ✗（`return { word: zh, … }`）
         *     · 三阶段 `prep`  → `word` = **骨架** `be subject ___` ✗
         *       （而火上显示的是 `w.key` ＝ `subject` ✓）
         *   而我上次一律写 `f.logWord = f.word` ✗
         *     → 二阶段把中文记成了"英文词" ✓ 三阶段把骨架记成了词 ✓ 都不对 ✓
         *   ⇒ 按阶段取值 ✗（问自己一句：**玩家在火上看到的是什么** ✓）：
         *     · 三阶段 → `f.key`（`subject` ✓ 火上写的就是它 ✓）
         *     · 其余   → `scene._target`（**纯字母的英文词** ✓ `CombatScene` L702/743 算好的 ✓）
         *       ★ 比 `f.word` 可靠 ✗ —— `f.word` 在二阶段是中文 ✓
         *     · 兜底 → `f.word`（`_target` 为空时至少不写空 ✓）*/
        /* ★★★ 题面口径：**直接用火上存的 `f.logEn`** ✗✗（2026-09-30 第三次修同一个病）
         *   ★ 历史（三次都是"记账取错了字段" ✗ 记下来别再犯）：
         *     ① 一版：`en: f.logWord`（= `f.word`）✗
         *        → 二阶段 `f.word` 是**中文**、三阶段是**骨架** ✓ 词表里混进中文 ✓
         *     ② 二版：改成按阶段取 `scene._target` / `f.key` ✓
         *        → 修好了二/三阶段 ✓ 但 `_target` 只被**词卡 quiz** 赋值 ✗
         *          奎隆火阶段从不走那里 → 整场 49 题**全记成上一张词卡的词** ✓
         *     ③ 现在：**在 `_fireSpawn` 里就把词算好存进 `f.logEn`** ✗
         *        `_writeFireLog` 只做搬运 ✓ 不猜、不查场景字段 ✓
         *   ★★ 口径（这三次的共同教训 ✗✗）：
         *     **"这道题考什么"必须在题目生成时定下来并存在题目对象上** ✗
         *     凡是"事后从场景/全局字段倒推"的写法，都会在**别的题目类型**下取错值 ✓
         *     因为那个字段的生命周期不由这道题管 ✓
         *   ★ 兜底：`logEn` 缺失时退回旧的按阶段取法 ✗（老存档/异常路径不写空 ✓）*/
        const isPrep = (f.dir === 'prep') || (f.key != null && f.key !== '');
        let enOut;
        if (f.logEn != null && String(f.logEn).length) {
          enOut = String(f.logEn);
        } else if (isPrep) {
          enOut = f.key || '';
        } else {
          enOut = (scene._target && String(scene._target).length) ? String(scene._target) : (f.word || '');
        }
        /* ★ 二阶段 `f.word` 就是中文释义 ✓ 正好填进「中文释义」那列 ✗
         *   （原来那列是空的 ✓ 因为 `f.logZh` 只对三阶段的 `prepHint` 有值 ✓）
         *   ★ 三阶段仍用 `logZh`（整条短语释义 ✓ 比 `f.word` 的骨架有用 ✓）*/
        let zhOut = f.logZh || '';
        if (!zhOut && !isPrep) zhOut = f.word || '';
        scene._fireLog = {
          en: enOut,
          zh: zhOut,
          shown: (f.logOptions || []).slice(),
          correct: f.logCorrect || '',
          your: ur || '',
        };
      } catch (e) {}
    },

    /* ======================================================================
     * ⑤ 每题复位选项外观（否则上一题的朱红会留到下一题 ✗）
     * ==================================================================== */
    resetOptions(scene, sIn) {
      const s = this._s(scene, sIn);
      (scene.optionButtons || []).forEach(function (b) {
        if (b && b._rule && b._rule.setFillStyle) b._rule.setFillStyle(K.bronzeN, 0.5);
        const label = b && b.list && b.list[1];
        if (label && label.setColor) label.setColor(K.paleS);
        const key = b && b.list && b.list[2];
        if (key && key.setColor) key.setColor(K.bronzeHiS);
      });
      if (scene.wordText) scene.wordText.setColor(K.paleS);
    },

    /* ======================================================================
     * ⑥ 离场：清干净（scene 实例是**复用**的 ✗ 不清会在下一场复活 ✓ 踩过）
     * ==================================================================== */
    clear(scene) {
      const g = scene._kq;
      /* ★ 伤害飘字也要收掉 ✗（防残留 ✓）*/
      if (g && g.dmgFloat) { try { g.dmgFloat.destroy(); } catch (e) {} g.dmgFloat = null; }
      if (g) { g.enemyBarGrad = null; g.enemyBarMask = null; g.enemyBarBgG = null; g.enemyBarTickG = null; }
      if (g && g.dmgFloatTw && g.dmgFloatTw.stop) { try { g.dmgFloatTw.stop(); } catch (e) {} }
      /* ★★ 减伤符印：先停旋转 ✓ 再销毁容器及其子对象 ✓（2026-09-24）
       *   ★ 不停 tween 会留下“旋转一个已销毁对象”的僵尸回调 ✗
       *     （与一阶段火的 `onTick` 同一类坑 ✓ 见 44.70 ✓）*/
      if (g && g.dmgCutSpin && g.dmgCutSpin.stop) { try { g.dmgCutSpin.stop(); } catch (e) {} }
      if (g && g.dmgCutObjs) {
        g.dmgCutObjs.forEach(function (o) { try { if (o && o.destroy) o.destroy(); } catch (e) {} });
        g.dmgCutObjs = null;
      }
      if (!g) return;
      /* ★ 一阶段：先把火全销毁（火是 depth 21 的实体 ✗ 不清会跟着进二阶段 ✓）*/
      this._fireClear(scene);
      (g.timers || []).forEach(function (t) { try { t.remove(); } catch (e) {} });
      (g.tweens || []).forEach(function (t) { try { t.stop(); } catch (e) {} });
      (g.objs || []).forEach(function (o) { try { if (o && o.destroy) o.destroy(); } catch (e) {} });
      /* ★ mask 用的 Graphics 是 `scene.make.graphics()` 造的（**不在显示列表** ✓）
       *   所以它不在 g.objs 里 ✗ → 必须单独销毁 ✓ 否则场景复用时残留 ✓ */
      try { if (g.cdMask && g.cdMask.destroy) g.cdMask.destroy(); } catch (e) {}
      g.cdMask = null; g.cdGrad = null;
      scene._kq = null;
    },

  };

  Babel.SKIN_Quilon = Skin;
  /* 兼容别名（与 saint/nightcity 的命名习惯保持一致 ✓） */
  Babel.SKIN_Quilon = Skin;
})();
