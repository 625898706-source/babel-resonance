/* ============================================================================
 * wordbank.js —— 词库（英语词 + 中文选项）
 * ----------------------------------------------------------------------------
 * 【本文件作用】
 * 提供「英语词 → 4 个中文选项」的数据。这是词战的核心题库。
 * 每个词条包含：
 *   en          英文原词
 *   zh          正确中文释义
 *   distractors 3 个错误选项（尽量"形近 / 义近"，起到干扰与教学作用）
 *
 * 【分层结构】
 * _pools[层号][难度档] = 该层该难度的词条数组。
 * draw() 负责随机抽一个词并把 4 个选项打乱、返回正确下标。
 * ----------------------------------------------------------------------------
 * 【说明】
 * 这里是「数据」，刻意不依赖 Phaser，方便以后扩充、或用别的引擎读取。
 * ========================================================================== */

// 读取一遍常量，保证 Babel 对象存在（脚本按顺序加载，此时一定已存在）
window.Babel = window.Babel || {};

// 本地打乱数组（Fisher–Yates），避免依赖 Phaser，纯数据层可独立测试
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// 词库数据（第一层：名词语域，难度档 1 = 常用名词）
Babel.WORDBANK = {
  _pools: {
    1: {
      1: [
        { en: 'achievement', zh: '成就', distractors: ['获得', '实现', '攻击'] },
        { en: 'library',     zh: '图书馆', distractors: ['档案馆', '教室', '商店'] },
        { en: 'candle',      zh: '蜡烛', distractors: ['烛台', '火焰', '纸页'] },
        { en: 'knowledge',   zh: '知识', distractors: ['力量', '记忆', '书签'] },
        { en: 'language',    zh: '语言', distractors: ['字母', '声音', '语法'] },
        { en: 'memory',      zh: '记忆', distractors: ['遗忘', '影子', '梦想'] },
        { en: 'dictionary',  zh: '词典', distractors: ['百科', '目录', '书本'] },
        { en: 'ink',         zh: '墨水', distractors: ['墨迹', '纸张', '铅笔'] },
        { en: 'page',        zh: '书页', distractors: ['页面', '纸张', '章节'] },
        { en: 'archive',     zh: '档案馆', distractors: ['图书馆', '档案', '目录'] },
        { en: 'tower',       zh: '高塔', distractors: ['阁楼', '钟楼', '庭院'] },
        { en: 'mystery',     zh: '谜团', distractors: ['秘密', '谜语', '线索'] },
        { en: 'threshold',   zh: '门槛', distractors: ['边界', '顶端', '门扉'] },
        { en: 'scripture',   zh: '典籍', distractors: ['碑文', '经文', '档案'] },
      ],
    },
  },

  /* 从指定层的指定难度里随机抽一个词，返回：
   *   { en, options: [4 个中文], correctIndex }
   * 优先用「上海高考大纲词汇（约3500+）」大词库，自动从其它词的中文里取 3 个作干扰项。
   * accept(en, zh)：**可选**过滤器（不传＝行为完全不变）。幽影「静默回响」用它排除过短/
   *   字母种类太少的词（大词库里有 a / i / of / it 这类，拼出来毫无意义、进度位只剩一格）。 */
  /* ★ 第四参 n ＝ 选项个数（默认 4 ✓ 2026-09-21 为"六选一"加 ✓ 不传＝原行为 ✓ 其它敌人零影响 ✓）*/
  draw(floorId, difficulty, accept, n) {
    const N = (n === 6) ? 6 : 4;
    const big = Babel.GAOKAO_WORDS;
    const ok = (typeof accept === 'function') ? accept : null;
    // 本局已考过的词（普通库 + 拼词共用 usedWords；同库同模式不重复出题）
    let used = (Babel.RunState && Babel.RunState.usedWords) ? Babel.RunState.usedWords : [];
    if (big && big.length > 4) {
      // 剔除本库已考过的词
      let cand = big.filter(e => used.indexOf(e[0]) < 0);
      // 本库用尽 → 才允许从头再来（只清本库记录 usedWords，不影响专属 usedTrial）
      if (cand.length < Math.max(4, N)) {
        if (Babel.RunState) Babel.RunState.usedWords = [];
        used = [];
        cand = big.slice();
      }
      // 可选过滤（只影响传了 accept 的调用方）：过滤后候选太少就退回"过滤后的全集"，
      // 仍不足 4 条时才放弃过滤 → 保证一定会返回一个词，不会把出题卡死。
      if (ok) {
        let f = cand.filter(e => ok(e[0], e[1]));
        if (f.length < 4) f = big.filter(e => ok(e[0], e[1]));
        if (f.length >= 4) cand = f;
      }
      const entry = cand[Math.floor(Math.random() * cand.length)];
      const en = entry[0], zh = entry[1];
      // 记录本库已考
      if (Babel.RunState) Babel.RunState.usedWords.push(en);
      // 取 3 个不同的干扰中文（去重、且不同于正确项）
      const opts = new Set([zh]);
      let guard = 0;
      while (opts.size < N && guard < 90) {   // ★ N 由调用方决定（4 或 6 ✓）
        const o = cand[Math.floor(Math.random() * cand.length)][1];
        if (!opts.has(o)) opts.add(o);
        guard++;
      }
      const options = shuffleArray(Array.from(opts));
      const correctIndex = options.indexOf(zh);
      /* ★ 额外返回 `uniq`：本次抽词的候选集（**已按英文去重** ✓ 即"本局没考过的词" ✓）
       *   用途：**中→英 方向**（奎隆二阶段「随机双向考」）需要从**英文**里取干扰项 ✓
       *   而它必须按**中文释义**去重 ✗ —— 否则会出现"两个选项中文意思一样"✓
       *   ★ 只加一个返回字段 ✗ 不改任何既有行为 ✓ 其它调用方读不读它都不受影响 ✓ */
      const uniq = [];
      const seenZh = Object.create(null);
      for (let i = 0; i < cand.length; i++) {
        const c = cand[i];
        if (seenZh[c[1]]) continue;
        seenZh[c[1]] = 1;
        uniq.push(c);
      }
      if (correctIndex >= 0) return { en: en, options: options, correctIndex: correctIndex, uniq: uniq };
    }

    // 回退：小词库（若大词库未加载）
    let pool = this._pools[floorId] && this._pools[floorId][difficulty];
    if (!pool || pool.length === 0) return null;
    if (ok) {
      const fp = pool.filter(e => ok(e.en, e.zh));
      if (fp.length) pool = fp;
    }
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const options = shuffleArray([entry.zh].concat(entry.distractors.slice()));
    const correctIndex = options.indexOf(entry.zh);
    return { en: entry.en, options: options, correctIndex: correctIndex };
  },

  /* 「铁络无面者」语境拼词：从专属库抽一条 { en, zh, sentence }。
   * 同库同模式不重复（用 usedWords）。出题时把句子里的目标词挖成"首字母+下划线"。 */
  drawMaskless() {
    const pool = Babel.MASKLEsS_WORDS;
    if (!pool || !pool.length) return null;
    let used = (Babel.RunState && Babel.RunState.usedWords) ? Babel.RunState.usedWords : [];
    let cand = pool.filter(e => used.indexOf(e.en) < 0);
    if (cand.length < 1) {
      if (Babel.RunState) Babel.RunState.usedWords = [];
      used = [];
      cand = pool.slice();
    }
    const e = cand[Math.floor(Math.random() * cand.length)];
    if (Babel.RunState) Babel.RunState.usedWords.push(e.en);
    return { en: e.en, zh: e.zh, sentence: e.sentence };
  },
};
