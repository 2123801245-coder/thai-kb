#!/usr/bin/env node
/* 把两份讲义单词表按全库同一格式补进词库（data/words.json），
   并用与全库相同的泰语 TTS 管线为它们烤好内置发音（data/voice.json）：
     · 基阅2 第四课《直至我们再相见》出版社序 单词表 34 词（讲义只有泰文，释义/词性补齐）
     · 听力6 通识片1 单词表 49 词（讲义自带中文释义）
   新课「听力6 通识片1」同步登记进 data/lessons.meta.json（lessonKeys / courseOf / lessonIcons），
   否则这批生词在「词表 / 词汇练习」里会被归到「未分类」。
   用法: node tools/import-lesson-words.js [--dry]
*/
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

const LESSON_JY2 = '《直至我们再相见》出版社序 จนกว่าเราจะพบกันอีก';
const LESSON_L6 = '听力6 通识片1';

/* 词条：[泰文, 词性, 中文释义]；释义与词性沿用全库写法（z 里可带括注） */
const GROUPS = [
  { lesson: LESSON_JY2, words: [
    ['อมตะ',           'ว',   '不灭的；永恒的'],
    ['คนหนุ่มสาว',     'น',   '青年男女；年轻人'],
    ['ศรีบูรพา',       'น',   '西巫拉帕（泰国作家笔名，本名 กุหลาบ สายประดิษฐ์）'],
    ['ถ้อยคำ',         'น',   '话语；言辞'],
    ['แสวงหา',         'ก',   '寻求；追寻'],
    ['ดวงใจ',          'น',   '心；心爱之人'],
    ['เริ่มต้น',       'ก',   '开始；开端'],
    ['ลมหายใจ',        'น',   '呼吸；气息'],
    ['ความสุข',        'น',   '幸福；快乐'],
    ['ความทุกข์',      'น',   '痛苦；苦难'],
    ['ความอด',         'น',   '饥饿；忍饿（与 ความอิ่ม 相对）'],
    ['ความอิ่ม',       'น',   '温饱；饱足'],
    ['แม้แต่',         'สัน', '甚至；连……也'],
    ['รายละเอียด',     'น',   '细节'],
    ['คุณภาพ',         'น',   '质量；品质'],
    ['คุณความหมาย',    'น',   '价值与意义（คุณ + ความหมาย 的合成用法）'],
    ['เฉกเช่น',        'สัน', '如同；犹如（书面语）'],
    ['พร่ำ',           'ว',   '反复地；不停地（พร่ำบอก 反复诉说）'],
    ['อย่างไม่รู้หน่าย', 'ว', '不知疲倦地；乐此不疲地'],
    ['ปริมาณ',         'น',   '数量'],
    ['อิ่มเอม',        'ก',   '满怀喜悦；充盈'],
    ['เฝ้า',           'ก',   '守候；看护（เฝ้าดูแล 看护）'],
    ['สำราญ',          'ว',   '享乐的；愉快的（เจ้าสำราญ 花花公子）'],
    ['ล้มเหลว',        'ก',   '失败'],
    ['มุ่งมั่น',       'ก',   '坚定执着；专心致志'],
    ['น่าทึ่ง',        'ว',   '令人惊叹的'],
    ['เห็นอกเห็นใจ',   'ก',   '体恤；同情；设身处地'],
    ['ยิ่งกว่านั้น',   'สัน', '更有甚者；而且'],
    ['ประณีต',         'ว',   '精致；精美'],
    ['ลึกซึ้ง',        'ว',   '深刻；深沉'],
    ['เผื่อแผ่',       'ก',   '布施；慷慨给予；向旁人延展'],
    ['ตามลำพัง',       'ว',   '独自；单独地'],
    ['ศักยภาพ',        'น',   '潜能；潜力'],
    ['สำนักพิมพ์',     'น',   '出版社'],
  ]},
  { lesson: LESSON_L6, words: [
    ['ไถโทรศัพท์',     'ก',   '刷手机'],
    ['แยกแยะ',         'ก',   '分辨'],
    ['โซเชียลมีเดีย',  'น',   '社交媒体（讲义作 โซเชียวมีเดีย）'],
    ['รางวัล',         'น',   '奖励'],
    ['สารเคมี',        'น',   '化学物质'],
    ['โดพามีน',        'น',   '多巴胺'],
    ['วินัย',          'น',   '纪律'],
    ['กรณี',           'น',   '情况'],
    ['เชื่อมโยง',      'ก',   '关联'],
    ['ฝืนใจ',          'ก',   '勉强；违心'],
    ['ติ๊กต๊อก',       'น',   '抖音（TikTok）'],
    ['เลื่อน',         'ก',   '滑动'],
    ['อินสตาแกรม',     'น',   'Instagram（INS）'],
    ['คลิปสั้น',       'น',   '短视频'],
    ['หยิบ',           'ก',   '拿起'],
    ['เปรียบเทียบ',    'ก',   '比较'],
    ['เหนื่อย',        'ว',   '累'],
    ['แปลกใจ',         'ก',   '疑惑；惊讶'],
    ['ขี้เกียจ',       'ว',   '懒惰'],
    ['เข้าใจผิด',      'ก',   '误解'],
    ['คาดหวัง',        'ก',   '期待'],
    ['ขั้นตอน',        'น',   '步骤'],
    ['กระตุ้น',        'ก',   '刺激'],
    ['แตะ',            'ก',   '触碰'],
    ['เงียบ',          'ว',   '安静'],
    ['อึดอัด',         'ว',   '压抑；憋闷'],
    ['โหยหา',          'ก',   '渴望'],
    ['ตอบสนอง',        'ก',   '回应；满足（需求）'],
    ['หลับตา',         'ก',   '闭眼'],
    ['จินตนาการ',      'น',   '想象'],
    ['โจทย์',          'น',   '题目'],
    ['ภูมิใจ',         'ก',   '自豪'],
    ['เชิงบวก',        'ว',   '积极的；正面的'],
    ['เทคนิค',         'น',   '技巧'],
    ['ดึง',            'ก',   '拉'],
    ['ลุก',            'ก',   '起身'],
    ['ยืดเส้น',        'ก',   '伸展身体'],
    ['มองข้าม',        'ก',   '忽视'],
    ['ฉลอง',           'ก',   '庆祝'],
    ['กำหมัด',         'ก',   '握拳'],
    ['ซ้ำ',            'ว',   '重复'],
    ['เรียกร้อง',      'ก',   '要求'],
    ['น่าเบื่อ',       'ว',   '无聊'],
    ['เนื้อหา',        'น',   '内容'],
    ['ฝืน',            'ก',   '勉强；违背（心意）'],
    ['กำจัด',          'ก',   '消除'],
    ['แหล่งที่มา',     'น',   '来源'],
    ['หน้าจอ',         'น',   '屏幕'],
    ['เสพติด',         'ก',   '对……上瘾'],
  ]},
];

const norm = t => String(t).replace(/\s+/g, ' ').trim();

/* 与 tools/import-vok2-words.js 同一 TTS 管线；带 12s 超时（连续请求时 Google 会
   限流，请求会挂住不返回），网络抽风由调用方重试 */
function tts(text) {
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=' +
    encodeURIComponent(text);
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
      timeout: 12000,
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const bufs = [];
      res.on('data', c => bufs.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(bufs);
        const ok = buf.length > 1200 && (buf.slice(0, 3).toString('latin1') === 'ID3' ||
          (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));
        if (!ok) return reject(new Error('响应不是音频（' + buf.length + ' 字节）'));
        resolve(buf);
      });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAUSE = 400;            /* 每个请求之间停一下，避免被限流 */
const RETRIES = 4;

async function main() {
  const wordsPath = path.join(ROOT, 'data/words.json');
  const voicePath = path.join(ROOT, 'data/voice.json');
  const metaPath = path.join(ROOT, 'data/lessons.meta.json');
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
  const voice = JSON.parse(fs.readFileSync(voicePath, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const have = new Set(words.map(w => w.t));
  const todo = [], skipped = [];
  for (const g of GROUPS) for (const [t] of g.words) {
    (have.has(t) ? skipped : todo).push(t);
  }
  console.log('待新增 ' + todo.length + ' 词' + (skipped.length ? '，已在词库跳过 ' + skipped.length + ' 词：' + skipped.join('、') : ''));

  /* 限流时脚本可能被中途掐断：每烤好一批就把 voice.json 落盘，重跑接着烤 */
  let baked = 0, sinceSave = 0; const failed = [];
  const saveVoice = () => { if (!DRY) fs.writeFileSync(voicePath, JSON.stringify(voice)); };
  for (const t of todo) {
    const key = norm(t);
    if (voice[key]) continue;                    /* 已有发音不重烤 */
    let last = null;
    for (let i = 0; i < RETRIES; i++) {
      try {
        const mp3 = await tts(key);
        voice[key] = mp3.toString('base64');
        baked++;
        process.stdout.write('🎙 ' + key + ' (' + mp3.length + 'B)\n');
        last = null;
        break;
      } catch (e) { last = e; await sleep(1200 * (i + 1)); }
    }
    if (last) failed.push(t + ': ' + last.message);
    else if (++sinceSave >= 5) { sinceSave = 0; saveVoice(); console.log('   …阶段性写入 data/voice.json（' + Object.keys(voice).length + ' 条）'); }
    await sleep(PAUSE);
  }
  saveVoice();

  console.log('--- 烤制成功 ' + baked + '，失败 ' + failed.length + (failed.length ? '\n' + failed.join('\n') : ''));

  /* 新课登记（只登记还没进 meta 的） */
  const newLessonKeys = GROUPS.map(g => g.lesson)
    .filter(k => !(meta.lessonKeys || []).includes(k));
  console.log('新增课文键: ' + (newLessonKeys.length ? newLessonKeys.join('、') : '（无）'));

  const missing = words.concat(todo.map(t => ({ t }))).filter(w => !voice[norm(w.t)]).map(w => w.t);
  console.log('仍无内置发音的词: ' + (missing.length ? missing.join('、') : '（无）'));

  if (DRY) return console.log('（--dry 未写入）');
  if (failed.length) return console.log('有烤制失败项，未写入，请重跑（脚本幂等）');

  /* 追加词条：与全库字段顺序一致（t / p / r / z / lesson） */
  for (const g of GROUPS) g.words.forEach(([t, p, z]) => {
    if (have.has(t)) return;
    words.push({ t, p, r: '', z, lesson: g.lesson });
    have.add(t);
  });
  fs.writeFileSync(wordsPath, JSON.stringify(words, null, 1) + '\n');
  fs.writeFileSync(voicePath, JSON.stringify(voice));

  /* 新课并入 meta：顺序追加到 lessonKeys 末尾，归类到泰语视听说 */
  if (newLessonKeys.length) {
    for (const k of newLessonKeys) {
      meta.lessonKeys.push(k);
      meta.courseOf[k] = '泰语视听说';
      meta.lessonIcons[k] = '🎧 ' + k;
    }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1) + '\n');
  }

  console.log('已写入 data/words.json（' + words.length + ' 词）、data/voice.json（' + Object.keys(voice).length + ' 条）'
    + (newLessonKeys.length ? '、data/lessons.meta.json（+' + newLessonKeys.length + ' 个课文键）' : ''));
  console.log('接着跑 node tools/check.js 自检，再跑 node tools/make-package.js 重出发布包');
}

main();
