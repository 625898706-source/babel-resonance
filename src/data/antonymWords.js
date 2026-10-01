/* ============================================================================
 * antonymWords.js —— 奎隆**三阶段「无忧觉」**专属词库（反义词对）
 *   2026-09-24 用户构想：
 *     "奎隆朝你发射一个词，然后你要从下面选一个词（可以拖出来，要是它的**反义词**，
 *      其他三个是干扰项）"
 *   → 所以这里的核心是 **一对反义词**：[正面词, 它的反义词] ✓
 *
 * ★ 数据形态：{ a: '正面词', b: '它的反义词', za: 'a 的中文', zb: 'b 的中文', tag: '分类' }
 *   · `a` ＝ 奎隆发射给你的那个词（题干 ✓）
 *   · `b` ＝ 正确答案（要拖上去的那个 ✓）
 *   · `za` / `zb` ＝ 两个词的中文（用于悬浮提示 / 本局总结 ✓）
 *   · `tag` ＝ 词性/语义分类 ✓ 干扰项**优先从同 tag 里取**（更迷惑 ✓ 更像真的反义题 ✓）
 *
 * ★ 干扰项规则（在皮肤里实现，不在这里 ✓）：
 *   从**其它条目**里取 3 个词 ✓ 必须**不是 a 的反义词** ✓
 *   优先同 tag ✓ 且与 b 词形都不同 ✓
 *
 * ★ 目前是**测试用小库**（用户："先稍微建几个用来测试"）✓
 *   先给 20 对，够跑通流程与验证手感 ✓ 之后再扩 ✓
 * ========================================================================== */
window.Babel = window.Babel || {};

Babel.ANTONYM_WORDS = [
  /* ---- 形容词：评价 / 性质 ---- */
  { a: 'abundant',  b: 'scarce',      za: '丰富的',   zb: '稀少的',     tag: 'adj' },
  { a: 'ancient',   b: 'modern',      za: '古老的',   zb: '现代的',     tag: 'adj' },
  { a: 'artificial',b: 'natural',     za: '人造的',   zb: '天然的',     tag: 'adj' },
  { a: 'bold',      b: 'timid',       za: '大胆的',   zb: '胆小的',     tag: 'adj' },
  { a: 'complex',   b: 'simple',      za: '复杂的',   zb: '简单的',     tag: 'adj' },
  { a: 'delicate',  b: 'sturdy',      za: '纤弱的',   zb: '结实的',     tag: 'adj' },
  { a: 'evident',   b: 'obscure',     za: '明显的',   zb: '晦涩的',     tag: 'adj' },
  { a: 'generous',  b: 'stingy',      za: '慷慨的',   zb: '吝啬的',     tag: 'adj' },
  { a: 'humble',    b: 'arrogant',    za: '谦逊的',   zb: '傲慢的',     tag: 'adj' },
  { a: 'rigid',     b: 'flexible',    za: '僵硬的',   zb: '灵活的',     tag: 'adj' },

  /* ---- 动词：增减 / 变化 ---- */
  { a: 'accept',    b: 'reject',      za: '接受',     zb: '拒绝',       tag: 'verb' },
  { a: 'accumulate',b: 'disperse',    za: '积累',     zb: '驱散',       tag: 'verb' },
  { a: 'conceal',   b: 'reveal',      za: '隐藏',     zb: '揭露',       tag: 'verb' },
  { a: 'expand',    b: 'contract',    za: '扩张',     zb: '收缩',       tag: 'verb' },
  { a: 'praise',    b: 'condemn',     za: '赞扬',     zb: '谴责',       tag: 'verb' },
  { a: 'retreat',   b: 'advance',     za: '撤退',     zb: '前进',       tag: 'verb' },
  { a: 'unite',     b: 'divide',      za: '联合',     zb: '分裂',       tag: 'verb' },

  /* ---- 名词：状态 / 抽象 ---- */
  { a: 'victory',   b: 'defeat',      za: '胜利',     zb: '失败',       tag: 'noun' },
  { a: 'poverty',   b: 'wealth',      za: '贫穷',     zb: '富有',       tag: 'noun' },
  { a: 'harmony',   b: 'conflict',    za: '和谐',     zb: '冲突',       tag: 'noun' },
];
