/* ============================================================================
 * SummaryScene.js —— 每局总结（2026-09-18 新增）
 * ----------------------------------------------------------------------------
 * 五屏：① 封卷 ② 战绩 ③ 错题 ④ 对题 ⑤ 见闻
 * 数据来源：Babel.RunState.runLog（由第①步的记录层写入 ✓ 本场景**只读** ✓）
 *
 * 【设计口径（与用户逐条确认过 ✓）】
 *   · 美术：E3 展签 ✓ 纸白 ＋ 墨 ＋ 发丝线 ＋ 唯一红（只在"错/结局词后半段"用 ✓）
 *   · 结局词：win 语域贯通 ／ lose 残响未竟 ／ quit 中途搁笔（后半段标红 ✓）
 *   · 错题四列：英文词 ｜ 中文释义 ｜ 你的作答 ｜ 出处（用户选定的 B 方案 ✓）
 *       · 四选一：作答＝他点的中文 ✓  拼词类：作答＝已拼字母前缀（空则「（未拼出）」✓）
 *   · 对题：按战斗折叠（每场一行，题数＋全对/几错 ✓）
 *   · 见闻：路线（节点序列）／藏品（获得顺序＋换出）／账目（收入·支出·结余）
 *   · 长列表支持**滚轮** ✓ 自绘 1px 轨道 ＋ 5px 滑块 ✓
 *     ★ 裁剪用 GeometryMask（Phaser 原生 ✓）＋ 容器 Y 位移 ✓ —— 与预览页的做法一一对应 ✓
 *
 * 【不变量（项目铁律）】
 *   · 所有尺寸＝设计值 × s（s = max(1, min(w/1280, h/720))）✓ 位置用 this.width/height 算 ✓
 *   · 本场景**不改任何状态** ✗（只读 runLog ✓ 除了「再走一次」会 init 新局 ✓）
 * ========================================================================== */
(function () {
  if (!window.Babel) window.Babel = {};
  const C = Babel.COLORS || {};

  class SummaryScene extends Phaser.Scene {
    constructor() { super('Summary'); }

    init() {
      this._objs = [];        // 本屏所有对象（切屏时统一销毁 ✓）
      this._scrolls = [];     // 本屏的可滚动区
      this._page = 0;
      this._log = (Babel.RunState && Babel.RunState.runLog) || { answers: [], nodes: [], gained: [], tradedOut: [], earned: 0, spent: 0 };
    }

    create() {
      /* ★★ 必须先取画布宽高（Phaser 场景里 this.width/height **不会自动存在** ✗）
       *   不设的话 s 会算成 NaN ✗ → 所有元素坐标 NaN ✗ → **白屏且不报错**（2026-09-18 踩过 ✓）
       *   与 MapScene 的写法保持一致 ✓ */
      this.width = this.scale.width;
      this.height = this.scale.height;
      const s = this._sc = Math.max(1, Math.min(this.width / 1280, this.height / 720));
      this._st = this._stats();
      /* ★★★ 布局自检日志 ✗✗（2026-09-30 用户报"划分不清晰"）
       *   ★ 为什么加 ✗：我**看不到玩家的实际显示尺寸** ✗
       *     于是只能猜"列宽够不够 / 会不会溢出" ✓ 猜错就白改一轮 ✓
       *   ⇒ 把关键几何量打出来 ✓ 我读 `_renderer.log` 就能定论 ✓（与 Diag 同一思路 ✓）
       *   ★ 只在 SummaryScene 打一次 ✓ 不刷屏 ✓ */
      try {
        console.log('[Summary] 画布 ' + Math.round(this.width) + '×' + Math.round(this.height) +
                    ' ／ 缩放 _sc=' + s.toFixed(3) +
                    ' ／ 内容区 44~1236（宽 1192）×1 后 = ' + Math.round(44 * s) + '~' + Math.round(1236 * s) +
                    ' ／ 词表列 x=800 宽 420 → ' + Math.round(800 * s) + '~' + Math.round(1220 * s) +
                    ' ／ 画布右边界 ' + Math.round(this.width));
      } catch (e) {}
      this._render();
      /* 键盘翻屏 ✓ */
      this._keyHandler = (e) => {
        if (e.key === 'ArrowRight') this._go(this._page + 1);
        if (e.key === 'ArrowLeft') this._go(this._page - 1);
      };
      this.input.keyboard.on('keydown', this._keyHandler);
      /* ★★ 滚轮：Phaser 原生 wheel 事件 ✓ 按指针位置决定滚哪个区 ✓
       *   ★★★ 2026-09-30 修单位 bug ✗✗（用户："打不了用滚轮翻页"）
       *     · `sc.x/y/w/h/total/off` 全是**屏幕像素**（建时乘了 `_S()` ✓）
       *     · `pointer.x/y` 是**屏幕像素** ✓ 这一半对 ✓（命中判断没问题 ✓）
       *     · **但 `dy` 没按缩放折算** ✗ —— 在 `_sc` 大的机器上（他是 2 倍）
       *       手指滚一格只走 `dy` 像素，视觉上"几乎不动" ✓ 体感就是"滚不动" ✓
       *     · 而且 `dy` 原始值只有 ±100 上下 ✓ 内容 800+ 像素要滚十几下 ✓ 太慢 ✓
       *   ⇒ 三处一起改 ✗：
       *     ① `dy` 乘 `_sc` → 与内容同一坐标系 ✓
       *     ② 再乘 **1.6** 手感系数 ✓（一次滚轮 ≈ 一屏的 1/4 ✓）
       *     ③ 滑块拖动也补上（原来只 `setInteractive` 没绑拖动 ✗ 白设 ✓）*/
      const WHEEL_K = 1.6;
      this.input.on('wheel', (pointer, objs, dx, dy) => {
        const px = pointer.x, py = pointer.y;
        for (const sc of this._scrolls) {
          if (px >= sc.x && px <= sc.x + sc.w && py >= sc.y && py <= sc.y + sc.h) {
            const step = dy * (this._sc || 1) * WHEEL_K;
            sc.off = Math.max(0, Math.min(sc.total - sc.h, sc.off + step));
            this._applyScroll(sc);
            break;
          }
        }
      });
      this.events.once('shutdown', () => {
        if (this._keyHandler) this.input.keyboard.off('keydown', this._keyHandler);
      });
    }

    /* ---------- 工具 ---------- */
    /* ★★★ 估一个"会被折行的文字块"的**设计像素高** ✗✗（2026-09-30）
     *   ★★ 第二版 ✗✗：改成**按词折行** —— 这才是 Phaser 的实际行为 ✓
     *     病因（用户第二次报"还是叠在一起"✓）：第一版是**逐字符**累加 ✗
     *     而 `_into` 建文本时用的是 **`useAdvancedWrap: true`** ✗
     *       · 那个模式**按空格断词** ✓ 一个长词放不下会**整体推到下一行** ✓
     *       · 逐字符算法会把长词**劈开**塞进本行 ✗ → 算出的行数**必然偏少** ✓
     *       · 表现：分隔线压在下一行上、最后一行被滚出可视区（用户截图 ✓）
     *   ★ 口径：**"估行数"必须照抄渲染器的断行规则** ✗✗
     *     搞不清就别自己发明 ✓ 去看渲染器怎么断的（这里是 `useAdvancedWrap` ✓）
     *   ★ 宽度口径：`_into(…, w, …)` 收的是**设计像素** ✓ 内部乘 `_S()` ✓
     *     所以这里也按设计像素算：每行可容纳 `w / size` 个「全角字宽」✓
     *   ★ 中英混排：汉字 1 个字宽 ✓ ASCII 0.55 ✓
     *     ★ 宁可**高估** ✗ —— 高估只是多留白 ✓ 低估就是压字 ✓ 代价不对等 ✓ */
    _estH(str, w, size, lineSpacing) {
      const txt = String(str == null ? '' : str);
      if (!txt) return 0;
      const per = Math.max(1, w / size);            // 每行可容纳的"全角字宽"数
      const ls = (lineSpacing == null) ? 5 : lineSpacing;
      const widthOf = (s) => {                      // 一个片段占多少"全角字宽"
        let px = 0;
        for (let i = 0; i < s.length; i++) px += (s.charCodeAt(i) > 255) ? 1 : 0.55;
        return px;
      };
      let lines = 1, cur = 0;
      /* ★ 按**空格**切词 ✗（与 `useAdvancedWrap` 一致 ✓）；空白片段也保留（占宽 ✓）*/
      const parts = txt.split(/(\s+)/);
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        if (!seg) continue;
        const sw = widthOf(seg);
        if (/^\s+$/.test(seg)) {
          if (cur + sw > per) { lines++; cur = 0; }  // 行尾空白放不下就丢掉 ✓（渲染器同此 ✓）
          else cur += sw;
          continue;
        }
        if (sw > per) {
          /* 单词比整行还宽 → 渲染器**先整体推到下一行** ✓ 仍放不下才逐字符硬切 ✓ */
          if (cur > 0) { lines++; cur = 0; }
          const need = Math.ceil(sw / per);
          lines += need - 1;
          cur = sw - (need - 1) * per;
          continue;
        }
        if (cur + sw > per) { lines++; cur = sw; }
        else cur += sw;
      }
      return lines * size + (lines - 1) * ls;
    }
    /* ★ 列坐标表（2026-09-18）：表头与数据行**共用这一张** ✗ 不许各写一套（否则必然错位 ✓）
     * ★ 2026-09-30：列宽放宽 ✗（用户："既然已经可以下拉了不如空间大一点，词不要都挤在一起"）
     *   · 原来是 `en:26 zh:250 your:512 src:830` → `src` 只有 358 宽 ✗
     *     「第 2 层 · 萨卡兹宿主卫巢百夫长 · 四选一」这种会折到 2~3 行 ✓ 挤成一团 ✓
     *   · 现在 `your` 收窄 512 → **470** ✓ → `src` 拿到 **420** ✓ 折行明显减少 ✓ */
    get COL() { return { mark: 0, en: 26, zh: 250, your: 470, src: 800 }; }
    /* ★ 换行文本（2026-09-18）：`Babel.UI.text` **不支持换行** ✗（只传 font/size/color ✓）
     *   → 所以直接 `this.add.text` 并开 `wordWrap` ✓✓ 长文本自动折行 ✓ **永不截断** ✓（用户要求「一定要显示全」✓）
     *   `w` 传列宽 ✓ 折行就发生在自己的列内 ✓ */
    _wrap(x, y, w, str, opt) {
      opt = opt || {};
      const t = this.add.text(this._S(x), this._S(y), String(str == null ? '' : str), {
        fontFamily: opt.font || Babel.FONTS.body,
        fontSize: this._S(opt.size || 16) + 'px',
        color: opt.color || '#111111',
        align: opt.align || 'left',
        fontStyle: opt.bold ? 'bold' : 'normal',
        wordWrap: { width: Math.max(24, this._S(w)), useAdvancedWrap: true },
        lineSpacing: this._S(opt.lineSpacing == null ? 5 : opt.lineSpacing),
      });
      return this._add(t);
    }
    _S(v) {
      const n = Math.round((Number(v) || 0) * this._sc);
      return isFinite(n) ? n : 0;          // ★ NaN 兜底：宁可画在 0 位也不整屏消失 ✓
    }
    _add(o) { this._objs.push(o); return o; }
    _txt(x, y, str, opt) {
      opt = opt || {};
      const o = Babel.UI.text(this, this._S(x), this._S(y), str, {
        font: opt.font || Babel.FONTS.body,
        size: this._S(opt.size || 14) + 'px',
        color: opt.color || '#111111',
        origin: opt.origin || [0, 0],
        wrap: opt.wrap ? this._S(opt.wrap) : undefined,
        align: opt.align,
      });
      if (opt.bold) o.setFontStyle && o.setFontStyle('bold');
      return this._add(o);
    }
    _rect(x, y, w, h, color, alpha) {
      return this._add(this.add.rectangle(this._S(x), this._S(y), Math.max(1, this._S(w)), Math.max(1, this._S(h)), color, alpha == null ? 1 : alpha).setOrigin(0, 0));
    }
    _hr(x, y, w, color) { return this._rect(x, y, w, 1, color == null ? 0xe6e6e6 : color); }
    _clear() {
      this._objs.forEach(function (o) { try { o.destroy(); } catch (e) {} });
      this._objs = [];
      this._scrolls = [];
    }
    _go(p) { if (p < 0 || p > 4 || p === this._page) return; this._page = p; this._clear(); this._render(); }

    /* ---------- 统计 ---------- */
    _stats() {
      const A = this._log.answers || [];
      let ok = 0, combo = 0, maxc = 0;
      const byQuiz = {}, byEnemy = {};
      A.forEach(function (a) {
        if (a.ok) { ok++; combo++; if (combo > maxc) maxc = combo; } else combo = 0;
        const q = a.quiz || '';
        if (!byQuiz[q]) byQuiz[q] = { n: 0, ok: 0 };
        byQuiz[q].n++; if (a.ok) byQuiz[q].ok++;
        /* ★★★ 分组键 ＝ **敌人名 ＋ 层号**（2026-09-26 修）
         *   原来只按 `a.enemy` 分组 ✗ → 同名敌人跨层出现时会被**合并成一行** ✓
         *     而且 `f: a.floor` 记的是**第一次**遇到时的层号 → 显示成"第 N 层 · M 题" ✓
         *     其中 M 含了别的层的题 ✓（数字对不上 ✓）
         *   ★ 当前三层阵容里敌人名都唯一 ✓ 所以**暂时看不出问题** ✓ 但这是颗雷
         *     （例：以后把「萨卡兹宿主卫巢百夫长」从二层挪到三层 ✓）→ 现在就修掉 ✓ */
        const _ek = a.enemy + '\u0000' + (a.floor || 0);
        if (!byEnemy[_ek]) byEnemy[_ek] = { n: 0, ok: 0, f: a.floor, name: a.enemy, words: [] };
        byEnemy[_ek].n++;
        if (a.ok) { byEnemy[_ek].ok++; if (a.en && byEnemy[_ek].words.length < 12) byEnemy[_ek].words.push(a.en); }   // ★ 空词不入列表 ✓
      });
      return {
        ok: ok, bad: A.length - ok,
        rate: Math.round(ok / Math.max(1, A.length) * 100),
        maxc: maxc || (this._log.maxCombo || 0),
        byQuiz: byQuiz, byEnemy: byEnemy,
      };
    }

    /* ---------- 可滚动区（＝预览页 1:1：裁剪 + 位移 + 自绘滑块 ✓） ---------- */
    _scroller(x, y, w, h, total, build) {
      const s = this._sc;
      const group = this.add.container(0, 0);
      const inner = this.add.container(0, 0);
      group.add(inner);
      build(inner);
      /* ★ GeometryMask：Phaser 原生裁剪 ✓（等价于预览页的 overflow:hidden ✓） */
      const g = this.make.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(this._S(x), this._S(y), this._S(w), this._S(h));
      inner.setMask(g.createGeometryMask());
      this._add(group);
      this._add(g);
      const sc = { x: this._S(x), y: this._S(y), w: this._S(w), h: this._S(h), total: this._S(total), off: 0, inner: inner, y0: this._S(y), gfx: g };
      if (total > h) {
        /* 轨道 1×s ＋ 滑块 5×s ✓ 悬停变墨 ✓ */
        const track = this._rect(x + w + 14, y, 1, h, 0xe6e6e6);
        const th = this._rect(x + w + 12, y, 5, Math.max(28, h * h / total), 0xc9c8c2);
        th.setInteractive({ useHandCursor: true });
        th.on('pointerover', function () { th.setFillStyle(0x111111); });
        th.on('pointerout', function () { th.setFillStyle(0xc9c8c2); });
        /* ★★ 滑块**可拖动** ✗✗（2026-09-30 补 —— 原来只 setInteractive、没绑拖动 ✓
         *   所以滑块"看着能点、拖不动" ✓ 是个半成品 ✓）
         *   ★ 拖动＝按 y 位移反推 off ✓（不要累加 delta ✗ 那样会漂 ✓）
         *     `span` ＝ 轨道可用高度 ✓ `deltaOff` ＝ 位移 / span × 可滚范围 ✓ */
        th.on('pointerdown', function (p) {
          sc.dragY = p.y;
          sc.dragOff = sc.off;
        });
        th.on('pointermove', function (p) {
          if (sc.dragY == null) return;
          const span = Math.max(1, sc.trackH - th.height);
          const range = Math.max(0, sc.total - sc.h);
          sc.off = Math.max(0, Math.min(range, sc.dragOff + (p.y - sc.dragY) / span * range));
          this._applyScroll(sc);
        }, this);
        const endDrag = function () { sc.dragY = null; };
        th.on('pointerup', endDrag);
        th.on('pointerout', endDrag);
        sc.thumb = th; sc.trackY = this._S(y); sc.trackH = this._S(h);
        this._scrolls.push(sc);
      }
      return sc;
    }
    _applyScroll(sc) {
      sc.inner.y = -sc.off;
      if (!sc.thumb) return;
      const th = sc.thumb.height, span = sc.trackH - th;
      sc.thumb.y = sc.trackY + (sc.total > sc.h ? Math.round(span * (sc.off / (sc.total - sc.h))) : 0);
    }

    /* 把「换行文本」放进滚动容器（坐标相对滚动区左上角 ✓ 与 mk 同口径 ✓） */
    _into(inner, bx, by, x, y, w, str, opt) {
      const t = this.add.text(bx + this._S(x), by + this._S(y), String(str == null ? '' : str), {
        fontFamily: (opt && opt.font) || Babel.FONTS.body,
        fontSize: this._S((opt && opt.size) || 16) + 'px',
        color: (opt && opt.color) || '#111111',
        wordWrap: { width: Math.max(24, this._S(w)), useAdvancedWrap: true },
        lineSpacing: this._S(5),
      });
      inner.add(t);
      return t;
    }

    /* ---------- 屏头（各屏共用 ✓） ---------- */
    _header() {
      this._txt(44, 20, 'BABEL RESONANCE · RUN SUMMARY', { font: Babel.FONTS.display, size: 11, color: '#6f6f6f' });
      this._hr(44, 38, 1192);
    }
    _pager() {
      const names = ['封卷', '战绩', '错题', '对题', '见闻'];
      const self = this;
      for (let i = 0; i < 5; i++) {
        const on = i === this._page;
        const box = this._rect(44 + i * 42, 666, 34, 30, on ? 0xffffff : 0xffffff, 1);
        box.setStrokeStyle(1, on ? 0x111111 : 0xe6e6e6);
        box.setInteractive({ useHandCursor: true });
        box.on('pointerup', function () { self._go(i); });
        this._txt(44 + i * 42 + 17, 681, String(i + 1), { size: 12, color: on ? '#111111' : '#6f6f6f', origin: [0.5, 0.5] });
      }
      this._txt(44 + 5 * 42 + 10, 673, names[this._page], { size: 12, color: '#6f6f6f' });
    }
    /* 屏 5 的两个按钮 ✓ */
    _actions() {
      const self = this;
      const mk = (x, label, primary, fn) => {
        const w = 132, h = 30;
        const b = this._rect(x - w, 666, w, h, 0xffffff);
        b.setStrokeStyle(1, 0x111111);
        b.setInteractive({ useHandCursor: true });
        b.on('pointerover', function () { b.setFillStyle(0xfff44f); });
        b.on('pointerout', function () { b.setFillStyle(0xffffff); });
        b.on('pointerup', fn);
        this._txt(x - w / 2, 681, label, { size: 13, origin: [0.5, 0.5] });
      };
      mk(1236, '继续', true, function () { self._leave(); });
    }
    /* 离开总结：win/lose → 结尾屏（原有结尾文案照旧 ✓）；quit → 直接回主菜单 ✓ */
    _leave() {
      const o = this._log.outcome;
      if (o === 'win' || o === 'lose') this.scene.start('End', { win: o === 'win' });
      else this.scene.start('Start');
    }

    /* ================= ① 封卷 ================= */
    _screen0() {
      this._header();
      const L = this._log;
      const o = L.outcome || 'quit';
      const word = o === 'win' ? ['语域', '贯通'] : (o === 'lose' ? ['残响', '未竟'] : ['中途', '搁笔']);
      const say = o === 'win'
        ? '你走完了回声与回响。档案馆把你的名字收进了这一册——\n这一趟，你是被记住的那一个。'
        : (o === 'lose'
          ? '你的声音在语域里散了。档案馆收回了这一卷，\n另留一页空白，等你再来写。'
          : '你在中途停了笔。档案馆不催人，\n只把它按原样收好——写过的，都算数。');
      const t = this._txt(44, 76, word[0], { size: 46, origin: [0, 0] });
      const t2 = Babel.UI.text(this, this._S(44) + t.width, this._S(78), word[1], {
        font: Babel.FONTS.body, size: this._S(46) + 'px', color: '#e2231a', origin: [0, 0],
      });
      this._add(t2);
      this._txt(46, 138, '第 ' + (Babel.RunState.floor || 1) + ' 层　' + this._floorName(), { size: 15, color: '#6f6f6f' });
      this._txt(44, 172, say, { size: 16, color: '#3f4145' });

      const secs = Babel.RunState.fmtElapsed ? Babel.RunState.fmtElapsed() : '0:00';
      const rows = [
        ['本局用时', secs],
        ['残页', String(Babel.RunState.currency)],
        ['目标生命', Babel.RunState.targetHP + ' / ' + Babel.RunState.maxHP],
        ['藏品', ((Babel.RunState.ownedCollectibles || []).length) + ' 件'],
      ];
      rows.forEach((r, i) => {
        const y = 292 + i * 46;
        this._txt(44, y + 9, r[0], { size: 14, color: '#6f6f6f' });
        this._txt(180, y + 2, r[1], { font: Babel.FONTS.num, size: 22 });
        this._hr(44, y + 38, 1192);
      });
      this._txt(44, 510, '点下方数字或按 ← → 翻屏', { size: 13, color: '#6f6f6f' });
      this._pager();
    }
    _floorName() {
      try { const f = (Babel.FLOORS || [])[(Babel.RunState.floor || 1) - 1]; return f ? f.name : ''; } catch (e) { return ''; }
    }

    /* ================= ② 战绩 ================= */
    _screen1() {
      this._header();
      const st = this._st;
      this._txt(44, 62, '战绩', { size: 34, bold: true });
      this._txt(44, 116, String(st.rate), { font: Babel.FONTS.num, size: 76 });
      this._txt(226, 176, '%　正确率', { size: 15, color: '#6f6f6f' });
      this._txt(44, 222, '答对 ' + st.ok + ' ／ 答错 ' + st.bad, { size: 16 });
      this._txt(44, 254, '最长连对 ' + st.maxc, { size: 16 });
      this._hr(44, 298, 560);
      this._txt(44, 312, '按作答形式', { size: 14, color: '#6f6f6f' });
      /* ★ `link` ＝ 圣徒「连线」（2026-09-26 加 ✗ 以前记成 '' → 显示「四选一」✓ 是错的 ✓）*/
      const qn = { '': '四选一', anagram: '拼词', maskless: '无面者拼词', rail: '轨道接字母', link: '圣徒连线' };
      let y = 348;
      ['', 'anagram', 'maskless', 'rail', 'link'].forEach((k) => {
        const v = st.byQuiz[k];
        if (!v && k !== '') return;
        const pct = v ? Math.round(v.ok / v.n * 100) : 0;
        this._txt(44, y + 7, qn[k], { size: 14 });
        this._txt(164, y + 8, v ? v.n + ' 题' : '—', { size: 12, color: '#6f6f6f' });
        this._rect(250, y + 13, 180, 5, 0xefefef);
        if (v) this._rect(250, y + 13, 180 * pct / 100, 5, 0x111111);
        this._txt(444, y + 6, v ? pct + '%' : '—', { font: Babel.FONTS.num, size: 14 });
        this._hr(44, y + 44, 560);
        y += 44;
      });
      /* 右栏：按战斗（可滚 ✓） */
      this._hr(660, 116, 576);
      this._txt(660, 130, '按战斗', { size: 14, color: '#6f6f6f' });
      const keys = Object.keys(st.byEnemy);
      const total = keys.length * 54 + 4;   // ★ 行高 54（名称可折行 ✓）
      this._scroller(660, 166, 576, 456, total, (inner) => {
        let yy = 0;
        keys.forEach((k) => {
          const v = st.byEnemy[k], pct = Math.round(v.ok / v.n * 100);
          const base = this._S(166);
          const mk = (x, y2, w, str, opt) => {
            const o = Babel.UI.text(this, this._S(660) + this._S(x), base + this._S(y2), str, Object.assign({
              font: Babel.FONTS.body, size: this._S((opt && opt.size) || 14) + 'px', origin: [0, 0],
            }, opt || {}));
            inner.add(o); return o;
          };
          mk(0, yy + 12, 290, v.name || k, { size: 16 });   // ★ 显示 `name` ✗ 不是分组键（键里含层号 \u0000 ✓）
          mk(296, yy + 12, 130, '第 ' + v.f + ' 层 · ' + v.n + ' 题', { size: 13, color: '#6f6f6f' });
          mk(420, yy + 9, 90, pct + '%', { font: Babel.FONTS.num, size: 18, color: pct === 100 ? '#111111' : '#e2231a' });
          const ln = this.add.rectangle(this._S(660), base + this._S(yy + 53), this._S(576), Math.max(1, this._S(1)), 0xe6e6e6).setOrigin(0, 0);
          inner.add(ln);
          yy += 54;
        });
      });
      this._pager();
    }

    /* ================= ③ 错题（四列 ✓ 按战斗分组 ✓ 可滚 ✓） ================= */
    _screen2() {
      this._header();
      const A = (this._log.answers || []).filter((a) => !a.ok);
      this._txt(44, 62, 'WRONG ANSWERS', { font: Babel.FONTS.display, size: 12, color: '#6f6f6f' });
      this._txt(44, 80, '错题 ' + A.length + ' 道', { size: 34, bold: true });
      this._txt(44, 132, '被划掉的那几行，才是这一趟真正的收获。', { size: 16, color: '#3f4145' });
      this._hr(44, 166, 1192);
      this._txt(this.COL.en, 174, '英文词', { size: 14, color: '#6f6f6f' });
      this._txt(this.COL.zh, 174, '中文释义', { size: 14, color: '#6f6f6f' });
      this._txt(this.COL.your, 174, '你的作答', { size: 14, color: '#6f6f6f' });
      this._txt(this.COL.src, 174, '出处', { size: 14, color: '#6f6f6f' });
      this._hr(44, 198, 1192);
      const qn = { '': '四选一', anagram: '拼词', maskless: '无面者拼词', rail: '轨道接字母', link: '圣徒连线' };
      const byE = {};
      A.forEach((a) => { (byE[a.enemy] = byE[a.enemy] || []).push(a); });
      const keys = Object.keys(byE);
      /* ★★★ 行高**按实测算** ✗✗（2026-09-30 修"词挤在一起 / 折行压住下一行"）
       *   病因：原来 `total += 32 + n * 58` ＋ `yy += 58` ✗ —— **两条都写死 58** ✓
       *     而一行的真实高度由**最高的那一列**决定 ✓
       *     `src`（出处）那列遇到长敌人名会折到 2~3 行 ✓ → 18+15+15 ＝ 48 还行 ✓
       *     但 `en`（英文词，19px 混排）或 `zh` 遇到长中文也会折 ✓
       *     → 3 行时约 16×3+5×2 = 58 ✓ **正好卡在边界** ✓ 再加行距就压住下一行 ✓
       *   ⇒ 先逐行算高 ✓ 再累加成 total ✓ 绘制时用同一组高度 ✓（**同一份数据画两遍 ✗ 别各算一套** ✓）*/
      /* ★★★ 字号整体放大 ✗✗（2026-09-30 用户："还不如原来的 我的意思是大一点，
       *   打不了用滚轮翻页"）
       *   ★ 我上一版搞错了方向 ✗ —— 我做的是"行高按实测、列宽放宽" ✓
       *     那解决的是**重叠** ✓ 完全没解决他说的"大一点" ✓
       *     而屏 3 那列词表原本只有 **13px** ✗ 截图里小到几乎读不清 ✓
       *   ★ 现在：**统一放大一号** ✗ 字大了 → 内容变高 → 正好用滚轮 ✓（两件事是一体的 ✓）
       *     英文词 19 → **22** ／ 中文 16 → **18** ／ 作答 16 → **18** ／ 出处 13 → **15** ✓ */
      /* ★★★ 与屏 3 同一套自适应字号 ✗✗（2026-09-30 用户："不要强求在一页上…
       *   可以动态调整最优化大小，大不了多的时候直接下滑，字不要太小"）
       *   见屏 3 的详细注释 ✓ 这里是**同一算法、各自算自己的上限** ✓
       *   ★ 两屏内容不同（错题常带长"作答"列 ✓）→ **各算各的** ✗ 不要共用一个字号 ✓ */
      /* ★★ 实测（截图那一局的 8 组）：字号 24 → 总高 970 ／ 20 → 700 ／ 16 → 535
       *   可视 432 ✗ → 8 组时**放不下** → 走滚动 ✓ 内容少时字会自己变大 ✓ */
      const F_MAX = 24, F_MIN = 16;
      const D_EN = 2, D_ZH = 0, D_YOUR = 0, D_SRC = -3;   // 各列相对基准字号的偏移 ✓
      const LINE_LEAD = 7;
      const ROW_PAD = 12;
      const VIEW_H = 432;                                 // 与下面 `_scroller` 的 h 一致 ✓
      const self = this;
      /* ★★ 列宽也要随字号走 ✗✗ —— 字号变大而列宽不变 → 折行暴增 → 行数暴涨 ✗
       *   实测：字号 26 时总高 1092 ✓ 其中很大一部分是**折行撑出来的** ✓
       *   ★ 口径：**"自适应字号"必须连列宽一起自适应** ✗
       *     否则"放大字号"会撞上"列宽固定"这堵墙 ✓ 反而更糟 ✓
       *   `COL.en` 等是列**起点**（横向位置 ✓ 不变 ✓）
       *   这里只把每列的**可用宽度**按字号比例放大 ✓ 上限不超过下一列的起点 ✓ */
      const COLW = (() => {
        const c = this.COL;
        return { en: c.zh - c.en - 4, zh: c.your - c.zh - 4, your: c.src - c.your - 4, src: 1188 - c.src };
      })();
      function calcRows(size) {
        const F_EN = size + D_EN, F_ZH = size + D_ZH, F_YOUR = size + D_YOUR, F_SRC = Math.max(11, size + D_SRC);
        /* ★ 列宽按字号比例放大 ✗ 基准字号 16 ✓（16px 时正好用满原列宽 ✓）*/
        const k = Math.max(1, size / 16);
        const W_EN = Math.min(COLW.en + 40, COLW.en * k);
        const W_ZH = Math.min(COLW.zh + 40, COLW.zh * k);
        const W_YOUR = Math.min(COLW.your + 40, COLW.your * k);
        const W_SRC = Math.min(COLW.src + 60, COLW.src * k);
        const rh = {};
        let tt = 0;
        keys.forEach((k2) => {
          rh[k2] = byE[k2].map((a) => {
            const your = (a.your && a.your.length) ? a.your : '（未拼出）';
            const srcStr = '第 ' + a.floor + ' 层 · ' + a.enemy + ' · ' + (qn[a.quiz || ''] || '四选一');
            const h = Math.max(
              self._estH(a.en, W_EN, F_EN),        // 英文词（mixed ✓）
              self._estH(a.zh, W_ZH, F_ZH),        // 中文释义
              self._estH(your, W_YOUR, F_YOUR),    // 你的作答（your 列收窄了 ✓）
              self._estH(srcStr, W_SRC, F_SRC)     // 出处
            );
            return Math.max(48, h + LINE_LEAD + ROW_PAD);
          });
          tt += 34 + rh[k2].reduce((x, y) => x + y, 0) + 12;
        });
        return { rh: rh, tt: tt, sheet: { EN: F_EN, ZH: F_ZH, YOUR: F_YOUR, SRC: F_SRC, WEN: W_EN, WZH: W_ZH, WYOUR: W_YOUR, WSRC: W_SRC } };
      }
      let F_BASE = F_MIN, rowH = {}, total = 0, Fs = null, shrunk = true;
      for (let sz = F_MAX; sz >= F_MIN; sz--) {
        const r = calcRows(sz);
        F_BASE = sz; rowH = r.rh; total = r.tt; Fs = r.sheet;
        if (r.tt <= VIEW_H) { shrunk = false; break; }
      }
      const F_EN = Fs.EN, F_ZH = Fs.ZH, F_YOUR = Fs.YOUR, F_SRC = Fs.SRC;
      const W_EN = Fs.WEN, W_ZH = Fs.WZH, W_YOUR = Fs.WYOUR, W_SRC = Fs.WSRC;
      try {
        console.log('[Summary] 屏2 基准字号=' + F_BASE + ' ／ ' +
                    (shrunk ? '缩到下限仍超一屏 → **启用滚动**' : '一屏放得下') +
                    ' ／ 总高 ' + Math.round(total) + ' vs 可视 ' + VIEW_H);
      } catch (e) {}
      this._scroller(44, 206, 1192, VIEW_H, Math.max(total, 1), (inner) => {
        const bx = this._S(44), by = this._S(206);
        let yy = 0;
        const mk = (x, y2, str, opt) => {
          const o = Babel.UI.text(this, bx + this._S(x), by + this._S(y2), str, Object.assign({
            font: Babel.FONTS.body, size: this._S((opt && opt.size) || 14) + 'px', origin: [0, 0], color: '#111111',
          }, opt || {}));
          inner.add(o); return o;
        };
        const bar = (y2, w, color) => {
          const o = this.add.rectangle(bx, by + this._S(y2), this._S(w), Math.max(1, this._S(1)), color).setOrigin(0, 0);
          inner.add(o); return o;
        };
        keys.forEach((k, ki) => {
          /* ★ 分组头也加强 ✗（用户："划分不清晰"）
           *   原来只是一行 `── 名 ──` 小灰字 ✗ 与数据行同灰度 ✓ 分不出"这是组标题" ✓
           *   → 字号加大 + 加粗 + 深色 ✓ 并在下面压一条**实线** ✓ */
          mk(0, yy - 2, '── ' + k + ' ──', { size: 15, color: '#111111', bold: true });
          bar(yy + 17, 1192, 0xbfbab0);
          yy += 34;
          byE[k].forEach((a, ai) => {
            const H = rowH[k][ai];              // ★ 用**上面算好的那一份** ✗ 别在这里另算一遍 ✓
            /* ★ y 偏移随字号走 ✗（`LINE_LEAD/2` 是上伸部余量 ✓ 与行高算式同源 ✓）*/
            const yTxt = Math.round(LINE_LEAD / 2) + 2;
            /* ★ 交替底色（与屏 3 同一手法 ✓ 给每行一个"面" ✓ 这才是划分的主力 ✓）*/
            if (ai % 2 === 0) {
              const zb = this.add.rectangle(bx, by + this._S(yy), this._S(1192), this._S(H), 0xf6f6f4).setOrigin(0, 0);
              inner.add(zb);
            }
            mk(this.COL.mark, yy + yTxt - 1, '✗', { size: Math.max(14, F_EN - 3), color: '#e2231a' });
            this._into(inner, bx, by, this.COL.en, yy + yTxt, W_EN, a.en, { font: Babel.FONTS.mixed, size: F_EN });
            this._into(inner, bx, by, this.COL.zh, yy + yTxt + 2, W_ZH, a.zh, { size: F_ZH });
            const your = (a.your && a.your.length) ? a.your : '（未拼出）';
            const isLatin = /^[\x00-\x7F]+$/.test(a.your || '');
            this._into(inner, bx, by, this.COL.your, yy + yTxt + 2, W_YOUR, your, { font: isLatin ? Babel.FONTS.mixed : Babel.FONTS.body, size: F_YOUR, color: '#e2231a' });
            this._into(inner, bx, by, this.COL.src, yy + yTxt + 4, W_SRC, '第 ' + a.floor + ' 层 · ' + a.enemy + ' · ' + (qn[a.quiz || ''] || '四选一'), { size: F_SRC, color: '#6f6f6f' });
            /* ★ 行间线加深加粗 ✗（原来 `0xf2f2f2` 几乎不可见 ✓ 与屏 3 统一口径 ✓）*/
            bar(yy + H - 1, 1192, 0xd2cec6);
            yy += H;
          });
          yy += 10;
        });
        if (!keys.length) mk(26, 8, '这一局没有错题。', { size: 15, color: '#3f4145' });
      });
      this._pager();
    }

    /* ================= ④ 对题（按战斗折叠 ✓ 可滚 ✓） ================= */
    _screen3() {
      this._header();
      const st = this._st;
      this._txt(44, 62, 'CORRECT ANSWERS', { font: Babel.FONTS.display, size: 12, color: '#6f6f6f' });
      this._txt(44, 80, '对题 ' + st.ok + ' 道', { size: 34, bold: true });
      this._txt(44, 132, '笔迹稳定。这些词，你已经记住了。', { size: 16, color: '#3f4145' });
      this._hr(44, 166, 1192);
      const keys = Object.keys(st.byEnemy);
      /* ★★★ 自适应字号 ✗✗（2026-09-30 用户："我的意思是正确的词这一面不要强求在一页上，
       *   可以动态调整最优化大小，大不了多的时候直接下滑，字不要太小"）
       *   ★ 我前两版都理解错了方向 ✗：
       *     ① 先做"行高按实测"→ 解决的是**重叠** ✓ 但字还是 13px 那么小 ✗
       *     ② 再做"字号固定放大到 16" → 字大了一点 ✓ 但**没考虑"放不下就滚"** ✗
       *   ★ 用户真正要的是：**字优先大** ✗ 一屏放不下就滚 ✓ 别为了塞进一屏而缩字 ✓
       *   ⇒ 算法（两段式 ✓）：
       *     ① **先按大写**（`F_MAX` 起，逐档 −1）找"能一屏放下"的最大字号 ✓
       *     ② 缩到 `F_MIN` 仍放不下 → **就用 `F_MIN` 并交给滚轮** ✗（不再继续缩 ✓）
       *   ★ 为什么必须设 `F_MIN` 下限 ✗：
       *     纯"最优"会把 30 行内容缩到 6px 也要塞进一屏 ✓ 那正是用户不要的 ✓
       *     到下限就**转为滚动** ✓ 这才是"多的时候直接下滑" ✓
       *   ★ 这个模式**屏 2 也照用** ✗（两屏结构相同 ✓ 口径要一致 ✓）*/
      /* ★★ 实测（用截图那一局的 8 组数据算 ✓）：
       *     字号 26 → 总高 1092 ／ 24 → 970 ／ 20 → 700 ／ 18 → 606 ／ 16 → 535 ／ 15 → 496
       *     可视只有 **434** ✗ → 8 组时**任何字号都放不下** ✓ → 必然走滚动 ✓
       *     3 组时 → **26 放得下** ✓ 字自动变大 ✓
       *   ⇒ `F_MIN` 取 **16** ✗ 不低于原来那个固定值 ✓ 符合"字不要太小" ✓ */
      const F_MAX = 26, F_MIN = 16;        // 字号上下限（不越界取值 ✓）
      const NAME_RATIO = 1.12;             // 敌人名比词表大一号 ✓
      const META_RATIO = 0.88;             // 层号/战绩小一号 ✓
      const VIEW_H = 434;                  // 可视高（设计像素 ✓ 与 `_scroller` 一致 ✓）
      const LEAD = 7, PAD = 10;
      const self = this;
      /* ★ 注意：`self` 必须在**用到它的函数之前**定义 ✗（TDZ ✓ 我第一版写反了 ✓）*/
      function rowHAt(size) {
        return keys.map((k) => {
          const v = st.byEnemy[k];
          const h = Math.max(
            self._estH(k, 380, Math.round(size * NAME_RATIO)),
            self._estH(v.words.join(' · '), 420, size)
          );
          return Math.max(48, h + LEAD + PAD);
        });
      }
      let F_WORDS = F_MIN, rowH = rowHAt(F_MIN), total = rowH.reduce((x, y) => x + y, 0) + 4, shrunk = true;
      for (let sz = F_MAX; sz >= F_MIN; sz--) {
        const rh = rowHAt(sz), tt = rh.reduce((x, y) => x + y, 0) + 4;
        F_WORDS = sz; rowH = rh; total = tt;
        if (tt <= VIEW_H) { shrunk = false; break; }   // ★ 找到"一屏放得下"的最大字号 ✓
      }
      const F_NAME = Math.round(F_WORDS * NAME_RATIO);
      const F_META = Math.round(F_WORDS * META_RATIO);
      try {
        console.log('[Summary] 屏3 字号=' + F_WORDS + ' 名=' + F_NAME + ' 元=' + F_META +
                    ' ／ ' + (shrunk ? '缩到下限仍超一屏 → **启用滚动**' : '一屏放得下') +
                    ' ／ 总高 ' + Math.round(total) + ' vs 可视 ' + VIEW_H);
      } catch (e) {}
      this._scroller(44, 182, 1192, VIEW_H, total, (inner) => {
        const bx = this._S(44), by = this._S(182);
        let yy = 0;
        /* ★★★ 划分与美观 ✗✗（2026-09-30 用户："1.划分不清晰 2. 美观一点"）
         *   病因（三条 ✓ 都是"看着糊成一团"）
         *     ① **行间只有 1px 浅灰线** ✗（`0xe6e6e6` ✓ 在白底上几乎看不见 ✓）
         *        → 长词表折 2~4 行时，相邻两组的词**连成一片** ✓ 分不清哪行属于谁 ✓
         *     ② **完全没有行距层次** ✗ 所有信息一个字号一个灰度 ✓
         *     ③ 词表被 `·` 串成一长条 ✗ 读起来是"一坨字" ✓
         *   ⇒ 改法（不动数据 ✓ 只动版式 ✓）：
         *     · **整行交替底色**（斑马纹 ✓）—— 这是"划分"最直接的手段 ✓
         *       比加粗线更有效 ✓ 因为它给每一行一个**面** ✓ 而不是一条线 ✓
         *     · 行间线从 `0xe6e6e6` 加深到 `0xd8d8d4` ✓ 并加粗到 1.5px 的观感 ✓
         *     · 词表加**左侧竖线**（像词典的例句栏 ✓）→ 一眼看出"这块是词" ✓
         *     · 组名加**下划线式分组头** ✓ 与数据行拉开层次 ✓
         *   ★ 口径：**"划分不清"优先用"面"（底色）而不是"线"** ✗✗
         *     线是 1px ✓ 底色是整行 ✓ 后者的分离度强一个数量级 ✓ */
        /* 斑马纹：画在**文字之下** ✗ 所以先铺底再写字 ✓（Phaser 按加入顺序叠 ✓）*/
        const drawZebra = (y0, h, on) => {
          if (!on) return;
          const o = this.add.rectangle(bx, by + this._S(y0), this._S(1192), this._S(h), 0xf6f6f4)
            .setOrigin(0, 0);
          inner.add(o);
          o.setDepth(0);
        };
        keys.forEach((k, ki) => {
          const v = st.byEnemy[k], miss = v.n - v.ok;
          const H = rowH[ki];                 // ★ 同一份 ✓
          const mk = (x, y2, str, opt) => {
            const o = Babel.UI.text(this, bx + this._S(x), by + this._S(y2), str, Object.assign({
              font: Babel.FONTS.body, size: this._S((opt && opt.size) || 14) + 'px', origin: [0, 0], color: '#111111',
            }, opt || {}));
            inner.add(o); return o;
          };
          /* ★ 各列 y 偏移随字号走 ✗ —— 字号是自适应的 ✓ 写死 12/13/14 会让大字贴顶、小字悬空 ✓
           *   `LEAD/2` 是字体的上伸部余量 ✓ 与行高算式同源 ✓ */
          const yTxt = Math.round(LEAD / 2) + 2;
          /* ★ 交替底色（偶数行铺）✗ 给每行一个"面" ✓ */
          drawZebra(yy, H, (ki % 2 === 0));
          mk(0, yy + yTxt + 1, '✓', { size: Math.max(14, F_WORDS - 2), color: '#2f7d3a' });
          this._into(inner, bx, by, 26, yy + yTxt, 380, k, { size: F_NAME, color: '#111111' });
          mk(430, yy + yTxt + 2, '第 ' + v.f + ' 层', { size: F_META, color: '#6f6f6f' });
          mk(560, yy + yTxt + 2, v.ok + ' 题 · ' + (miss ? miss + ' 错' : '全对'), { size: F_META, color: miss ? '#e2231a' : '#6f6f6f' });
          /* ★ 词表：加**左侧竖线** ✗（像词典例句栏 ✓ 一眼看出"这块是词" ✓）
           *   线就画在词表文本的左边缘再往左 12px ✓ 高度＝这一行的净高 ✓ */
          const wTop = yy + yTxt - 3, wH = H - (yTxt - 3) - 8;
          const vl = this.add.rectangle(bx + this._S(788), by + this._S(wTop), Math.max(1, this._S(2)),
                                        this._S(Math.max(8, wH)), 0xdedad2).setOrigin(0, 0);
          inner.add(vl);
          /* ★ 词表**自动换行**（不再截断 ✓ 用户要求「一定要显示全」✓）
           *   ★ 宽度 358 → **420** ✗（与屏 2 的 src 列同宽 ✓ 折行更少 ✓ 词不再挤 ✓）
           *   ★ 字号 `F_WORDS` 现在是**自适应**的 ✓ 见上面的两段式算法 ✓ 字优先大 ✓ */
          this._into(inner, bx, by, 800, yy + yTxt, 420, v.words.join(' · '), { font: Babel.FONTS.mixed, size: F_WORDS, color: '#8e9298' });
          /* ★★ 行间分隔线 ✗✗（2026-09-30 用户："划分不清晰"）
           *   ★ 原来只有 `0xe6e6e6` 的 **1px** 浅灰 ✗ 白底上几乎看不见 ✓
           *     词表折 2~4 行时相邻两组就连成一片 ✓ 分不清哪行属于谁 ✓
           *   ⇒ 两处加强 ✗：
           *     ① 颜色 `0xe6e6e6` → **`0xd2cec6`**（暖灰 ✓ 与纸白同族但看得见 ✓）
           *     ② 线宽 1 → **2**（设计像素 ✓ 高清屏上更实 ✓）
           *   ★ 但**光靠线不够** ✗ —— 真正把行分开的是上面那条**交替底色** ✓
           *     线只是"收边" ✓ 底色才是"给面" ✓ 两者配合才叫划分清楚 ✓ */
          const ln = this.add.rectangle(bx, by + this._S(yy + H - 1), this._S(1192),
                                        Math.max(1, this._S(1.5)), 0xd2cec6).setOrigin(0, 0);
          inner.add(ln);
          yy += H;
        });
      });
      this._pager();
    }

    /* ================= ⑤ 见闻（路线 / 藏品 / 账目 ✓ 可滚 ✓） ================= */
    _screen4() {
      this._header();
      const L = this._log;
      this._txt(44, 62, 'FIELD NOTES', { font: Babel.FONTS.display, size: 12, color: '#6f6f6f' });
      this._txt(44, 80, '见闻', { size: 34, bold: true });
      this._txt(44, 132, '这一趟你走过的地方，和你留下的东西。', { size: 16, color: '#3f4145' });
      this._hr(44, 166, 1192);
      const nameOf = (id) => { try { const c = Babel.FindCollectible(id); return c ? c.name : id; } catch (e) { return id; } };
      const nodes = L.nodes || [], gained = L.gained || [], traded = L.tradedOut || [];
      /* ★★★ 藏品/机制贡献（2026-09-26 新增 ✓ 数据来自 `RunState.logStats` 的整局累计）
       *   ★ 口径：**只列真的发生过的** ✗ —— 全 0 就整块不出现 ✓（不刷一堆 0 ✓）
       *   ★ 行文案与战斗结算栏**同一套措辞** ✓（两处看到的词一样 ✓）*/
      const ST = (L.stats && typeof L.stats === 'object') ? L.stats : {};
      const f1 = (n) => (Babel.fmt1 ? Babel.fmt1(n) : String(n));
      const statRows = [];
      if (ST.sealDmg > 0.005) statRows.push('铁络之印  答错反打 ' + f1(ST.sealDmg) + ' 伤害');
      if (ST.jianko > 0) statRows.push('缄口  挡下 ' + ST.jianko + ' 次受击');
      if (ST.milShield > 0 || ST.milTurns > 0) {
        let t = '军用斯安威斯坦';
        if (ST.milShield > 0) t += '  +' + ST.milShield + ' 盾';
        if (ST.milTurns > 0) t += (ST.milShield > 0 ? '，' : '  ') + '残血增伤 ' + ST.milTurns + ' 题';
        statRows.push(t);
      }
      if (ST.ringBreak > 0) statRows.push('圣环  破碎 ' + ST.ringBreak + ' 次');
      if (ST.fireOut > 0 || ST.fireBoom > 0) {
        let t = '尼卢火';
        if (ST.fireOut > 0) t += '  治灭 ' + ST.fireOut + ' 朵';
        if (ST.fireBoom > 0) t += (ST.fireOut > 0 ? '，' : '  ') + '烧尽 ' + ST.fireBoom + ' 朵';
        statRows.push(t);
      }
      if (ST.bonusTime > 0.005) statRows.push('加时藏品  实际 +' + f1(ST.bonusTime) + ' 秒');
      /* ★★★ 高度改成**逐行实测** ✗✗（2026-09-30 用户："最后一页拉不到底了"）
       *   病因：这里是**写死算式**（猜每块几行 ✓）✗
       *     `total += 38 + 34 + 34 + 20;`   ← 藏品猜「两行」✗
       *     `total += 38 + 34 + 10 + 38;`   ← 账目猜「一行 + 收束句一行」✗
       *   但实测：
       *     · 藏品「获得 10 件：巨力之页 → 默念 → …」**折 2 行** ✓
       *     · 收束句「这一册到此为止。要再走一趟…」**折 2 行** ✓
       *   → `total` 比真实内容矮 ✗ → `_scroller` 的 `range = total - h` 偏小 ✓
       *     滚到底仍有内容在视口下方 ✓ 就是"拉不到底"✓
       *   ★★ 口径（本轮**第三次**同一个教训 ✗）：
       *     **只要内容是变长的，高度就必须实测** ✗✗ 不能猜 ✓
       *     屏 2 / 屏 3 已经改成实测 ✓ 屏 4 漏了 ✓（这就是漏网的那块 ✓）
       *   ⇒ 做法：把绘制时的每一行**先算高、再累加** ✗
       *     并让 `total` 与绘制**共用同一份行高表** ✓（与屏 2/3 同源 ✓）*/
      const LINES = [];                       // { str, size, gap, opt } —— 逐行描述
      const push = (str, size, gap, opt) => LINES.push({ str: str, size: size, gap: (gap == null ? 0 : gap), opt: opt || {} });
      push('── 路线 ──', 12, 22, { color: '#6f6f6f' });
      {
        let lastF2 = 0;
        nodes.forEach((n) => {
          if (n.floor !== lastF2) { lastF2 = n.floor; push('· 第 ' + n.floor + ' 层', 12, 22, { color: '#6f6f6f' }); }
          push('　' + n.title, 16, 18);
        });
        push('', 16, 16);                     // 路线块尾留白 ✓
      }
      if (statRows.length) {
        push('── 战绩 ──', 12, 22, { color: '#6f6f6f' });
        statRows.forEach((t) => push(t, 15, 19));
        push('', 15, 16);
      }
      push('── 藏品 ──', 12, 22, { color: '#6f6f6f' });
      push('获得 ' + gained.length + ' 件：' + gained.map((g) => nameOf(g.id)).join(' → '), 16, 18);
      push(traded.length ? ('换出 ' + traded.length + ' 件：' + traded.map(nameOf).join(' · ') + '（已放回池中，仍可获得）') : '换出 0 件：这一趟没有割舍。', 16, 26 + 16);
      push('── 账目 ──', 12, 22, { color: '#6f6f6f' });
      push('残页收入 ' + (L.earned || 0) + '　支出 ' + (L.spent || 0) + '　结余 ' + Babel.RunState.currency, 16, 26 + 10);
      push('这一册到此为止。要再走一趟，就从头开始；要留下错的那几行，档案馆替你收着。', 13, 12, { color: '#3f4145' });
      /* ★ 每行的高度＝文本实测高 ＋ 行后间隙 ✗（宽度取 1180 ✓ 内容宽 1192 减左右各 6 ✓）*/
      const LINE_W = 1180;
      const lineH = LINES.map((it) => this._estH(it.str, LINE_W, it.size || 16) + (it.gap || 0));
      const total = lineH.reduce((x, y) => x + y, 0);
      this._scroller(44, 182, 1192, 434, Math.max(total, 1), (inner) => {
        const bx = this._S(44), by = this._S(182);
        let yy = 0;
        const mk = (str, opt) => {
          const o = Babel.UI.text(this, bx + this._S(6), by + this._S(yy), str, Object.assign({
            font: Babel.FONTS.body, size: this._S((opt && opt.size) || 16) + 'px', origin: [0, 0], color: (opt && opt.color) || '#111111',
          }, opt || {}));
          inner.add(o); return o;
        };
        /* ★ 逐行渲染：用**同一份** lineH ✗ 不再各块自己 yy += 常量 ✓ */
        LINES.forEach((it, i) => {
          if (it.str && /^── /.test(it.str)) {
            /* 分组头：文字 + 一条细线（线的位置沿用原来的"标题下 12px"✓）*/
            mk(it.str, { size: it.size, color: (it.opt && it.opt.color) || '#6f6f6f' });
            const ln = this.add.rectangle(bx, by + this._S(yy + 12), this._S(1188), Math.max(1, this._S(1)), 0xe6e6e6).setOrigin(0, 0);
            inner.add(ln);
          } else if (it.str) {
            mk(it.str, { size: it.size, color: (it.opt && it.opt.color) || '#111111' });
          }
          yy += lineH[i];
        });
      });
      this._pager();
      this._actions();
    }

    _render() {
      const fns = [this._screen0, this._screen1, this._screen2, this._screen3, this._screen4];
      (fns[this._page] || this._screen0).call(this);
    }
  }

  Babel.Scenes = Babel.Scenes || {};
  Babel.Scenes.SummaryScene = SummaryScene;
})();
