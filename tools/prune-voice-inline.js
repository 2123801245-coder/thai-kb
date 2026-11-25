#!/usr/bin/env node
/* prune-voice-inline.js —— 删掉 data/voice.json 里「已经有分文件音频」的 base64（幂等）
   为什么：audio/<id>_<word|ex>.mp3 与 data/audio-manifest.json 这套分文件音频上线后，
   前端 js/audio.js 的取音顺序是「清单里的分文件 → 内置 base64 → 系统语音」。
   因此清单里登记过、文件又确实在盘上的词，voice.json 里那份 base64 只在
   「文件请求失败」时才会用到，却占着整包的大头（实测 1957 条 / 27MB）。

   注意：按内容哈希去重几乎没用 —— 两个发音包的 base64 各自只有 1 条重复（约 3KB）。
   真正的冗余是「同一段话既存文件又存 base64」，所以这里按「清单覆盖」来删，
   而不是按内容哈希改名。

   保护规则（删了就真没声音的，一律保留）：
     · 文本不在 audio-manifest.json 的 files 里
     · 清单里有登记但文件不在盘上
     · 文件不是合法 mp3（头几个字节校验）
   进度存的是泰文/课文标签，不存音频键，所以瘦身不影响任何学习进度。

   用法：
     node tools/prune-voice-inline.js --dry   只报告
     node tools/prune-voice-inline.js         真删并写回（输出压缩 JSON） */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const VOICE = path.join(ROOT, 'data/voice.json');
const MANIFEST = path.join(ROOT, 'data/audio-manifest.json');

const voice = JSON.parse(fs.readFileSync(VOICE, 'utf8'));
let files = {};
try { files = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).files || {}; } catch (e) { files = {}; }

/* 与 audio.js 的判定一致：清单里登记 + 文件存在 + 是音频，才算「有分文件」 */
function playableFile(text) {
  const rel = files[text];
  if (!rel) return '';
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return '';
  const buf = fs.readFileSync(p);
  const ok = buf.length > 100 && (buf.slice(0, 3).toString('latin1') === 'ID3' ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));
  return ok ? rel : '';
}

const keep = {}, removed = [];
let removedChars = 0;
for (const k of Object.keys(voice)) {
  if (playableFile(k)) { removed.push(k); removedChars += voice[k].length; }
  else keep[k] = voice[k];
}
const keptChars = Object.keys(keep).reduce((n, k) => n + keep[k].length, 0);

const mb = n => (n / 1048576).toFixed(2) + 'MB';
console.log('voice.json 现有 ' + Object.keys(voice).length + ' 条（' + mb(JSON.stringify(voice).length) + '）');
console.log('可删（已有分文件）' + removed.length + ' 条，释放 base64 ' + mb(removedChars)
  + '；保留 ' + Object.keys(keep).length + ' 条（' + mb(keptChars) + '）');
if (removed.length) console.log('  例如：' + removed.slice(0, 5).join('、'));

if (DRY) return console.log('（--dry 未写入）');
if (!removed.length) return console.log('没有可删的条目，data/voice.json 未动');

fs.writeFileSync(VOICE, JSON.stringify(keep));
console.log('已写入 data/voice.json：' + Object.keys(keep).length + ' 条，'
  + mb(fs.statSync(VOICE).size) + '（原 ' + mb(fs.statSync(VOICE).size + removedChars) + '）');
