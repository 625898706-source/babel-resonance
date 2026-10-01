/* ============================================================================
 * saint.js —— 「圣徒」专属战斗皮肤（2026-09-18 新增）
 * ----------------------------------------------------------------------------
 * 设计语言取自 Arknights「众生行记」素材：冰白／雾蓝高调拼贴 ✓ 细弧线 ✓ 白羽 ✓
 * 强调色：淡金 #d8c9a3（呼应它的金瞳 ✓）／深金 #b9a271
 *
 * ★ 风险控制（项目红线：绝不影响其它战斗 ✓）：
 *   · **不重写立绘图版** ✗ —— 沿用 CombatScene 的标准立绘代码与**深色图版** ✓
 *     （实测：logos-idle 等立绘带不透明黑底 ✓ 白图版会露馅 ✗ 见 skill §40）
 *   · **不替换选项按钮** ✗ —— 沿用 Babel.UI.row ✓ 只改线条颜色 ✓
 *   · 所有钩子都在 CombatScene 里以 `this._skin === 'saint'` 判定 ✓
 *     未拥有该字段的敌人**代码路径一个字节都不变** ✓✓
 *
 * 对外接口（与 nightcity 那套同形 ✓，CombatScene 只调用其中四个）：
 *   build(scene, opts)     进场：铺背景 ＋ 细横纹 ＋ 起三个专属动效 ＋ 倒计时上移加粗加标签
 *   resetOptions(scene)    每题：选项线颜色（正确项淡金 / 其余冰蓝）
 *   onWord(scene)          每题：光环与羽毛重新对齐到立绘上方
 *   clear(scene)           离场：销毁本皮肤造的所有对象与补间（防场景复用残留 ✗）
 * ========================================================================== */
(function () {
  if (!window.Babel) window.Babel = {};
  const GOLD = 0xd8c9a3, GOLD2 = 0xb9a271, ICE = 0x8fa8bd, VEIL = 0xffffff;

  const Skin = {
    /* ---------- 进场 ---------- */
    build(scene, opts) {
      const s = Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));   // ★ 真实缩放 ✓（原来用 scene._sc ✗ 不存在 → 网格间距也错了 ✓）
      const W = scene.scale.width, H = scene.scale.height;
      scene._saintObjs = [];
      scene._saintTweens = [];
      const keep = (o) => { scene._saintObjs.push(o); return o; };

      /* 背景：真素材 ＋ 白色薄纱 ＋ 细横纹（Graphics 线 ✓ 可复现 ✓） */
      if (scene.textures.exists('skin-saint-bg')) {
        const bg = scene.add.image(W / 2, H / 2, 'skin-saint-bg').setDepth(-20);
        const k = Math.max(W / bg.width, H / bg.height);   // cover ✓ 铺满不留边
        bg.setScale(k);
        keep(bg);
      }
      keep(scene.add.rectangle(W / 2, H / 2, W, H, VEIL, 0.52).setDepth(-19));
      const g = scene.add.graphics().setDepth(-18);
      g.lineStyle(Math.max(1, Math.round(1 * s)), ICE, 0.10);
      for (let y = 0; y < H; y += Math.round(4 * s)) { g.lineBetween(0, y, W, y); }
      /* ★ 蓝图网格（★ 预览里最重要的底子 ✓ 之前漏实装 ✗ → 现在补 ✓ 2026-09-21）
       *   40·s 一格 ✓ 电光蓝 0.16 ✓ 横竖各一遍 ✓ —— 这正是参考图那层坐标纸 ✓ */
      g.lineStyle(Math.max(1, Math.round(1 * s)), 0x54686a, 0.13);   // ★ 深青灰 0.13（预览 B 案口径 ✓）
      for (let x = 0; x <= W; x += Math.round(40 * s)) g.lineBetween(x, 0, x, H);
      for (let y2 = 0; y2 <= H; y2 += Math.round(40 * s)) g.lineBetween(0, y2, W, y2);
      keep(g);

      /* ① 圣光横扫：**已按用户要求删除** ✗（2026-09-18）*/

      /* ③ 白色羽毛：**已按用户要求删除** ✗（2026-09-18）*/

      this.onWord(scene);

      /* ---------- 照预览补齐：倒计时上移 ＋ 标签 ＋ 各处换色（2026-09-18 修 ✗）---------- */
      try {
        const cx = scene.width / 2;
        /* 坐标全部从**现有对象**反推 ✓ 不猜 ✗ */
        const ruleW = (scene._cardRule && scene._cardRule.width) ? scene._cardRule.width : 344 * s;
        const cardW = ruleW + 96 * s;                       // 卡片中间细线是 cardW−96·s ✓
        const cardL = cx - cardW / 2;
        const cardR = cx + cardW / 2;
        const cardTop = (scene.wordText ? scene.wordText.y : cy - 141 * s) - 74 * s;   // 词文本位于 cardTop+74·s ✓
        scene._saintCardTop = cardTop;

        /* 倒计时条：挪到**词卡上方** ✓（预览定稿位置 ✓）*/
        if (scene.cdBar && scene.cdBar.setY) scene.cdBar.setY(cardTop - 22 * s);
        if (scene.cdText && scene.cdText.setY) {
          /* ★ 数字放到「剩余时间」那一行（否则会被条压住 ✗ 2026-09-18）*/
          /* ★ depth 6 ✗ —— 条是在 cdText **之后**创建的（L290 > L287 ✓）
           *   同深度下后建者压在上面 ✓ → 光挪位置治不了本 ✓ 必须显式抬层级 ✓ */
          scene.cdText.setDepth(6);
          scene.cdText.setY(cardTop - 52 * s);
          scene.cdText.setX(cardR - 22 * s);
        }
        /* 「剩余时间」标签（预览里在条的左上 ✓ 深墨 13×s ✓）*/
        const lab = scene.add.text(cardL + 20 * s, cardTop - 46 * s, '剩余时间',
          { fontFamily: Babel.FONTS.body, fontSize: Math.round(13 * s) + 'px', color: '#12232e' }).setOrigin(0, 0.5).setDepth(6);
        keep(lab);

        /* ---------- 顶栏与底栏融入背景（2026-09-18 用户要求）----------
         *   顶栏本来是**一条 44 高的白底矩形** ✓ 在这里设为全透明 ✓
         *   → 顶栏文字（B1/01 · 层名 · 目标生命 · 残页）直接透出背景图 ✓
         *   ★ 「退出」按钮保留外形 ✗（可点控件需要明确点击区域 ✓）*/
        if (scene._hud) {
          if (scene._hud.bg && scene._hud.bg.setAlpha) scene._hud.bg.setAlpha(0);
          if (scene._hud.rule && scene._hud.rule.setFillStyle) scene._hud.rule.setFillStyle(ICE, 0.65);
        }
        /* 底栏那条横线也换冰蓝（文字/胶囊没有 setFillStyle ✓ 用存在性区分 ✓）*/
        (scene._footObjs || []).forEach(function (o) {
          if (o && o.setFillStyle && o.width && o.width > 400) o.setFillStyle(ICE, 0.55);
        });

        /* 换色：卡片上下细线 → 冰蓝（预览口径 ✓）*/
        if (scene._cardRule && scene._cardRule.setFillStyle) scene._cardRule.setFillStyle(ICE);
        if (scene._cardBotRule && scene._cardBotRule.setFillStyle) scene._cardBotRule.setFillStyle(ICE);
        /* 敌人血条 → 淡金（预览里圣徒那条是金渐变 ✓ 这里用纯淡金 ✓）*/
        if (scene.enemyBar && scene.enemyBar.setColor) scene.enemyBar.setColor(GOLD);
        if (scene.enemyBar && scene.enemyBar.setBg) scene.enemyBar.setBg(0xe8eef3, ICE);
        /* 选项底线 → 冰蓝（每题都会由 resetOptions 再刷一次 ✓）*/
        (scene.optionButtons || []).forEach(function (b) {
          if (b && b._rule && b._rule.setFillStyle) b._rule.setFillStyle(ICE, 0.45);
        });
      } catch (e) {}
    },


    /* ==========================================================================
     * 「连线」阶段（2026-09-21 用户要求 ✓ 圣徒 45 血，打到 44 进入本阶段 ✓）
     *   · 隐藏原选项 UI ✗ → 左右两栏各 3 个节点 ✓ 按住不放一笔连完 ✓
     *   · 连对＝段定住并自动从新节点继续 ✓ 连错＝段变红断掉并从当前端点重来 ✓
     *   · 拖回已连过的端点 ＝ 擦掉那一段（反悔 ✓）
     *   · 三对连完 → 调 scene._onAnswer() ✓✓ 于是**原有的**
     *     答对鸽群四散 / 答错收拢染红**全部自动复用** ✓ 一行都不用重写 ✓
     * ======================================================================== */
    _linkActive(scene) {
      const d = scene.enemyDef || {};
      if (d.linkFrom == null) return false;
      return (scene.enemyHP != null) && (scene.enemyHP <= d.linkFrom);
    },
    _linkBuild(scene) {
      if (!this._linkActive(scene)) return;
      const s = Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));
      this._linkClear(scene);
      /* ★ 疤痕寿命（2026-09-21 用户定稿 ✓）
       *   口径 ✓：出现的那一题不算 ✗ → **之后再活 3 题** ✓ 在第 4 题消失 ✓✓
       *   实例：第 3 题连错 → 疤出现
       *          第 4 / 5 / 6 题：还在 ✓✓（活满 3 题）
       *          第 7 题：消失 ✗✓
       *   （上一版写的是 age < 3 ✗ 少活了一题 ✓ 用户实测指出来了 ✓ → 改 age < 4 ✓）
       *   ★ 只在每题开头动一次 ✓ 一处即可 ✓✓ */
      if (scene._saintScars && scene._saintScars.length) {
        scene._saintScars.forEach(function (sc) { sc.age = (sc.age || 0) + 1; });
        scene._saintScars = scene._saintScars.filter(function (sc) { return sc.age < 4; });
        if (scene._saintScarDraw) scene._saintScarDraw(false);
      }
      const PAIRS = 3, W = 220 * s, H = 86 * s, SNAP = 60 * s;   // ★ 220 宽 ✓ 两栏才能完全落在中间区 ✓
      const st = { nodes: [], segs: [], cur: null, from: null, settled: false };
      scene._saintLink = st;
      /* ① 取三对（2026-09-21 用户定稿 ✓）
       *   ★ 来源＝**高考熟词生义库** Babel.SENSE_WORDS ✓
       *     · 池子＝过滤后 **422 个词 / 655 条**（生义 ≤10 字 ✓ 词 ≤12 字母 ✓ 220px 节点放得下 ✓）
       *     · 一题抽 **3 个互不相同**的词 ✓✓（严防同词进同题 ✗ 因为有的词有 10 个生义 ✓）
       *     · 每个词取它的**一个生义** ✓（多生义随机取一条 ✓ 下次可能换一个 ✓ 天然重复记忆 ✓）
       *     · ✗ 不放熟义 ✗ 不放陷阱（用户要求 ✓）
       *   ★ 若词库缺失 ✗ → **退回原逻辑**（词库抽词 ＋ 当前题目的词 ✓）保证不崩 ✓✓ */
      /* ★ 是否进入二阶段（右栏多一个干扰项）✓ 2026-09-24 用户定：阈值 **30** 血 ✓
       *   ★ 只读 `enemyDef.linkExtraFrom` ✗ 代码里**不写死数字** ✓（改数值只改 constants.js ✓）*/
      const _d = scene.enemyDef || {};
      const _extra = (_d.linkExtraFrom != null) && (scene.enemyHP != null) && (scene.enemyHP <= _d.linkExtraFrom);
      /* ★★ 是否进入三阶段「反向连线」✓ 2026-09-24 用户定：阈值 **15** 血 ✓
       *   判断与 _extra 完全同形 ✓ 只多一个字段 ✓ 其它敌人无此字段 → 永不为真 ✓✓ */
      const _rev = (_d.linkReverseFrom != null) && (scene.enemyHP != null) && (scene.enemyHP <= _d.linkReverseFrom);
      const pairs = [];
      const shown = scene._shown || [];
      const ci = (typeof scene.correctIndex === 'number') ? scene.correctIndex : -1;
      /* —— 熟词生义池（只算一次 ✓ 缓存在场景上 ✓）—— */
      if (!scene._sensePool && typeof Babel !== 'undefined' && Array.isArray(Babel.SENSE_WORDS)) {
        const byWord = {};
        Babel.SENSE_WORDS.forEach(function (e) {
          const en = String(e.en || '').trim();
          const zr = String(e.zhRare || '').trim();
          if (!en || !zr) return;
          if (zr.replace(/[；;…\s]/g, '').length > 10) return;      // 生义太长 ✗ 220px 放不下 ✓
          if (en.replace(/[^A-Za-z]/g, '').length > 12) return;      // 词太长 ✗
          (byWord[en] = byWord[en] || []).push(zr);
        });
        const keys = Object.keys(byWord);
        if (keys.length >= PAIRS) { scene._sensePool = { byWord: byWord, keys: keys }; }
      }
      const pool = scene._sensePool;
      if (pool) {
        /* ★ 一局之内**不重复用词** ✗✓（2026-09-21 用户要求 ✓）
         *   已用过的词记在 Babel.RunState.senseUsed ✓（每开一局自动清空 ✓✓）
         *   422 个词 ÷ 每题 3 个 ≈ 140 题 ✓ 一局根本用不完 ✓
         *   万一用尽 → 才重置该列表 ✓✓（保证永远有词可选 ✓ 不会卡住 ✓）*/
        const RS = (typeof Babel !== 'undefined' && Babel.RunState) ? Babel.RunState : null;
        if (RS && !Array.isArray(RS.senseUsed)) RS.senseUsed = [];
        let cand = RS ? pool.keys.filter(function (k) { return RS.senseUsed.indexOf(k) < 0; })
                      : pool.keys.slice();
        if (cand.length < PAIRS) { if (RS) RS.senseUsed = []; cand = pool.keys.slice(); }
        /* 洗牌 ✓ 取前 3 个**互不相同**的词 ✓✓ */
        const ks = cand.slice();
        for (let i = ks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = ks[i]; ks[i] = ks[j]; ks[j] = t;
        }
        for (let i = 0; i < PAIRS && i < ks.length; i++) {
          const en = ks[i];
          const arr = pool.byWord[en];
          const zr = arr[Math.floor(Math.random() * arr.length)];
          if (!pairs.some(function (p) { return p.en === en || p.zh === zr; })) {
            pairs.push({ en: en, zh: zr });
            if (RS && RS.senseUsed.indexOf(en) < 0) RS.senseUsed.push(en);   // ★ 记进本局已用 ✓
          }
        }
      }
      /* —— 兜底：词库缺失 / 池子不够 → 沿用原逻辑 ✓ —— */
      if (pairs.length < PAIRS) {
        const curEn = (scene.wordText && scene.wordText.text) ? String(scene.wordText.text) : '';
        const curZh = (ci >= 0 && shown[ci] != null) ? String(shown[ci]) : '';
        if (curEn && curZh && !pairs.some(function (p) { return p.en === curEn; })) pairs.push({ en: curEn, zh: curZh });
        for (let k = 0; pairs.length < PAIRS && k < 20; k++) {
          try {
            const w = Babel.WORDBANK.draw(Babel.RunState.floor, scene._wordDifficulty);
            if (!w || !w.en) continue;
            const zh = w.options[w.correctIndex];
            if (!zh) continue;
            if (pairs.some(function (p) { return p.en === w.en || p.zh === zh; })) continue;
            pairs.push({ en: w.en, zh: zh });
          } catch (e) { break; }
        }
      }
      while (pairs.length < PAIRS) pairs.push({ en: '—', zh: '—' });
      st.pairs = pairs;
      /* ★★★ 本局总结的记账快照 ✗✗（2026-09-26 修"圣徒的结算不对"）
       *   用户报：总结里出现
       *     `fever 发烧；发热 | 你的作答 代表；利益 | 第3层·圣徒·四选一`
       *   —— 三样看着都对，**拼在一行就矛盾** ✓
       *   病因：连线阶段的题面是**本皮肤自己从「熟词生义」词库抽的 3 对词** ✗
       *     （见上面 `scene._sensePool` 那一段 ✓ 与玩家真正在答的那道题**无关** ✓）
       *     而 `RunState.logAnswer` 读的是 `scene.wordText.text` / `scene._shown` ✓
       *     → `en`/`zh` 取到的是**顶部那道四选一题**（fever / 发烧；发热 ✓）
       *       `your` 取到的是 `_shown[index]` ＝ **玩家点的那个选项**（behalf 的释义 ✓）
       *       两者本来就不该配对 ✗ 于是日志自相矛盾 ✓
       *   ★ 修法：**在连线接管题面之前**把"玩家真正看到的那道题"写成快照 ✓
       *     挂 `scene._saintLog` ✓ 由 `RunState.logAnswer` 优先读取 ✓
       *     （与奎隆火阶段的 `_fireLog` 同一套路 ✓ 见 quilon.js `_writeFireLog` ✓）
       *   ★ 位置：放在**兜底之后** ✗ —— 这样词库缺失时也能拿到正确的当前词 ✓ */
      {
        const _curEn = (scene.wordText && scene.wordText.text) ? String(scene.wordText.text) : '';
        const _ci = (typeof scene.correctIndex === 'number') ? scene.correctIndex : -1;
        const _sh = scene._shown || [];
        const _curZh = (_ci >= 0 && _sh[_ci] != null) ? String(_sh[_ci]) : '';
        if (_curEn || _curZh) {
          scene._saintLog = {
            en: _curEn,
            zh: _curZh,
            shown: _sh.slice(),
            correct: _curZh,
          };
        }
      }
      /* ② 隐藏原选项 UI ＋ 本皮肤画在选项上的装饰 */
      (scene.optionButtons || []).forEach(function (b) { try { if (b.setVisible) b.setVisible(false); } catch (e) {} });
      /* ★ 连线阶段要把"答案"藏起来（2026-09-21 用户要求 ✓）
       *   顶上那个大字英文词＝直接写着答案 ✗ 提示与卡片细线也不该出现 ✓ */
      try { if (scene.wordText) scene.wordText.setVisible(false); } catch (e) {}
      try { if (scene._answerHint) scene._answerHint.setVisible(false); } catch (e) {}
      try { if (scene._cardRule) scene._cardRule.setVisible(false); } catch (e) {}
      try { if (scene._cardBotRule) scene._cardBotRule.setVisible(false); } catch (e) {}
      try { if (scene.card) scene.card.setVisible(false); } catch (e) {}
      (scene._saintBtns || []).forEach(function (b) {
        try { if (b.g) b.g.setVisible(false); if (b.idt) b.idt.setVisible(false); if (b.paper) b.paper.setVisible(false); } catch (e) {}
      });
      /* ③ 建节点：左＝英文词 ✓ 右＝中文释义**打乱** ✓ 每个都漂浮 ✓ */
      const mk = function (side, text, key, x, y, isEn, phase) {
        const c = scene.add.container(x, y).setDepth(20);
        const bg = scene.add.rectangle(0, 0, W, H, 0xffffff, 0.5).setStrokeStyle(Math.max(1, Math.round(1 * s)), 0x54686a);
        const t = scene.add.text(0, 0, text, {
          fontFamily: isEn ? Babel.FONTS.mono : Babel.FONTS.body,
          fontSize: Math.round((isEn ? 34 : 17) * s) + 'px', color: '#12232e',   // ★ 220 宽下更从容 ✓
        }).setOrigin(0.5, 0.5);
        c.add([bg, t]);
        scene.tweens.add({ targets: c, y: y + 12 * s, duration: 2100 + phase * 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const nd = { c: c, bg: bg, side: side, pair: key, done: false };
        st.nodes.push(nd);
        return nd;
      };
      const cx = scene.scale.width / 2;
      const cyMid = scene.scale.height / 2;
      /* ★ 两栏居中（2026-09-21 用户要求 ✓）：左 cx−240 ✓ 右 cx+240 ✓
       *   220 宽 → 左占 290~510 ✓ 右占 770~990 ✓ 完全落在中间区 286~994 内 ✓ 不压两侧图版 ✓
       *   ★ 两栏都**垂直居中** ✓ 右栏二阶段多一个（4 行）时行距自动收窄 ✓✓ */
      const lx = cx - 240 * s, rx = cx + 240 * s;
      const dyL = 130 * s, dyR = _extra ? 104 * s : 130 * s;
      const y0L = cyMid - dyL;                                  // 左 3 行 → 中心对齐 ✓
      const y0R = cyMid - (_extra ? 1.5 * dyR : dyR);            // 右 3 行 / 4 行 ✓ 都居中 ✓
      pairs.forEach(function (p, i) { mk('L', p.en, p.en, lx, y0L + i * dyL, true, i); });
      /* ★ 打乱右栏 ✓ 但**要避免"答案正好在对门"** ✗✓（2026-09-21 用户要求）
       *   若 shuffled[i] 与 pairs[i] 是同一对 ✓ 那这一对就是一条水平线 ✓ 太顺 ✗
       *   → 重新打乱 ✓（最多 30 次 ✓ 试不出来就接受 ✓ 绝不死循环 ✓）
       *   → 结果是每一对都**斜着连** ✓✓ 手真的要动 ✓ */
      let shuffled = null;
      for (let tryN = 0; tryN < 30; tryN++) {
        const cand = pairs.slice().sort(function () { return Math.random() - 0.5; });
        let faceOn = 0;
        for (let i = 0; i < cand.length; i++) { if (cand[i].en === pairs[i].en) faceOn++; }
        shuffled = cand;
        if (faceOn === 0) break;
      }
      shuffled.forEach(function (p, i) { mk('R', p.zh, p.en, rx, y0R + i * dyR, false, i); });
      /* ★★ 二阶段：右栏**多一个干扰项** ✗✓（2026-09-21 用户定 ✓）
       *   来源：**别的词**的一个生义 ✓（不是熟义 ✗ 不是陷阱 ✗）
       *   它不对应左栏任何词 ✓ → 玩家连上去就是"配对不符" ✓ 自然算连错 ✓（连线逻辑一行没改 ✓✓）*/
      if (_extra && pool) {
        for (let k = 0; k < 24; k++) {
          const en2 = pool.keys[Math.floor(Math.random() * pool.keys.length)];
          if (pairs.some(function (p) { return p.en === en2; })) continue;          // 不能是本题的词 ✓
          const arr2 = pool.byWord[en2] || [];
          const zr2 = arr2[Math.floor(Math.random() * arr2.length)];
          if (!zr2) continue;
          if (pairs.some(function (p) { return p.zh === zr2; })) continue;          // 不能和已有释义重复 ✓
          mk('R', zr2, '__extra__', rx, y0R + PAIRS * dyR, false, PAIRS);           // 第 4 个 ✓
          break;
        }
      }
      /* ④ 折线（一个 Graphics 逐段画 ✓）*/
      st.g = scene.add.graphics().setDepth(19);
      const nodeAt = function (px, py) {
        /* ★ 判定＝**整个方框** ✓✓（2026-09-21 用户要求）
         *   原来用"距中心 60px 的圆" ✗ → 只有中心附近点得到 ✓ 框的四角与边缘都点不中 ✗✓
         *   现在：|dx| ≤ W/2 且 |dy| ≤ H/2 ✓ → **框内任意位置都算点到** ✓✓
         *   （起始点与终点同一套判定 ✓ 点到框就开始连 ✓）
         *   ★ 但**线仍然画在中心之间** ✓✓（redraw 用的是 nd.c.x/.c.y ✓ 视觉一点没变 ✓）*/
        for (let i = 0; i < st.nodes.length; i++) {
          const nd = st.nodes[i];
          if (Math.abs(px - nd.c.x) <= W / 2 && Math.abs(py - nd.c.y) <= H / 2) return nd;
        }
        return null;
      };
      const segOf = function (nd) {
        for (let i = 0; i < st.segs.length; i++) { if (st.segs[i].a === nd || st.segs[i].b === nd) return st.segs[i]; }
        return null;
      };
      /* ======================================================================
       * ★★ 三阶段「反向连线」（2026-09-21 用户设计 ＋ 全部规格照用户 ✓）
       *   · 点左栏一个**熟词** ＝ 起点 ✓ —— 伸手就是承诺 ✓ 这一下就开始赛跑 ✓
       *   · 同一瞬间：它从**离你最近的错误释义**派一根红线**反向冲过来** ✗
       *     两条线朝同一个词相向而行 ✓
       *   · 你先点到那个词**正确的生义** → 它的线当场**粒子化碎裂** ✓✓
       *   · 它先碰到词 → 那个词炸红 ＋ 留疤 → **你掉血 ＋ 直接下一题** ✓
       *   · 点错释义 ＝ 照本皮肤既有规则：**连错扣血 ＋ 直接下一题** ✓（用户定 ✓）
       *   · 不点也有压力：**每 4 秒**它主动派一根 ✓ 同时在飞最多 **2 根** ✓
       *   ★ 版面沿用二阶段：左 3 熟词 / 右 4 释义（3 对 ＋ 1 干扰）✓ 一行没改 ✓
       *   ★ 只有三阶段走这条分支 ✓ 一/二阶段的既有连线一个字节都不变 ✓✓
       *   ★ 红线 ＝ **3px 实线**（不是一直断的 ✗）＋ 每 700ms 故障 180ms 青红色散 ✓
       *     —— 与"留疤"同一套视觉语言 ✓ 纯 Graphics ✓ 零新素材 ✓
       * ==================================================================== */
      const REV_EVERY = 4000, REV_MAX = 2, REV_GL_MS = 700, REV_GL_ON = 180;
      /* ★ 飞行速度：箭头（＝爪子）从源头飞到词要多久 ✓
       *   ★ 2026-09-23 用户："三阶段箭头减慢20%" ✓ → **4500 → 5400ms** ✓（×1.2 ✓ 多给 20% 反应时间 ✓）
       *   ★ 消散时长（REV_DIS_MS）**不跟着改** ✗ —— 那是"被吃掉"的速度 ✓ 用户单独定过 820 ✓ */
      const REV_FLY = 5400;
      /* ★★ 消散（2026-09-23 用户定稿 ✓）
       *   · **连对一对 → 只消散一根** ✓（不会两根一起散 ✗）
       *   · 消散的是**最快要造成伤害的那根** ✓✓ —— 即"已经在飞的所有线里 p 最大的那根" ✓
       *     （不是"你刚答对的那一对的线" ✗ —— 用户明确：最快要造成伤害的 ✓）
       *   · 方式：**从箭头开始被粒子吃掉** ✓ 前沿（＝箭头那一点）往源头退 ✓ 退到哪吐粒子到哪 ✓
       *     箭头本体在头 REV_DIS_ACC 内先没 ✓ 前沿那一小段提亮加粗 ✓
       *   ★★ 2026-09-23 二次定稿（用户看图后）：
       *     · **蓝色特效（碎玻璃 ＋ flash）全部删掉** ✗✓ —— "这个蓝色的特效就不用了，仅保留粒子消散" ✓
       *       → 现在这一记**只有粒子** ✓ 连箭头处那一下"爆点"也改成同一套粒子 ✓
       *         （原来那 10 个方块是 rectangle ＋ tween ✗ 现在直接塞进 st.rev.parts ✓ 一套系统 ✓ 零对象 ✓）
       *     · 再放慢 ✓ 560 → **820ms** ✓（"消散再慢一些" ✓）箭头 120 → 150ms ✓ */
      const REV_DIS_MS = 820;      // 一根从箭头吃到源头（比上一版再慢 ✓）
      const REV_DIS_ACC = 150;     // 箭头本体先没掉的时间
      const REV_EMIT = 190;        // 每秒吐多少粒子（按 dt 累计 ✓ 不按帧 ✓）
      /* ★★ 两根线**至少隔 2 秒** ✓✓（2026-09-23 用户要求 ✓
       *   "不要出现两根线出现的间隔过短的情况，不然完全反应不过来（至少要隔 2s）" ✓）
       *   做法：全局最小间隔 REV_MIN_GAP ＋ 一个"待派"槽位 st.rev.pend ✓
       *     · 任何一次派线请求（点词触发 / 每 4 秒自动）若离**上一次真的派出**不到 2 秒 ✗
       *       → **不丢弃** ✓ 记进 pend ✓ 到点自动补派 ✓（玩家点的那一下依旧有效 ✓ 只是稍后到 ✓）
       *     · 所以任何两根线的出现时间差**永远 ≥ 2 秒** ✓✓ */
      const REV_MIN_GAP = 2000;
      st.rev = _rev ? { air: [], parts: [], since: 0, word: null, ptr: null, lastSpawn: -1e9, pend: null } : null;
      /* 可见的线 = 从源头到"前沿" ✓ 前沿的路径比例 = p ×(1−dis) ✓ */
      const revFront = function (L) { return L.p * (1 - L.dis); };
      /* 故障态：**每 700ms 抖 180ms** ✓ 纯算出来 ✓ 不加定时器 ✓ */
      const revGlitch = function () { return (scene.time.now % REV_GL_MS) < REV_GL_ON; };
      /* 离**你点的那个节点**最近的**错误**节点（★ 2026-09-21 改成**对侧** ✓ 不再写死右栏 ✗）
       *   · 你点左栏的词 → 它从最近的错误**释义**冲过来 ✓（原来就是这条 ✓）
       *   · 你点右栏的释义 → 它从最近的错误**词**冲过来 ✓（用户原话：对面一个错误的词反向过来 ✓）
       *   排除：同一对 ✗（那是正确答案 ✓）／已连对的 ✗ */
      const revWrongNear = function (nd) {
        let best = null, bd = 1e9;
        st.nodes.forEach(function (n) {
          if (n.side === nd.side || n.done) return;
          if (n.pair === nd.pair) return;
          const d = Math.hypot(n.c.x - nd.c.x, n.c.y - nd.c.y);
          if (d < bd) { bd = d; best = n; }
        });
        return best;
      };
      /* 真的派一根（**不管间隔** —— 间隔检查在 revSpawn 里 ✓ 这里只负责建 ✓）*/
      const revPush = function (nd) {
        const w = revWrongNear(nd);
        if (!w) return false;
        st.rev.lastSpawn = scene.time.now;
        st.rev.air.push({ src: w, word: nd, pair: nd.pair, p: 0, dis: 0, dying: false, acc: 0 });
        return true;
      };
      const revSpawn = function (nd) {
        if (!st.rev || st.settled || nd.done) return;
        if (st.rev.air.length >= REV_MAX) return;                                    // ★ 最多 2 根 ✓
        if (st.rev.air.some(function (L) { return L.pair === nd.pair; })) return;     // 同一对只飞一根 ✓
        /* ★ 离上一根不到 2 秒 → **排队**（不硬塞 ✗ 也不丢弃 ✓）*/
        if (scene.time.now - st.rev.lastSpawn < REV_MIN_GAP) {
          st.rev.pend = { node: nd, at: st.rev.lastSpawn + REV_MIN_GAP };
          return;
        }
        revPush(nd);
      };
      /* ★ 起手 / 换起点（左词右释义都行 ✓ 2026-09-21 修 ✓）
       *   · 高亮它（3px 框 ＋ 亮底 ✓）· `st.cur` 设上 → redraw 会画**你自己那条线** ✓
       *   · 立刻 `revSpawn` → 它当场从这个新起点的"最近错误"冲过来 ✓✓ */
      const revTake = function (nd, p) {
        st.rev.word = nd;
        st.cur = nd;
        if (p) st.rev.ptr = { x: p.x, y: p.y };
        st.nodes.forEach(function (n) {
          if (n.done) return;
          const on = (n === nd);
          try { n.bg.setFillStyle(0xffffff, on ? 0.72 : 0.5); } catch (e) {}
          try { n.bg.setStrokeStyle(Math.max(on ? 3 : 1, Math.round((on ? 3 : 1) * s)), 0x54686a); } catch (e) {}
        });
        revSpawn(nd);
        redraw(p ? p.x : null, p ? p.y : null);
      };
      /* 放掉起手（再点同一个 / 收笔 ✓）*/
      const revDrop = function () {
        st.rev.word = null;
        st.cur = null;
        st.nodes.forEach(function (n) {
          if (n.done) return;
          try { n.bg.setFillStyle(0xffffff, 0.5); } catch (e) {}
          try { n.bg.setStrokeStyle(Math.max(1, Math.round(1 * s)), 0x54686a); } catch (e) {}
        });
        redraw(null);
      };
      /* ★★ 连对一对 → **只消散一根** ＝ 最快要造成伤害的那根（p 最大 ✓ 用户 2026-09-23 定 ✓）
       *   返回被点中的那根（调用方拿它算"箭头现在在哪" ✓ 在那儿放碎玻璃与小闪 ✓）*/
      const revDie = function () {
        if (!st.rev) return null;
        const live = st.rev.air.filter(function (L) { return !L.dying; });
        if (!live.length) return null;
        live.sort(function (a, b) { return b.p - a.p; });          // ★ 最快要造成伤害的 ✓
        const L = live[0];
        L.dying = true; L.dis = 0; L.acc = 0;
        return L;
      };
      /* 从前沿吐粒子（主要朝**源头方向**退 ✓ 掺约 2 成青光 ✓ 与红线故障同一套语言 ✓）*/
      const revEmit = function (L, dts) {
        const a = L.src.c, b = L.word.c;
        const t = revFront(L);
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        L.acc = (L.acc || 0) + REV_EMIT * dts;
        while (L.acc >= 1) {
          L.acc -= 1;
          const sp = (40 + Math.random() * 190) * s;
          st.rev.parts.push({
            x: x + (Math.random() - .5) * 7 * s, y: y + (Math.random() - .5) * 7 * s,
            vx: -ux * sp + (Math.random() - .5) * 130 * s,
            vy: -uy * sp + (Math.random() - .5) * 130 * s - 30 * s,
            life: .28 + Math.random() * .45, size: (2 + Math.random() * 5) * s,
            cy: Math.random() < .22,
          });
        }
        if (st.rev.parts.length > 260) st.rev.parts.splice(0, st.rev.parts.length - 260);
      };
      /* 白跑一趟的小白烟（它飞到**你已经拿下**的词上 ✓ 不扣血 ✗ 不换题 ✗）*/
      const revPuff = function (x, y) {
        for (let i = 0; i < 8; i++) {
          const a2 = Math.random() * Math.PI * 2, sp = (50 + Math.random() * 150) * s;
          st.rev.parts.push({ x: x, y: y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 20 * s,
                              life: .25 + Math.random() * .3, size: (2 + Math.random() * 4) * s, cy: Math.random() < .3 });
        }
      };
      /* ★ 箭头处的一记"起爆"粒子 ✓（2026-09-23 改：不再用碎玻璃/flash ✗ 只有粒子 ✓）
       *   全部塞进同一个粒子数组 ✓ → 画面语言统一 ✓ 零对象 ✓ 零 tween ✓ */
      const revSpray = function (x, y, n) {
        if (!st.rev) return;
        for (let i = 0; i < n; i++) {
          const a2 = Math.random() * Math.PI * 2, sp = (90 + Math.random() * 300) * s;
          st.rev.parts.push({ x: x, y: y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 40 * s,
                              life: .3 + Math.random() * .45, size: (2.5 + Math.random() * 5) * s, cy: Math.random() < .25 });
        }
        if (st.rev.parts.length > 260) st.rev.parts.splice(0, st.rev.parts.length - 260);
      };
      /* ★ 它先到 → 那个节点炸红 ＋ 留疤 ＋ 鸽群收拢 ＋ 碎玻璃 ＋ 掉血 ＋ 直接下一题 ✓ */
      const revArrive = function (L) {
        st.rev.air = st.rev.air.filter(function (x) { return x !== L; });
        try { L.word.bg.setFillStyle(0xe2231a, 0.25); } catch (e) {}
        try { L.word.bg.setStrokeStyle(Math.max(3, Math.round(3 * s)), 0xe2231a); } catch (e) {}
        try { const tx = L.word.c.list && L.word.c.list[1]; if (tx && tx.setColor) tx.setColor('#8d1a14'); } catch (e) {}
        Saint._scarAdd(scene, L.src.c.x, L.src.c.y, L.word.c.x, L.word.c.y);   // 又是一道疤 ✓
        const mcx = scene.scale.width / 2, mcy = scene.scale.height / 2;
        try { Saint._doves(scene, mcx, mcy, 'in'); } catch (e) {}
        try { Saint._glass(scene, mcx, mcy); } catch (e) {}
        try { if (scene.feedback && scene.feedback.setText) scene.feedback.setText('被它连上了！').setColor('#e2231a'); } catch (e) {}
        st.cur = null;                                            // 你自己那条线也收掉 ✓
        redraw(null);
        if (st.settled) return;
        st.settled = true;
        const widx = ((typeof ci === 'number' && ci >= 0) ? (ci + 1) : 0) % 4;
        /* ★ 记账：连错时 widx 是故意的错下标 ✗ 记它才是玩家真选了哪个 */
        try { Saint._writeSaintLog(scene, (shown && widx >= 0 && shown[widx] != null) ? String(shown[widx]) : "（超时）"); } catch (e) {}
        setTimeout(function () { try { scene._onAnswer(widx); } catch (e) {} }, 700);
      };
      /* 画在飞的红线（红 3px 实线 ＋ 故障时青红法向色散 ＋ 小红箭头 ✓）
       * ★ 2026-09-23：消散时**前沿往源头退** ✓ 箭头跟着退并先没 ✓ 前沿一小段提亮 ✓ */
      const revDraw = function (glitch) {
        if (!st.rev) return;
        const LW = Math.max(3, Math.round(3 * s));
        st.rev.air.forEach(function (L) {
          const a = L.src.c, b = L.word.c;
          const t = revFront(L);
          const hx = a.x + (b.x - a.x) * t, hy = a.y + (b.y - a.y) * t;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
          if (t > 0.002) {
            if (glitch && !L.dying) {                       // 消逝中不再抖 ✗ 专心被吃掉 ✓
              st.g.lineStyle(Math.max(1, Math.round(2 * s)), 0x3ce0e0, 0.45);
              st.g.lineBetween(a.x + nx * 3 * s, a.y + ny * 3 * s, hx + nx * 3 * s, hy + ny * 3 * s);
              st.g.lineStyle(Math.max(1, Math.round(2 * s)), 0xe2231a, 0.55);
              st.g.lineBetween(a.x - nx * 3 * s, a.y - ny * 3 * s, hx - nx * 3 * s, hy - ny * 3 * s);
            }
            st.g.lineStyle(LW, 0xe2231a, 1);
            st.g.lineBetween(a.x, a.y, hx, hy);
            if (L.dying) {
              const seg10 = Math.min(42 * s, len * t);
              const fx0 = hx - ux * seg10, fy0 = hy - uy * seg10;
              st.g.lineStyle(Math.max(5, Math.round(5 * s)), 0xff7a5a, 0.95);
              st.g.lineBetween(fx0, fy0, hx, hy);
              st.g.lineStyle(Math.max(2, Math.round(2 * s)), 0xfff2ee, Math.min(1, L.dis * 4));
              st.g.lineBetween(fx0, fy0, hx, hy);
            }
          }
          /* 箭头：跟着前沿退 ✓ 且在头 REV_DIS_ACC 内先没 ✓（＝"从箭头开始"消散 ✓）*/
          const gone = L.dying ? Math.min(1, (L.dis * REV_DIS_MS) / REV_DIS_ACC) : 0;
          if (gone < 0.98 && t > 0.02) {
            const ah = 15 * s * (1 - 0.45 * gone);
            st.g.fillStyle(0xe2231a, 1 - gone);
            st.g.fillTriangle(hx + ux * 2 * s, hy + uy * 2 * s,
              hx - ux * ah + nx * ah * 0.62, hy - uy * ah + ny * ah * 0.62,
              hx - ux * ah - nx * ah * 0.62, hy - uy * ah - ny * ah * 0.62);
          }
        });
        /* 粒子（同一支 Graphics ✓ 每帧重画 ✓）*/
        st.rev.parts.forEach(function (q) {
          st.g.fillStyle(q.cy ? 0x3ce0e0 : 0xe2231a, Math.max(0, Math.min(1, q.life * 2.6)));
          st.g.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
        });
      };
      /* 每帧推进（**只有三阶段注册** ✓ 走 events.update ✓ 与项目既有做法一致 ✓）*/
      let revPrev = 0;
      const revTick = function () {
        if (!st.rev || st.settled) return;
        if (scene._saintLink !== st) return;                    // ★ 场景复用防残留 ✓
        const t = scene.time.now;
        const dt = revPrev ? Math.min(t - revPrev, 60) : 16;
        revPrev = t;
        st.rev.since += dt;
        /* ★ 先补派"排队中"的那一根 ✓（到点了才真的出现 ✓ 保证与上一根隔 ≥2 秒 ✓）*/
        if (st.rev.pend && t >= st.rev.pend.at) {
          const pd = st.rev.pend;
          st.rev.pend = null;
          if (pd.node && !pd.node.done && st.rev.air.length < REV_MAX) revPush(pd.node);
        }
        if (st.rev.since >= REV_EVERY) {                        // ★ 每 4 秒它主动派一根 ✓
          st.rev.since = 0;
          /* ★ 只从**还没被盯上**的词里挑 ✗✓（2026-09-21 修 ✓）
           *   原来从"所有没连对的词"里随机挑 ✓ → 有 1/3 概率挑到**已经有线在飞**的那个 ✗
           *   → revSpawn 直接 return ✓ 这一拍的 4 秒就白等了 ✗✓（测试实测到 ✓）
           *   现在：先把"已被盯上"的排除掉 ✓ 保证**只要还有自由词就一定派得出来** ✓✓ */
          const free = st.nodes.filter(function (n) {
            if (n.side !== 'L' || n.done) return false;
            return !st.rev.air.some(function (L) { return L.pair === n.pair; });
          });
          if (free.length) revSpawn(free[Math.floor(Math.random() * free.length)]);
        }
        for (let i = st.rev.air.length - 1; i >= 0; i--) {
          const L = st.rev.air[i];
          /* ★ 正在消散 → 原地被吃掉 ✓ 不再往前飞 ✓ 也不判到达 ✓ */
          if (L.dying) {
            L.dis = Math.min(1, L.dis + dt / REV_DIS_MS);
            revEmit(L, dt / 1000);
            if (L.dis >= 1) st.rev.air.splice(i, 1);
            continue;
          }
          L.p += dt / REV_FLY;
          if (L.p >= 1) {
            /* ★ 它飞到的是**你已经拿下**的词 → 白跑一趟 ✓（不扣血 ✗ 不换题 ✗）
             *   为什么会有这种情况：连对时消散的是"最快要造成伤害的那根" ✓
             *   → 你自己那一对的线可能还在飞 ✓ 而那个词已经 done ✓（用户 2026-09-23 口径 ✓）*/
            if (L.word.done) {
              revPuff(L.word.c.x, L.word.c.y);
              st.rev.air.splice(i, 1);
              continue;
            }
            revArrive(L); return;                                 // ★ 它先到 ✓
          }
        }
        /* 粒子积分（ms → s ✓ 微量阻尼 ✓ 轻微下坠 ✓）*/
        for (let k = st.rev.parts.length - 1; k >= 0; k--) {
          const q = st.rev.parts[k];
          q.life -= dt / 1000;
          q.x += q.vx * dt / 1000; q.y += q.vy * dt / 1000;
          q.vy += 330 * s * dt / 1000;
          q.vx *= (1 - 1.6 * dt / 1000);
          if (q.life <= 0) st.rev.parts.splice(k, 1);
        }
        /* ★★ 每帧重画时**必须把光标位置带上** ✗✓（2026-09-21 修 ✓ 用户："我自己无法连线了" ✓）
         *   原因：这一行原来写的是 `redraw(null)` ✗
         *   → 每帧都把**你自己那条跟光标的线**擦掉 ✗ → 画面上只剩它那条红线 ✓✓
         *   → 玩家就"没有线可拉"了 ✗（三阶段本来是**两边都在连** ✓ 谁先到谁赢 ✓）
         *   现在：光标位置存在 st.rev.ptr 里 ✓ 每帧带着它重画 ✓ 你的线一直都在 ✓*/
        const q = st.rev.ptr;
        redraw(st.cur && q ? q.x : null, st.cur && q ? q.y : null);
      };
      const redraw = function (mx, my) {
        st.g.clear();
        /* ★ 线色（2026-09-21 修 ✗）：白线在冰白底上看不见 ✓
         *   已连成 ＝ 深青灰 **3px** ✓（一眼看清）／ 正在拖 ＝ 深青灰 2px alpha .55 ✓（虚一点）*/
        st.segs.forEach(function (sg) {
          st.g.lineStyle(Math.max(3, Math.round(3 * s)), sg.bad ? 0xe2231a : 0x54686a, 1);
          st.g.lineBetween(sg.a.c.x, sg.a.c.y, sg.b.c.x, sg.b.c.y);
        });
        if (st.cur && mx != null) {
          /* ★ 三阶段把"你自己那条线"画**实一点** ✓（2026-09-21 用户实测后补 ✓）
           *   原因：它的线是 3px 实红 ✓ 你的线原来是 2px alpha .55（一/二阶段的"正在拖"口径 ✓）
           *   → 两条线放一起，**你的那条显得像没画** ✗ 而这一阶段本来就是"两边对着连" ✓
           *   ★ 只对 _rev 生效 ✓ 一/二阶段的观感一个像素都没变 ✓✓ */
          st.g.lineStyle(Math.max(_rev ? 3 : 2, Math.round((_rev ? 3 : 2) * s)),
                         _rev ? 0x2f4a4c : 0x54686a, _rev ? 0.85 : 0.55);
          st.g.lineBetween(st.cur.c.x, st.cur.c.y, mx, my);
        }
        /* ★ 三阶段：它的线也画在同一个 Graphics 上 ✓（一/二阶段 st.rev 为 null → 这里直接返回 ✓）*/
        if (st.rev) revDraw(revGlitch());
      };
      const settle = function () {
        if (st.settled) return;
        st.settled = true;
        const bad = st.segs.some(function (sg) { return sg.bad; });
        const idx = bad ? ((ci + 1) % 4) : ci;
        /* ★★ 连对那一刻**当场就放鸽群** ✗✓（2026-09-21 用户：现在要等一会鸽子才飞 ✓）
         *   原来只调 _onAnswer ✓ 而它内部还有一段流程 ✓ → 鸽群姗姗来迟 ✓
         *   现在：先立刻炸 ✓ 再调 _onAnswer 走记账 ✓（onCorrect 里会防重 ✓ 不会炸两次 ✓）
         *   延迟 420 → **60ms** ✓ 只留一帧让最后那条线画出来 ✓ */
        if (!bad) {
          try { Saint._doves(scene, scene.scale.width / 2, scene.scale.height / 2, 'out', true); } catch (e) {}
          scene._saintBurstAt = Date.now();
        }
        /* ★★★ 记下"玩家**真正连上**的那 3 对" ✗✗（2026-09-30 用户：
         *   "我突然发现圣徒答对的题目也是和我做的题目毫无关联，是否是和之前答错的
         *    题目同一个问题" → **是同一个问题** ✓）
         *
         *   病因（与上次那张"错题自相矛盾"是**同根** ✓ 我上次只修了一半 ✗）：
         *     · 连线阶段屏幕上画的是 `st.pairs`（皮肤从 `SENSE_WORDS` 抽的 3 对熟词生义 ✓）
         *     · 而四选一那套 `wordText` / `_shown` **在连线段是隐藏的** ✗
         *       （见上面 L250-254：`wordText` / `card` / 选项装饰全被 setVisible(false) ✓）
         *     · 上次我把快照 `_saintLog.en` 指到 `wordText.text` ✗
         *       → 那是**玩家根本看不见的那道四选一题** ✓
         *       → 总结里就显示成"和他做的毫无关联" ✓（他看到的、连上的是另外 3 对 ✓）
         *   ⇒ 修法：**记玩家真正操作过的对象** ✗ 即已连成的那些段 ✓
         *     挂到 `_saintLog.linked` ✓ 由 `logAnswer` / 总结屏消费 ✓
         *   ★★ 口径（这轮第二次踩）：**"玩家答了什么"要以"屏幕上他看得见的东西"为准** ✗✗
         *     不能以"内部状态里恰好存着的那个变量"为准 ✓
         *     判据：**写下这个字段之前，问一句"玩家在这个阶段看得见它吗"** ✗
         *     看不见 → 它就不是"他的作答" ✓ 换一个 ✓
         *
         *   ★ 段的形状（已核对 ✓ 不是猜的）：
         *     `st.segs.push({ a: 节点, b: 节点, bad: bool })` ✓
         *     节点 ＝ `{ c, bg, side, pair, done }` ✓
         *     `pair` 存的**就是英文词** ✗ —— 左 `mk('L', p.en, p.en, …)` ✓
         *       右 `mk('R', p.zh, p.en, …)` ✓ 两侧同一个 key ✓
         *     ⇒ **`a.pair === b.pair` 即"连对了"** ✓（比只看 `bad` 更硬 ✓）
         *     干扰项 key ＝ `'__extra__'` ✓ 与任何词都不等 → 天然算错 ✓ */
        try {
          const linked = [];
          const byEn = {};
          for (let i = 0; i < pairs.length; i++) byEn[pairs[i].en] = pairs[i].zh;
          const segs = st.segs || [];
          for (let i = 0; i < segs.length; i++) {
            const sg = segs[i];
            if (!sg || sg.bad || !sg.a || !sg.b) continue;        // 连错的段不算 ✓
            const ka = String(sg.a.pair || ''), kb = String(sg.b.pair || '');
            if (!ka || ka !== kb || ka === '__extra__') continue;  // 两端 key 一致才算连对 ✓
            const zh = byEn[ka];
            if (zh) linked.push({ en: ka, zh: String(zh) });
          }
          if (linked.length && scene._saintLog) scene._saintLog.linked = linked;
        } catch (e) {}
        /* ★ 记账：先写玩家那一侧 ✗ 再交棒给 _onAnswer（它内部会 logAnswer）*/
        try { Saint._writeSaintLog(scene, (shown && ci >= 0 && shown[ci] != null) ? String(shown[ci]) : ""); } catch (e) {}
        setTimeout(function () { try { scene._onAnswer(idx); } catch (e) {} }, 60);
      };
      /* ★ 点击式连线（2026-09-21 用户要求 ✓ **不要强制长按** ✗✓）
       *   第一次点：选起点 ✓ 线开始跟着光标走 ✓（松手也不断 ✓）
       *   第二次点：若点到对面某一对 ✓ 成段 ✓ ／ 点到同一个 ＝ 取消 ✓ ／ 点到别的 ＝ 换起点 ✓ */
      st.onDown = function (p) {
        if (st.settled) return;
        const nd = nodeAt(p.x, p.y);
        if (!nd) return;
        /* ★★ 三阶段：点击式**反向连线**（不拖 ✗ 只点两下 ✓）
         *   ★★ 2026-09-21 修（用户："三阶段我自己无法连线了"）：
         *     ① **两边都能当起点** ✗✓ —— 原来只认左栏 ✗
         *        而一/二阶段是"点哪边都能起手" ✓（`if (!st.cur) st.cur = nd` ✓ 不分侧 ✓）
         *        → 玩惯了的人在右栏点一下**毫无反应** ✓ 当然就是"无法连线" ✓✓
         *     ② `st.cur` 必须设上 ✓ —— redraw 靠它画**你自己那条线** ✓（不设就没有自己的线 ✓）
         *     ③ 再点同一个 ＝ 取消 ✓ ／ 点同侧别的 ＝ 换起点 ✓（与一/二阶段完全同规则 ✓）*/
        if (_rev) {
          if (nd.done) return;
          /* 还没起手 → 起手（左词 / 右释义都行 ✓）*/
          if (!st.rev.word) { revTake(nd, p); return; }
          const w = st.rev.word;
          /* 再点同一个 ＝ 取消起手 ✓ */
          if (nd === w) { revDrop(); return; }
          /* 点同侧别的 ＝ 换起点 ✓（新起点也立刻派一根 ✓）*/
          if (nd.side === w.side) { revTake(nd, p); return; }
          /* 点对面：对上了 ＝ 抢到 ✓ ／ 对不上 ＝ 连错 ✓ */
          if (nd.pair === w.pair) {
            /* ★ 你先到 ✓ → 它的线**当场粒子化碎裂** ✓✓ */
            st.segs.push({ a: w, b: nd, bad: false });
            w.done = true; nd.done = true;
            try { w.bg.setFillStyle(0xffffff, 0.92); nd.bg.setFillStyle(0xffffff, 0.92); } catch (e) {}
            try { w.bg.setStrokeStyle(Math.max(3, Math.round(3 * s)), 0x54686a); } catch (e) {}
            try { nd.bg.setStrokeStyle(Math.max(3, Math.round(3 * s)), 0x54686a); } catch (e) {}
            const mx = (w.c.x + nd.c.x) / 2, my = (w.c.y + nd.c.y) / 2;
            /* ★★ 连对一对 → **只消散一根** ✗✓（2026-09-23 用户定稿 ✓）
             *   散的是**最快要造成伤害的那根**（在飞的所有线里 p 最大 ✓）—— 不一定是这一对的 ✓
             *   起爆粒子放在**那根的箭头处**（它现在在哪就在哪炸 ✓ 不再是"两格中点"✗）
             *   ★ 只有粒子 ✓ 没有碎玻璃 ✗ 没有 flash ✗（用户 2026-09-23："仅保留粒子消散" ✓）*/
            const died = revDie();
            if (died) {
              const da = died.src.c, db = died.word.c, dt2 = revFront(died);
              revSpray(da.x + (db.x - da.x) * dt2, da.y + (db.y - da.y) * dt2, 14);
            } else {
              revSpray(mx, my, 14);                            // 场上没有线在飞 → 就在成段处给一记 ✓
            }
            st.rev.word = null;
            st.cur = null;                                   // ★ 收笔：你自己的线定住成 3px 实线 ✓
            redraw(null);
            if (st.segs.length >= PAIRS && !st.segs.some(function (sg) { return sg.bad; })) settle();
          } else {
            /* ★ 点错 ＝ 照本皮肤既有规则：段变红断掉 ＋ 留疤 ＋ 扣血 ＋ 换下一组词 ✓ */
            st.segs.push({ a: w, b: nd, bad: true });
            try { w.bg.setFillStyle(0xe2231a, 0.25); nd.bg.setFillStyle(0xe2231a, 0.25); } catch (e) {}
            try { w.bg.setStrokeStyle(Math.max(3, Math.round(3 * s)), 0xe2231a); } catch (e) {}
            try { nd.bg.setStrokeStyle(Math.max(3, Math.round(3 * s)), 0xe2231a); } catch (e) {}
            Saint._scarAdd(scene, w.c.x, w.c.y, nd.c.x, nd.c.y);
            st.rev.word = null;
            st.cur = null;
            redraw(null);
            const mcx2 = scene.scale.width / 2, mcy2 = scene.scale.height / 2;
            try { Saint._doves(scene, mcx2, mcy2, 'in'); } catch (e) {}
            try { Saint._glass(scene, mcx2, mcy2); } catch (e) {}
            try { if (scene.feedback && scene.feedback.setText) scene.feedback.setText('连错了！').setColor('#e2231a'); } catch (e) {}
            if (!st.settled) {
              st.settled = true;
              const widx = ((typeof ci === 'number' && ci >= 0) ? (ci + 1) : 0) % 4;
              /* ★ 连错时 widx 是故意的错下标 ✗ 记它才是玩家真选了哪个 */
              try { Saint._writeSaintLog(scene, (shown && widx >= 0 && shown[widx] != null) ? String(shown[widx]) : "（超时）"); } catch (e) {}
              setTimeout(function () { try { scene._onAnswer(widx); } catch (e) {} }, 700);
            }
          }
          return;
        }
        if (nd.done) return;                       // 已连对的节点彻底失效 ✓
        if (!st.cur) { st.cur = nd; redraw(p.x, p.y); return; }   // 第一次点＝选起点 ✓
        if (nd === st.cur) { st.cur = null; redraw(null); return; }  // 再点同一个＝取消 ✓
        if (nd.side === st.cur.side) { st.cur = nd; redraw(p.x, p.y); return; } // 同侧＝换起点 ✓
        if (segOf(nd) || segOf(st.cur)) return;    // 已连过的不能再用 ✓
        if (nd.pair === st.cur.pair) {
          /* 连对 ✓ 定住 ＋ 收笔 ✓ */
          st.segs.push({ a: st.cur, b: nd, bad: false });
          st.cur.done = true; nd.done = true;
          st.cur.bg.setFillStyle(0xffffff, 0.92); nd.bg.setFillStyle(0xffffff, 0.92);
          try { st.cur.bg.setStrokeStyle(Math.max(3, Math.round(3 * s)), 0x54686a); } catch (e) {}
          try { nd.bg.setStrokeStyle(Math.max(3, Math.round(3 * s)), 0x54686a); } catch (e) {}
          st.cur = null; redraw(null);
          if (st.segs.length >= PAIRS && !st.segs.some(function (sg) { return sg.bad; })) settle();
        } else {
          /* 连错 ✓ 段变红断掉 ＋ 扣血 ＋ 换下一组词 ✓ */
          st.segs.push({ a: st.cur, b: nd, bad: true });
          st.cur.bg.setFillStyle(0xe2231a, 0.25); nd.bg.setFillStyle(0xe2231a, 0.25);
          const keep = st.cur;
          redraw(p.x, p.y);
          /* ★★ 二阶段「画面上留疤」（2026-09-21 用户要求 ✓）
           *   连错的红线**永久留在画面上** ✗ —— 不只是这一题 ✓ 后面的题里也看得见 ✓✓
           *   做法：画在一个 **场景级 Graphics** 上 ✓ 且**从不 clear** ✗✓
           *     → 每连错一次就往上加一段 ✓ 红线越积越多 ✓ 画面越来越脏 ✓✓（这就是"留疤" ✓）
           *   一阶段不画 ✓（有对比才显出二阶段在弄脏画面 ✓✓）
           *   ★ 2026-09-21 提成方法 Saint._scarAdd ✓ —— 三阶段的"连错 / 被它连上"也要用 ✓
           *     **搬了个家 ✓ 行为一个字节没变 ✓**（一/二阶段的观感与之前完全一致 ✓✓）*/
          if (_extra) Saint._scarAdd(scene, st.cur.c.x, st.cur.c.y, nd.c.x, nd.c.y);
          const mcx = scene.scale.width / 2, mcy = scene.scale.height / 2;
          try { Saint._doves(scene, mcx, mcy, 'in'); } catch (e) {}
          try { Saint._glass(scene, mcx, mcy); } catch (e) {}
          try { if (scene.feedback && scene.feedback.setText) scene.feedback.setText('连错了！').setColor('#e2231a'); } catch (e) {}
          if (!st.settled) {
            st.settled = true;
            const widx = ((typeof ci === 'number' && ci >= 0) ? (ci + 1) : 0) % 4;
            try { Saint._writeSaintLog(scene, (shown && widx >= 0 && shown[widx] != null) ? String(shown[widx]) : "（超时）"); } catch (e) {}
            setTimeout(function () { try { scene._onAnswer(widx); } catch (e) {} }, 700);
          }
          setTimeout(function () {
            const i2 = st.segs.findIndex(function (sg) { return sg.bad && sg.a === keep; });
            if (i2 >= 0) st.segs.splice(i2, 1);
            try { keep.bg.setFillStyle(0xffffff, 0.5); nd.bg.setFillStyle(0xffffff, 0.5); } catch (e) {}
            st.cur = null; redraw(null);
          }, 620);
        }
      };
      /* onMove 只负责"让线跟着光标" ✓（成段判定已挪到 onDown ✓ 点击式 ✓）*/
      st.onMove = function (p) {
        /* ★ 三阶段：**你自己那条线也要跟着光标走** ✗✓（2026-09-21 修 ✓ 用户："我自己无法连线了" ✓）
         *   原来这里直接 return ✗ → 玩家画面上没有自己的线 ✓
         *   现在：记住光标位置 ✓ 选了词就画线 ✓ 没选词就只记位置 ✓（红线依旧自己飞 ✓）*/
        if (_rev) {
          if (st.rev) st.rev.ptr = { x: p.x, y: p.y };
          if (st.cur && !st.settled) redraw(p.x, p.y);
          return;
        }
        if (!st.cur || st.settled) return;
        redraw(p.x, p.y);
      };;
      /* ★ 点击式：松手**不**清空当前节点 ✗✓（线要一直跟着光标 ✓）*/
      st.onUp = function () { /* 什么都不做 ✓ */ };
      scene.input.on('pointerdown', st.onDown);
      scene.input.on('pointermove', st.onMove);
      scene.input.on('pointerup', st.onUp);
      /* ★ 三阶段专属：每帧推进它的线 ✓（一/二阶段不注册 ✓ 零开销 ✓）
       *   存到 scene 上 ✓ 让 _linkClear 能**注销同一个函数** ✓（否则每题漏一个监听 ✓ 踩过 ✓）*/
      if (_rev) {
        scene._saintRevTick = revTick;
        scene.events.on('update', revTick);
        try {
          scene.events.once('shutdown', function () {
            try { scene.events.off('update', revTick); } catch (e) {}
          });
        } catch (e) {}
      }
    },
    _linkClear(scene) {
      const st = scene._saintLink;
      /* ★ 三阶段每帧监听先注销 ✓（**放在 st 判空之前** ✗✓ 否则上一题的 tick 会漏 ✓）*/
      if (scene._saintRevTick) {
        try { scene.events.off('update', scene._saintRevTick); } catch (e) {}
        scene._saintRevTick = null;
      }
      if (!st) return;
      try { scene.input.off('pointerdown', st.onDown); } catch (e) {}
      try { scene.input.off('pointermove', st.onMove); } catch (e) {}
      try { scene.input.off('pointerup', st.onUp); } catch (e) {}
      (st.nodes || []).forEach(function (nd) { try { nd.c.destroy(); } catch (e) {} });
      try { if (st.g) st.g.destroy(); } catch (e) {}
      scene._saintLink = null;
    },
    /* ==========================================================================
     * 答对演出：鸽群四散（2026-09-21 用户选定 ✓）
     *   · 起点 ＝ **答对那一格的中心**（optionButtons[index].x / .y ✓ 换题自动跟着走 ✓）
     *   · 12 只白鸽**每 30° 一只**沿直线往外飞 ✓（左半用左向图 ✓ 右半用右向图 ✓ 头朝飞行方向 ✓）
     *   · 起点一记闪光（flassh_3 ✓）＋ 9px 取点方块 ✓
     *   · 深度 6 ✓（高于立绘牌与选项 ✓ 低于全屏闪 ✓）
     *   · 缩放用**真实缩放** ✓（`scene._sc` 不存在 ✗ 用项目同款公式 ✓）
     *   · 全部 tween ✓ 结束后自毁 ✓ 并记入 scene._saintFx 供 clear 兜底清理 ✓
     * ======================================================================== */

    /* 碎玻璃炸开（2026-09-21 用户要求 ✓ 连错时用 ✓ 素材＝月行水上 glass ✓）
     *   7 片从圆心向外飞散 ＋ 旋转 ＋ 淡出 ✓ 全部真 PNG ＋ tween ✓ */
    _glass(scene, cx, cy) {
      const s = Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));
      scene._saintFx = scene._saintFx || [];
      const ANG = [200, 250, 300, 20, 70, 120, 160];
      for (let i = 0; i < 7; i++) {
        const key = 'skin-saint-glass-' + (1 + (i % 4));
        if (!scene.textures.exists(key)) break;
        const a = (ANG[i] / 180) * Math.PI;
        const d = (150 + (i % 3) * 55) * s;
        const sh = scene.add.image(cx, cy, key).setDepth(24).setAlpha(0).setDisplaySize(64 * s, 64 * s);
        scene._saintFx.push(sh);
        scene.tweens.add({
          targets: sh,
          x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
          angle: (i % 2 ? 90 : -90),
          scale: { from: 0.5, to: 1.15 },
          alpha: { from: 0, to: 1 },
          duration: 220, ease: 'Quad.easeOut',
        });
        scene.tweens.add({ targets: sh, alpha: 0, duration: 320, delay: 240, onComplete: function () { try { sh.destroy(); } catch (e) {} } });
      }
    },
    /* ==========================================================================
     * ★★ 三阶段的演出（2026-09-21 起 ／ 2026-09-23 二次定稿）
     *   ① 它的线**从箭头开始被粒子吃掉** ✓✓（用户点名的效果 ✓ 这一记**只有粒子** ✓）
     *        —— 不在方法里 ✗ 而是画在连线那支 Graphics 上 ✓
     *        （revDraw ＋ revEmit ＋ revTick ✓ 一套粒子系统 st.rev.parts ✓ 零对象零 tween ✓）
     *        ★ 2026-09-23：**蓝色特效（碎玻璃 skin-saint-glass ＋ skin-saint-flash）全部删掉** ✗✓
     *          用户看图后："这个蓝色的特效就不用了，仅保留粒子消散" ✓
     *          → 原来那个 `_arrowBurst`（10 方块 ＋ 3 玻璃 ＋ flash）**整个方法已删除** ✗
     *          → 起爆改成 `revSpray` ✓ 直接塞进同一个粒子数组 ✓（视觉语言完全一致 ✓）
     *   ② _scarAdd(scene, ax, ay, bx, by) —— 「留疤」的**唯一实现** ✓
     *        一/二阶段（连错）与三阶段（连错 / 被它连上）**共用这一份** ✓✓
     *        （连错那条路径仍然用 _glass ✓ —— 那是"答错"的既有演出 ✓ 不在这次删的范围内 ✓）
     * ======================================================================== */
    /* 建疤痕层（每题都会调 ✓ 但**只建一次** ✓ addEvent 也只加一次 ✓）*/
    _scarInit(scene) {
      if (scene._saintScarG && scene._saintScarG.active !== false && scene._saintScarDraw) return;
      const s = Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));
      scene._saintScarG = scene.add.graphics().setDepth(18);
      scene._saintScars = [];
      /* 画疤痕：glitch＝true 时画故障态 ✓ false 时画实线 ✓ */
      scene._saintScarDraw = function (glitch) {
        const g = scene._saintScarG;
        if (!g || !scene._saintScars) return;
        g.clear();
        scene._saintScars.forEach(function (sc) {
          const dx = sc.bx - sc.ax, dy = sc.by - sc.ay;
          if (!glitch) {
            /* 基础态：干净实线 ✓ */
            g.lineStyle(Math.max(3, Math.round(3 * s)), 0xe2231a, 0.55);
            g.lineBetween(sc.ax, sc.ay, sc.bx, sc.by);
            return;
          }
          /* 故障态：切 9 段 ✓ 35% 断开 ✓ 每段错位 ✓ 青红双色 ✓ */
          const N = 9;
          for (let i = 0; i < N; i++) {
            if (Math.random() < 0.35) continue;
            const t0 = i / N, t1 = (i + 1) / N;
            const jx = (Math.random() * 6 - 3) * s, jy = (Math.random() * 4 - 2) * s;
            g.lineStyle(Math.max(1, Math.round((1 + Math.random() * 3) * s)), 0x3ce0e0, 0.42);
            g.lineBetween(sc.ax + dx * t0 + jx + 2 * s, sc.ay + dy * t0 + jy - 1 * s,
                          sc.ax + dx * t1 + jx + 2 * s, sc.ay + dy * t1 + jy - 1 * s);
            g.lineStyle(Math.max(1, Math.round((1 + Math.random() * 3) * s)), 0xe2231a, 0.62);
            g.lineBetween(sc.ax + dx * t0 + jx, sc.ay + dy * t0 + jy,
                          sc.ax + dx * t1 + jx, sc.ay + dy * t1 + jy);
          }
        });
      };
      /* 偶尔故障：每 **0.7 秒**一次 ✓（2026-09-21 用户定稿 ✓ 350 太吵 → 回到 700 ✓✓）
       *   抖 180ms 就恢复实线 ✓ 有疤才抖 ✓ 没疤直接跳过 ✓
       *   ★ 以后要调只改这一个数 ✓ */
      scene._saintScarTimer = scene.time.addEvent({
        delay: 700, loop: true, callback: function () {
          /* ★★★ 2026-09-26 修的**真 bug**（`_renderer.log` 抓到的）✗✗
           *   症状：`Uncaught TypeError: e._saintScarDraw is not a function`
           *         `at initialize.callback` ← Phaser 的 TimerEvent 回调 ✓
           *   病因：这是个 `loop: true` 的**常驻定时器** ✗
           *     而 `clear()` 里会 `scene._saintScarDraw = null;` ✗（L1179 ✓）
           *     → 战斗结束后定时器**还没被 remove 掉的那一帧**回调又跑了一次 ✓
           *       → 调 `null(true)` → 抛 ✓
           *   ★ 原来的 `if (!scene._saintScars || ...) return;` **挡不住** ✗ ——
           *     `_saintScars` 与 `_saintScarDraw` 是**两行分别置 null** 的 ✓
           *     中间就可能出现"scars 还在、draw 已 null"的窗口 ✓
           *   ⇒ 必须**对要调用的那个函数本身判空** ✗ 不能靠别的变量间接保证 ✓
           *   ★ 同样给 180ms 的那个 delayedCall 加守卫 ✓（它更晚，更容易撞上 clear ✓）*/
          if (!scene._saintScars || !scene._saintScars.length) return;
          if (typeof scene._saintScarDraw !== 'function') return;      // ★ 清场后直接跳过 ✓
          scene._saintScarDraw(true);
          scene.time.delayedCall(180, function () {
            if (typeof scene._saintScarDraw === 'function' && scene._saintScars) scene._saintScarDraw(false);
          });
        },
      });
    },
    _scarAdd(scene, ax, ay, bx, by) {
      try {
        this._scarInit(scene);
        scene._saintScars.push({ ax: ax, ay: ay, bx: bx, by: by });
        scene._saintScarDraw(false);   // 新疤先画成实线 ✓
      } catch (e) {}
    },
    /* ==========================================================================
     * 答题演出共用实现（2026-09-21）
     *   _doves(scene, cx, cy, kind)
     *     kind === 'out' → 答对：从格心**向外荡成一个正圆** ✓ 原色 ✓
     *     kind === 'in'  → 答错：从半径 R 的圆上**向格心收拢** ✓ 并染红 0xe2231a ✓
     *   两条路径的**半径 / 时长 / 缓动 / 尺寸全部统一** ✓（保证任意时刻都在同一个圆上 ✓）
     * ======================================================================== */
    _doves(scene, cx, cy, kind) {
      const s = Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));
      const R = 480 * s;
      const SIZE = 48 * s;
      const OUT = (kind !== 'in');
      const RED = 0xe2231a;                    // ★ 项目唯一的红（语义＝错 ✓）
      scene._saintFx = scene._saintFx || [];
      const keep = function (o) { scene._saintFx.push(o); return o; };
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const key = dx >= 0 ? 'skin-saint-dove-r' : 'skin-saint-dove-l';
        if (!scene.textures.exists(key)) continue;
        const sx = OUT ? cx : cx + dx * R;
        const sy = OUT ? cy : cy + dy * R;
        const ex = OUT ? cx + dx * R : cx;
        const ey = OUT ? cy + dy * R : cy;
        const dv = scene.add.image(sx, sy, key).setDepth(6).setAlpha(0).setDisplaySize(SIZE, SIZE);
        if (!OUT) dv.setTint(RED);               // ★ 答错：染红（乘算 → 暗砖红 ✓）
        keep(dv);
        /* ★ 时长按方向分开（2026-09-21 用户：收拢稍快 ✓）
         *   向外荡开 900 ms ✓ ／ 向内收拢 **700 ms** ✓ */
        scene.tweens.add({
          targets: dv,
          x: ex, y: ey,
          alpha: { from: 0, to: OUT ? 1 : 0.8 },
          scale: { from: 0.75, to: 1 },
          duration: OUT ? 900 : 700, delay: OUT ? 120 : 90, ease: 'Cubic.easeOut',
          onComplete: function () { if (OUT) dv.destroy(); },
        });
        scene.tweens.add({ targets: dv, alpha: 0, duration: 320, delay: OUT ? 780 : 620, onComplete: function () { try { dv.destroy(); } catch (e) {} } });
      }
      /* 中心闪光 ＋ 取点方块（两种都用 ✓ 答错时闪光染红 ✓）*/
      if (scene.textures.exists('skin-saint-flash')) {
        const fl = scene.add.image(cx, cy, 'skin-saint-flash').setDepth(6).setAlpha(0).setDisplaySize(200 * s, 200 * s);
        if (!OUT) fl.setTint(RED);
        keep(fl);
        scene.tweens.add({ targets: fl, scale: { from: 0.3, to: 1.1 }, alpha: { from: 0, to: 0.95 }, duration: 240, ease: 'Quad.easeOut' });
        scene.tweens.add({ targets: fl, alpha: 0, duration: 320, delay: 240, onComplete: function () { try { fl.destroy(); } catch (e) {} } });
      }
      /* ★ 格心取点方块（2026-09-21 修 ✗）：**连线阶段不画** ✓
       *   四选一阶段它标记"正确那一格在哪" ✓ 有意义 ✓
       *   但连线阶段的圆心＝**画面正中** ✓ 方块会孤零零杵在屏幕中间 ✗（用户截图）→ 跳过 ✓
       *   （用现成的 _linkActive() 判断 ✓ 不改签名 ✓ 不改任何调用点 ✓）*/
      if (!this._linkActive(scene)) {
        const dot = scene.add.rectangle(cx, cy, 9 * s, 9 * s, OUT ? 0x54686a : RED, 1).setDepth(7).setAlpha(0);
        keep(dot);
        scene.tweens.add({ targets: dot, alpha: 1, duration: 160 });
        scene.tweens.add({ targets: dot, alpha: 0, duration: 400, delay: 480, onComplete: function () { try { dot.destroy(); } catch (e) {} } });
      }
    },
    onCorrect(scene, index) {
      try {
        /* ★ 连线阶段没有选项格子 ✓ → 以**画面正中**为圆心（＝从中间炸开 ✓ 2026-09-21 用户要求）*/
        if (this._linkActive(scene)) {
          /* ★ 防重 ✓：settle() 里已经当场炸过了 ✓ 这里就别再炸一次 ✓（否则双份鸽群 ✗）*/
          if (scene._saintBurstAt && (Date.now() - scene._saintBurstAt) < 1200) return;
          this._doves(scene, scene.scale.width / 2, scene.scale.height / 2, 'out');
          return;
        }
        const btn = (scene.optionButtons || [])[index];
        this._doves(scene, btn ? btn.x : scene.scale.width / 2, btn ? btn.y : scene.scale.height / 2, 'out');
      } catch (e) { try { console.error('[saint] onCorrect', e); } catch (e2) {} }
    },
    /* 答错：以**被点错的那一格**为中心，鸽子反向收拢并染红（超时时传的是 correctIndex ✓ 照用 ✓） */
    onWrong(scene, index) {
      try {
        /* ★ 连线阶段同理：错时也从画面正中收拢染红 ✓ */
        if (this._linkActive(scene)) { this._doves(scene, scene.scale.width / 2, scene.scale.height / 2, 'in'); return; }
        const btn = (scene.optionButtons || [])[index];
        this._doves(scene, btn ? btn.x : scene.scale.width / 2, btn ? btn.y : scene.scale.height / 2, 'in');
      } catch (e) { try { console.error('[saint] onWrong', e); } catch (e2) {} }
    },
    /* ---------- 每题：选项线颜色（冰蓝 ✓） + 光环与羽毛对齐到右栏立绘 ---------- */
    /* ★★★ 把"圣徒连线这一题玩家看到/选了什么"写进 `scene._saintLog` ✗✗
     *   （2026-09-26 修"圣徒的结算不对" ✓ 与奎隆的 `_writeFireLog` 同一套路 ✓）
     *   ★ 为什么需要它 ✗：连线阶段的题面是**本皮肤自己抽的 3 对熟词生义词** ✓
     *     （`_linkBuild` 里从 `SENSE_WORDS` 抽 ✓）与玩家真正在答的那道四选一题**无关** ✓
     *     → `RunState.logAnswer` 读 `wordText.text` / `_shown` 会把**两件事**拼成一行 ✓
     *       于是出现 `fever 发烧；发热 | 你的作答 代表；利益` 这种自相矛盾的记录 ✓
     *   ★ 参数：
     *     `scene._saintLog` 由 `_linkBuild` 在连线接管题面**之前**写好（含 en/zh/shown ✓）
     *     这里只补"玩家那一侧" ✓：
     *       答对 → `_shown[ci]`（＝正解 ✓）
     *       连错 → `_shown[widx]`（`widx = (ci+1)%4` 是**故意的错下标** ✓ 记它才是真作答 ✓）*/
    _writeSaintLog(scene, ur) {
      try {
        if (!scene || !scene._saintLog) return;
        scene._saintLog.your = ur || '';
      } catch (e) {}
    },
    /* ---------- 每题：选项线颜色（冰蓝 ✓） + 光环与羽毛对齐到右栏立绘 ---------- */
    /* ==========================================================================
     * 四按钮外观：「方案 Ⅲ 同心圆取点」（2026-09-21 用户选定 ✓）
     *   · 四格**同一套样式** ✓：1px 电光蓝细框 ＋ 四角刻度方块 ＋ 左下坐标标注（A1/B1/A2/B2 ✓）
     *     ＋ 蓝底线 ＋ 右端小方块
     *   · 悬停：格右浮出**同心圆（3 环）＋ 中心取点方块** ✓ ＋ 文字转亮蓝 ✓ ＋ 底线转黄绿 ✓
     *   · 选中：整格填**电光蓝**（在文字之下 ✓）＋ 文字变白 ✓ ＋ 黄绿底线 ✓
     *   ★ 零侵入 ✗：装饰全部画在**场景层** ✓ 不往 row 容器里插对象 ✓（children 顺序不能动 ✓）
     * ======================================================================== */
    _buttons(scene) {
      /* ======================================================================
       * 四按钮外观：「方案 Ⅲ 同心圆取点」（2026-09-21 用户选定 ✓）
       *   · 四格同一套样式 ✓：1px 电光蓝细框 ＋ 四角刻度方块 ＋ 左下坐标标注（A1/B1/A2/B2 ✓）
       *     ＋ 蓝底线 ＋ 右端小方块
       *   · 悬停：格右下浮出**同心圆（3 环）＋ 取点方块** ✓ ＋ 文字转亮蓝 ✓ ＋ 底线转黄绿 ✓
       *   · 选中：整格填电光蓝（在文字之下 ✓）＋ 文字变白 ✓ ＋ 黄绿底线 ✓
       * ★ 两条硬约束（踩过坑 ✓）：
       *   ① **尺寸从 row 自己的命中矩形读** ✓（btn.list[0].width/height ＝ 真实 w/h ✓）
       *      不能硬编码 ✗ —— 尺寸会被 _layoutOptions / 试炼二选一改变 ✓ 且每题都要重画 ✓
       *   ② row 自带的 pointerover 会把它的 rule 变**红** ✓ → 我的监听注册在它**之后** ✓
       *      在我的回调里**把它的 rule 一起刷成我的颜色** ✓✓（否则会同时看到红与我画的线 ✗）
       * ★ 零侵入 ✗：装饰全部画在**场景层** ✓ 不往 row 容器里插对象 ✓（children 顺序不能动 ✓）
       * ==================================================================== */
      /* ★ 缩放：用项目同款公式 ✓（原来用 `scene._sc` ✗ 该字段不存在 → s 恒为 1 → 一切都偏小 ✓）*/
      const s = Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));
      /* ★ 线色 = 深青灰（2026-09-21 用户选定 ✓ 与倒计时条 / 血条同色 ✓）*/
      const BLUE = 0x54686a, INK = 0x12232e;
      /* 每题重画：清掉上一题的装饰 ✓（尺寸/位置可能变 ✓）*/
      (scene._saintBtns || []).forEach(function (b) {
        try { b.fill.destroy(); b.g.destroy(); b.idt.destroy(); if (b.paper) b.paper.destroy(); } catch (e) {}
      });
      scene._saintBtns = [];
      (scene.optionButtons || []).forEach(function (btn, i) {
        if (!btn) return;
        const hit = btn.list && btn.list[0];
        const label = btn.list && btn.list[1];
        const rule = btn.list && btn.list[btn.list.length - 1];   // 末尾那个就是 row 的底线 ✓
        const cx = btn.x, cy = btn.y;                              // ★ row 的 (x,y) ＝ 格子中心 ✓
        const W = (hit && hit.width) ? hit.width : 320 * s;         // ★ 真实尺寸 ✓ 不硬编码 ✗
        const H = (hit && hit.height) ? hit.height : 84 * s;
        /* ★★ 该格的**真实缩放**：格子宽恒为 320 设计单位 ✓ → W/320 一定正确 ✓✓
         *   所有尺寸（刻度 / 底线 / 圆环 / 字号）都改用它 ✓ 保证与 HTML 预览同比例 ✓ */
        /* ★★ 缩放基准宽度**按选项数取** ✗✓（2026-09-21 修）
         *   四选一格子设计宽 320 ✓ 六选一格子设计宽 **224** ✓
         *   写死 320 会让六选一的 sc 变成 0.7 ✓ → 框与标注全缩到左上 ✓（截图实测 ✓）*/
        const _nOpt = (scene.optionButtons || []).length || 4;
        const _baseW = (_nOpt === 6) ? 224 : 320;
        const sc = (hit && hit.width) ? (hit.width / _baseW) : s;
        /* ★★ 每题强制把文字刷回黑 ✓✓ —— row 容器**被场景复用** ✓
         *   上一题点选留下的白字必须清掉 ✗（2026-09-21 用户实测：白字带到下一题 ✓）*/
        if (label && label.setColor) label.setColor('#12232e');
        /* ★ 隐藏 row 自带的下划线 ✗（它又粗又会变红 ✓ 与我们的四边框重复 ✗）*/
        if (rule && rule.setVisible) rule.setVisible(false);
        /* ★ 列数按实际选项数推（4 → 2 列 ✓ 6 → 3 列 ✓ 2026-09-21）*/
        const _n = (scene.optionButtons || []).length || 4;
        const _cols = (_n === 6) ? 3 : 2;
        const col = i % _cols, row = Math.floor(i / _cols);
        const id = String.fromCharCode(65 + col) + (row + 1);       // A1 / B1 / A2 / B2 ✓
        const x0 = cx - W / 2, y0 = cy - H / 2;
        /* 选中填充（在文字之下 ✓ 高于背景 -20 ✓）*/
        /* 格内很淡的白底（压平背景 ✓ 预览里格子就是更平的 ✓）*/
        const paper = scene.add.rectangle(cx, cy, W, H, 0xffffff, 0.45).setDepth(-0.6);   // ★ 0.45：压平背景 ✓ 环与字更像预览 ✓
        const fill = scene.add.rectangle(cx, cy, W, H, BLUE, 1).setDepth(-0.5).setVisible(false);
        const g = scene.add.graphics().setDepth(1);
        const draw = function (hov) {
          g.clear();
          g.lineStyle(Math.max(1, Math.round((hov ? 2 : 1) * s)), BLUE, hov ? 1 : 0.9);   // ★ 加浓 ✓
          g.strokeRect(x0, y0, W, H);
          const t = 9 * sc;   // ★ 刻度 ✓
          g.lineStyle(Math.max(1, Math.round(1 * sc)), BLUE, 1);
          [[x0, y0], [x0 + W, y0], [x0, y0 + H], [x0 + W, y0 + H]].forEach(function (p) {
            g.strokeRect(p[0] - t / 2, p[1] - t / 2, t, t);
          });
          /* 底线（与 row 自带那条同位置 ✓ 悬停转黄绿 ✓）*/
          /* ★ 下面那条边：**不再单独画** ✗（2026-09-21 用户要求）
           *   四边统一由上面的 strokeRect 承担 ✓ 粗细颜色完全一致 ✓
           *   （原来单独画一条 2~3px 底线 ＋ 端部方块 ✓ 显得底边特别粗 ✓ 已删 ✓）*/
          /* ★ 同心圆：**已按用户要求删除** ✗（2026-09-21）*/
        };
        draw(false);
        /* 左下坐标标注（Novecento 疏排 ✓）*/
        const idt = scene.add.text(x0 + 8 * sc, y0 + H - 14 * sc, id,
          { fontFamily: Babel.FONTS.display, fontSize: Math.round(9 * sc) + 'px', color: '#54686a' }).setDepth(1);
        /* ★ st 提前建好 ✓ 悬停回调里要用它做「除我之外」的判定 ✓ */
        const st = { btn: btn, fill: fill, g: g, idt: null, label: label, rule: rule, paper: paper, W: W, H: H, setHov: null };
        const setHov = function (hov) {
          draw(hov);
          /* ★ 悬停时文字变蓝 ✓ 离开回黑 ✓（用户 2026-09-21 认可 ✓）*/
          if (label && label.setColor) label.setColor(hov ? '#54686a' : '#12232e');   // ★ 保留悬浮变色 ✓ 只换色 ✓
          /* ★ 文字一律保持黑 ✓ 悬停也不变蓝（用户 2026-09-21 要求）*/
          if (idt.setColor) idt.setColor('#54686a');   // 坐标标注保持蓝 ✓（蓝图语言 ✓）
          /* ★ 把 row 自带那条底线也刷成同色 ✓（否则悬停时它还留着红色 ✗）*/
          if (rule && rule.setVisible) rule.setVisible(false);   // ★ 保持隐藏 ✓ 不再改它的颜色
        };
        /* ★ 逐格即时响应（2026-09-21 补回 ✓）
         *   ⚠️ 单独用它不可靠 ✗（场景复用 → 旧监听残留 → 永久蓝 ✓）
         *   但现在有 update / pointermove 两条**按坐标重算**的通道兜底 ✓
         *   → 它只负责「手感更即时」 ✓ 状态最终由仲裁者决定 ✓✓ */
        if (hit && hit.on) {
          hit.on('pointerover', function () { setHov(true); });
          hit.on('pointerout', function () { if (scene._saintApply) scene._saintApply(); });
        }
        st.setHov = setHov;   // ★ 供「清其余」调用 ✓
        st.idt = idt;
        scene._saintBtns.push(st);
      });
      /* ★★ 全局指针判定（2026-09-21 最终方案 ✓）
       *   为什么不用 enter/leave ✗：鼠标完全离开选项区时没有任何一格收到事件 ✓
       *   → 最后一格永远是蓝的 ✓✓ 用户实测到这一点 ✓
       *   改为：每次鼠标移动按**坐标**判定光标在哪一格 ✓（不在任何格 → 四格全黑 ✓）*/
      /* ★★ 每帧判定（2026-09-21 最终方案 ✓）
       *   不依赖 pointerover/out/pointermove ✗ —— 它们都有"鼠标静止就不触发"的问题 ✓
       *   每帧用 activePointer 的坐标与四格矩形比对 ✓ → setHov(inside) ✓
       *   先 off 同名监听再 on ✓ → **打多少局都不会重复挂** ✓✓ */
      /* ★★ 悬停仲裁（2026-09-21 三重保险 ✓）
       *   判定逻辑只有一份：拿 activePointer 的坐标与四格矩形比对 ✓
       *   挂三条通道：每帧 update ✓ 全局 pointermove ✓ 逐格 pointerover/out ✓
       *   → 任何一条生效就够 ✓；逐格那条即使残留 ✓ 下一帧也会被按坐标纠正 ✓✓ */
      if (scene._saintTick) {
        try { scene.events.off('update', scene._saintTick); } catch (e) {}
      }
      if (scene._saintMoveFn) {
        try { scene.input.off('pointermove', scene._saintMoveFn); } catch (e) {}
      }
      scene._saintApply = function () {
        const ptr = scene.input && scene.input.activePointer;
        if (!ptr) return;
        (scene._saintBtns || []).forEach(function (o) {
          if (!o || !o.setHov) return;
          if (o.btn && o.btn.active === false) return;   // ★ 僵尸对象直接跳过（防异常/卡死 ✓）
          if (o.g && o.g.active === false) return;
          const inX = Math.abs(ptr.x - o.btn.x) <= o.W / 2;
          const inY = Math.abs(ptr.y - o.btn.y) <= o.H / 2;
          o.setHov(inX && inY);
        });
      };
      scene._saintTick = scene._saintApply;
      scene._saintMoveFn = scene._saintApply;
      scene.events.on('update', scene._saintTick);
      /* ★★ 场景关闭时**必定**清理（2026-09-21 修 ✗）
       *   为什么必须加：玩家可能走「退出按钮」离开 ✗ → 那**不会**经过 _endBattle ✓
       *   → clear() 不会被调用 ✗ → 这两个每帧监听会留在**被复用的场景**上 ✓
       *   → 下一场战斗里它们还跑 ✓ 而 _saintBtns 指向已销毁对象 → 卡死 ✓✓
       *   once('shutdown') 保证：无论怎么离开，监听都注销 ✓✓ */
      scene.events.once('shutdown', function () {
        try { scene.events.off('update', scene._saintTick); } catch (e) {}
        try { if (scene._saintMoveFn) scene.input.off('pointermove', scene._saintMoveFn); } catch (e) {}
        scene._saintTick = null; scene._saintMoveFn = null; scene._saintBtns = [];
      });
      scene.input.on('pointermove', scene._saintMoveFn);
      try { scene._saintApply(); } catch (e) {}   // 立刻按一次 ✓ 不等第一帧
    },
    resetOptions(scene) {
      try {
        (scene.optionButtons || []).forEach(function (btn) {
          if (btn && btn._rule && btn._rule.setFillStyle) btn._rule.setFillStyle(ICE, 0.45);
        });
      } catch (e) {}
    },
    /* ---------- 每题：选项线颜色（正确项淡金 / 其余冰蓝 ✓） + 光环与羽毛对齐 ---------- */
    resetOptions(scene) {
      try {
        (scene.optionButtons || []).forEach(function (btn) {
          if (btn && btn._rule && btn._rule.setFillStyle) btn._rule.setFillStyle(ICE, 0.45);
        });
      } catch (e) {}
    },
    onWord(scene) {
      /* ★ 四按钮外观（方案 Ⅲ ✓ 每题重画 ✓）
       *   **故意放在 try 之外** ✗✓ —— 否则一旦这里出错 ✓
       *   会把同在第 4 行 try 里的"倒计时上色"一起带停 ✗（2026-09-21 踩过 ✓）*/
      try { this._buttons(scene); } catch (e) { try { console.error("[saint] _buttons", e); } catch (e2) {} }
      /* ★ 真实缩放 ✓（原 scene._sc 不存在 ✗）*/
      const s = Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720));
      try {
        /* ★ 倒计时条配色（预览口径 ✓）：填充淡金 ✓ 轨道冰白＋冰蓝描边 ✓ 数字深金 ✓
         *   ⚠️ 必须**每题**重设 ✗ —— 游戏在 _newWord 里会把条重置成橙色 0xf5a623（L650 ✓）
         *   本钩子挂在 L766 ✓ 晚于那次重置 ✓ 所以这里写的是最后一笔 ✓✓ */
        if (scene.cdBar) {
          if (scene.cdBar.setColor) scene.cdBar.setColor(0x54686a);   // ★ 深青灰（标题卡实测色板 ✓ 2026-09-18 用户指定）
          if (scene.cdBar.setBg) scene.cdBar.setBg(0xe8eef3, ICE);   // 轨道：冰白 ＋ 冰蓝细边 ✓（不变）
        }
        if (scene.cdText && scene.cdText.setColor) scene.cdText.setColor('#54686a');   // ★ 与条同色
        const cx = scene.width / 2, cy = scene.height / 2;
        const px = cx + 490 * s;                       // 敌人（圣徒）在右栏 ✓
        if (scene._saintHalo) scene._saintHalo.setPosition(px, cy - 200 * s + 132 * s);
        (scene._saintFeathers || []).forEach(function (f, i) {
          f.setPosition(px + (i % 3 - 1) * 55 * s + 40 * s, cy - 200 * s + 10 * s + i * 12 * s);
        });
      } catch (e) {}
    
      /* ★ 连线阶段的界面构建（2026-09-21）：**放在原逻辑之后** ✗✓
       *   原因：游戏自己会在 onWord 里把四个选项重新 setVisible(true) ✓
       *   → 若放在最前面 ✗ 连线界面会被重新出现的选项盖住 ✓✓ */
      try { if (this._linkActive(scene)) this._linkBuild(scene); } catch (e) { try { console.error("[saint] link", e); } catch (e2) {} }
    },

    /* ---------- 离场：清干净（场景会被复用 ✗ 不清会残留到下一场 ✓） ---------- */
    clear(scene) {
      /* ★ 清掉四按钮的装饰（场景复用不残留 ✗）*/
      (scene._saintBtns || []).forEach(function (b) {
        try { b.fill.destroy(); b.g.destroy(); b.idt.destroy(); } catch (e) {}
      });
      scene._saintBtns = null;
      /* 注销全局指针监听 ✓（防场景复用后重复注册 ✓）*/
      if (scene._saintTick) {
        try { scene.events.off('update', scene._saintTick); } catch (e) {}
        scene._saintTick = null;
      }
      if (scene._saintMoveFn) {
        try { scene.input.off('pointermove', scene._saintMoveFn); } catch (e) {}
        scene._saintMoveFn = null;
      }
      scene._saintApply = null;
      try { this._linkClear(scene); } catch (e) {}
      /* ★ 疤痕层与它的定时器一并清掉 ✓（2026-09-21 补 ✗ 之前没清 →
       *   场景复用后 `_saintScarG` 是**已销毁**的 Graphics ✓ 但那时的 `if (!scene._saintScarG)`
       *   判不出来 ✓ → 新一场会往销毁对象上画 ✗ → 现在显式销毁 ＋ 置空 ✓✓）*/
      try { if (scene._saintScarTimer && scene._saintScarTimer.remove) scene._saintScarTimer.remove(false); } catch (e) {}
      try { if (scene._saintScarG && scene._saintScarG.destroy) scene._saintScarG.destroy(); } catch (e) {}
      scene._saintScarTimer = null; scene._saintScarG = null;
      scene._saintScars = null; scene._saintScarDraw = null;
      scene._saintRevTick = null;
      /* ★ 答题演出的残留对象也一并清掉 ✓ */
      (scene._saintFx || []).forEach(function (o) { try { o.destroy(); } catch (e) {} });
      scene._saintFx = null;
      try {
        (scene._saintTweens || []).forEach(function (t) { try { t.stop(); t.remove(); } catch (e) {} });
        (scene._saintObjs || []).forEach(function (o) { try { o.destroy(); } catch (e) {} });
      } catch (e) {}
      scene._saintObjs = []; scene._saintTweens = []; scene._saintFeathers = [];
    },
  };

  /* ★ 供类内静态调用（_doves / _glass ✓ 2026-09-21）—— 必须放在 Skin 定义**之后** ✗✓（放在前面会 TDZ 导致整包启动黑屏 ✓ 踩过 ✓）*/
  const Saint = Skin;
  Babel.SKIN_Saint = Skin;
})();
