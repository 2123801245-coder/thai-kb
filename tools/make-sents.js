#!/usr/bin/env node
/* tools/make-sents.js —— 把 data/sents.json 的逐句草稿写进 data/lessons.json 的 para.ss
 *
 * data/sents.json 的写法（按课文 label → 段落下标 → 逐句起点锚）：
 *   {
 *     "千年雨 ฝนพันปี": {
 *       "0": [
 *         ["คงจำกันได้ว่า", "大家应该还记得："],
 *         ["พล.ต. จำลอง", "陆军少将占隆·西里蒙…"],
 *         ["พอท่านให้สัมภาษณ์เสร็จ", "采访一结束…"]
 *       ]
 *     }
 *   }
 * 每个元素的第一个字符串是该句在段落泰文里的「开头几个字」（锚点），第二个是这句的中文；
 * 第一句的锚点必须是段落开头。最后一句一直延伸到段落结尾。
 *
 * 生成结果：para.ss = [[泰语句, 中文], ...]，read.js 逐句渲染；整段 t/z 原样保留。
 *
 * 用法：node tools/make-sents.js [--check]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');
const LESSONS = path.join(SRC, 'data', 'lessons.json');
const SENTS = path.join(SRC, 'data', 'sents.json');
const CHECK = process.argv.includes('--check');

const lessons = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
const draft = fs.existsSync(SENTS) ? JSON.parse(fs.readFileSync(SENTS, 'utf8')) : {};

const problems = [];
const warns = [];
let paraDone = 0, sentDone = 0, skipped = 0;

for (const [label, byPara] of Object.entries(draft)) {
  const sec = lessons.find(s => s.label === label);
  if (!sec) { problems.push('未知课文：' + label); continue; }
  for (const [piStr, rows] of Object.entries(byPara)) {
    const pi = +piStr;
    const pa = sec.paras[pi];
    if (!pa) { problems.push(`${label} 没有第 ${pi + 1} 段`); continue; }
    const text = String(pa.t || '');
    const starts = [];
    let prev = 0, bad = false;
    rows.forEach((row, k) => {
      const anchor = String(row[0] || '').trim();
      const i = anchor ? text.indexOf(anchor, k === 0 ? 0 : prev) : -1;
      if (i < 0) { problems.push(`${label} P${pi + 1} 找不到锚点：${anchor}`); bad = true; return; }
      if (k === 0 && i !== 0) { problems.push(`${label} P${pi + 1} 首句锚点不在开头：${anchor}`); bad = true; return; }
      if (i <= prev && k > 0) { problems.push(`${label} P${pi + 1} 锚点顺序错乱：${anchor}`); bad = true; return; }
      if (i > 0 && text[i - 1] !== ' ' && text[i - 1] !== '“') { warns.push(`${label} P${pi + 1} 锚点不在词首（会切断词语）：${anchor}`); }
      starts.push(i);
      prev = i;
    });
    if (bad || starts.length !== rows.length) continue;
    const ss = rows.map((row, k) => {
      const end = k + 1 < starts.length ? starts[k + 1] : text.length;
      return [text.slice(starts[k], end).trim(), String(row[1] || '').trim()];
    }).filter(s => s[0]);
    if (!ss.length) { skipped++; continue; }
    pa.ss = ss;
    paraDone++; sentDone += ss.length;
  }
}
/* 草稿里没有的段落：先按「整段 = 一句」占位，逐句排版统一；
   等这些段落补上逐句草稿后会被覆盖。 */
let single = 0;
for (const sec of lessons) {
  const byPara = draft[sec.label] || {};
  sec.paras.forEach((pa, pi) => {
    if (byPara[pi]) return;
    if (pa.t) { pa.ss = [[String(pa.t).trim(), String(pa.z || '').trim()]]; single++; }
    else delete pa.ss;
  });
}
if (warns.length) { console.log('（提示）' + warns.length + ' 处锚点不在词首，按句读切分照常进行：'); warns.slice(0, 6).forEach(w => console.log('  · ' + w)); }
console.log('整段占位：' + single + ' 段');

if (problems.length) {
  console.error('✗ 有 ' + problems.length + ' 处问题：');
  problems.slice(0, 40).forEach(p => console.error('  · ' + p));
  if (problems.length > 40) console.error('  …其余 ' + (problems.length - 40) + ' 处省略');
  process.exitCode = 1;
}
console.log('逐句数据：' + paraDone + ' 段 / ' + sentDone + ' 句' + (skipped ? '（跳过 ' + skipped + ' 段）' : ''));
const todo = lessons.reduce((n, s) => n + s.paras.filter(p => !p.ss).length, 0);
console.log('尚未逐句：' + todo + ' 段（这些段落仍按整段显示）');
if (!CHECK && !problems.length) {
  fs.writeFileSync(LESSONS, JSON.stringify(lessons), 'utf8');
  console.log('✓ 已写回 data/lessons.json');
}
