#!/usr/bin/env node
/* tools/make-gitee-parts.js —— 把全量离线 APK 切片并发布到 Gitee 公开镜像仓库
   用法：node tools/make-gitee-parts.js [选项]

     Gitee 单个发行版附件上限 100 MB，而 APK 有 400 MB+，所以切成若干片，
     同时在发行版里附上「合并安装」脚本与学生说明；同学下载后双击脚本即可
     拼回 APK（脚本自带 SHA-256 校验）。

     --apk <path>    要发布的 APK，默认 ~/Desktop/泰语知识库.apk
     --repo <name>   Gitee 镜像仓库名，默认 thai-kb-apk
     --tag <tag>     发行版标签，默认 v + data/app.json 的 version
     --part-mb <n>   分片大小，默认 90（留出余量，别贴 100）
     --dry           只切片与渲染，不碰网络（产物留在临时目录并打印路径）
     --keep          保留临时目录（默认传完就删）

   凭据：优先环境变量 GITEE_USER / GITEE_TOKEN，否则读 ~/.git-credentials 里的
   gitee.com 一行（与 git push 用的是同一份）。令牌只用于本次进程内调用 Gitee API。

   前置：先跑 node tools/make-apk.js 出包，再跑本脚本；本脚本会把 APK 的时间戳
   与 data/app.json 比对，明显不是最新的会先提醒。 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { facts, render } = require('./lib/pkg-info');

const SRC = path.resolve(__dirname, '..');
const TPL = path.join(__dirname, 'gitee-templates');
const API = 'https://gitee.com/api/v5';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const DRY = process.argv.includes('--dry');
const KEEP = process.argv.includes('--keep');

const APP = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'app.json'), 'utf8'));
const APK = path.resolve(arg('--apk', path.join(os.homedir(), 'Desktop', '泰语知识库.apk')));
const REPO = arg('--repo', 'thai-kb-apk');
const TAG = arg('--tag', 'v' + (APP.version || '1.0.0'));
const PART_MB = +arg('--part-mb', '90');
const PART_BYTES = Math.floor(PART_MB * 1024 * 1024);
const BASE = 'thai-kb.apk';

const say = m => console.log('  ' + m);
const mb = n => (n / 1048576).toFixed(1);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 凭据 ── */
function creds() {
  if (process.env.GITEE_TOKEN && process.env.GITEE_USER) {
    return { user: process.env.GITEE_USER, token: process.env.GITEE_TOKEN };
  }
  const p = path.join(os.homedir(), '.git-credentials');
  if (!fs.existsSync(p)) throw new Error('找不到 ~/.git-credentials；可用 GITEE_USER / GITEE_TOKEN 环境变量代替');
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^https:\/\/([^:@]+):([^@]+)@gitee\.com/.exec(line.trim());
    if (m) return { user: decodeURIComponent(m[1]), token: decodeURIComponent(m[2]) };
  }
  throw new Error('~/.git-credentials 里没有 gitee.com 的凭据');
}

/* ── Gitee API ── */
let CRED = null;
async function api(method, p, form, timeoutMs = 90000) {
  const url = new URL(API + p);
  url.searchParams.set('access_token', CRED.token);
  const opts = { method, signal: AbortSignal.timeout(timeoutMs) };
  if (form) opts.body = new URLSearchParams(form);
  const r = await fetch(url, opts);
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch (e) {}
  if (!r.ok) {
    const msg = (j && (j.message || (j.messages && j.messages.join('；')))) || text.slice(0, 200);
    throw new Error(`${method} ${p} → HTTP ${r.status}：${msg}`);
  }
  return j;
}

async function uploadAttachment(releaseId, file) {
  const url = new URL(`${API}/repos/${CRED.user}/${REPO}/releases/${releaseId}/attach_files`);
  url.searchParams.set('access_token', CRED.token);
  const fd = new FormData();
  const blob = fs.openAsBlob ? await fs.openAsBlob(file) : new Blob([fs.readFileSync(file)]);
  fd.append('file', blob, path.basename(file));
  const r = await fetch(url, { method: 'POST', body: fd, signal: AbortSignal.timeout(3600000) });
  const text = await r.text();
  if (!r.ok) throw new Error(`上传 ${path.basename(file)} → HTTP ${r.status}：${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/* ── 切片 ── */
function splitApk(src, dir) {
  const size = fs.statSync(src).size;
  const n = Math.ceil(size / PART_BYTES);
  const width = String(n).length;
  const fd = fs.openSync(src, 'r');
  const buf = Buffer.allocUnsafe(PART_BYTES);
  const parts = [];
  try {
    for (let i = 0; i < n; i++) {
      const want = Math.min(PART_BYTES, size - i * PART_BYTES);
      let got = 0;
      while (got < want) {
        const r = fs.readSync(fd, buf, got, want - got, i * PART_BYTES + got);
        if (r <= 0) break;
        got += r;
      }
      const out = path.join(dir, `${BASE}.part${i + 1}`);
      fs.writeFileSync(out, buf.subarray(0, got));
      parts.push(out);
    }
  } finally { fs.closeSync(fd); }
  return { parts, n, width, size };
}

const sha256 = file => new Promise((res, rej) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
});

/* ── 主流程 ── */
(async () => {
  const t0 = Date.now();
  if (!fs.existsSync(APK)) throw new Error('找不到 APK：' + APK + '（先跑 node tools/make-apk.js）');
  const apkStat = fs.statSync(APK);
  const appJsonMtime = fs.statSync(path.join(SRC, 'data', 'app.json')).mtimeMs;
  if (apkStat.mtimeMs < appJsonMtime) {
    console.warn('⚠️  APK 比 data/app.json 还旧，可能不是最新包 —— 建议先跑 node tools/make-apk.js');
  }

  /* 凭据先拿（--dry 时拿不到也继续，只为把 URL 渲染出来） */
  try { CRED = creds(); } catch (e) { if (!DRY) throw e; }

  const stats = facts(SRC);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-gitee-'));
  console.log('→ 切片：' + APK + '（' + mb(apkStat.size) + 'MB，每片 ' + PART_MB + 'MB）');
  const { parts, n } = splitApk(APK, work);
  const digest = await sha256(APK);
  say(n + ' 片：' + parts.map(p => path.basename(p) + '(' + mb(fs.statSync(p).size) + 'MB)').join(' '));
  say('SHA-256：' + digest);

  /* 模板变量：数字全部现推 */
  const releaseUrl = `https://gitee.com/${CRED ? CRED.user : '<user>'}/${REPO}/releases/tag/${TAG}`;
  const repoUrl = `https://gitee.com/${CRED ? CRED.user : '<user>'}/${REPO}`;
  const seqList = Array.from({ length: n }, (_, i) => i + 1).join(' ');
  const vars = {
    version: APP.version || '1.0.0',
    build: APP.build || 1,
    date: APP.date || '',
    sha256: digest,
    parts: n,
    sizeMb: mb(apkStat.size) + ' MB',
    partMb: PART_MB,
    releaseUrl, repoUrl,
    seqList,
    catArgs: Array.from({ length: n }, (_, i) => `${BASE}.part${i + 1}`).join(' '),
    copyCmd: 'copy /b ' + Array.from({ length: n }, (_, i) => `${BASE}.part${i + 1}`).join('+') + ' thai-kb.apk >nul',
    words: stats.words, lessons: stats.lessons, vok: stats.vokCards,
    notes: (APP.notes || []).map(x => '      · ' + x).join('\n') || '      · （本次未写要点）'
  };

  console.log('→ 渲染附件文本（tools/gitee-templates/）');
  const extras = [
    ['合并安装（Windows）.bat', '合并安装（Windows）.bat', false],
    ['合并安装（Mac）.command', '合并安装（Mac）.command', true],
    ['下载安装说明.txt', '下载安装说明.txt', false]
  ];
  const files = [...parts];
  for (const [tpl, out, exec] of extras) {
    const dest = path.join(work, out);
    let text = render(fs.readFileSync(path.join(TPL, tpl), 'utf8'), vars);
    if (out.endsWith('.bat')) text = text.replace(/\n/g, '\r\n');   /* Windows 批处理用 CRLF 更稳 */
    fs.writeFileSync(dest, text, 'utf8');
    if (exec) fs.chmodSync(dest, 0o755);
    files.push(dest);
    say(out);
  }

  if (DRY) {
    console.log('\n--dry：未联网。产物在 ' + work);
    return;
  }

  CRED = CRED || creds();
  console.log('→ Gitee：' + CRED.user + '/' + REPO);

  /* 1) 仓库存在且公开 */
  let repo = null;
  try { repo = await api('GET', `/repos/${CRED.user}/${REPO}`); } catch (e) { repo = null; }
  if (!repo) {
    say('创建公开仓库');
    repo = await api('POST', '/user/repos', {
      name: REPO, private: 'false', auto_init: 'true',
      description: '泰语个人知识库 · 安卓 APK 下载（分片）；源码仓库私有',
      has_issues: 'false', has_wiki: 'false'
    });
  }
  if (repo && repo.private) {
    say('仓库当前是私有，改为公开');
    repo = await api('PATCH', `/repos/${CRED.user}/${REPO}`, { name: REPO, private: 'false' });
  }
  const branch = (repo && repo.default_branch) || 'master';

  /* 2) 发行版 */
  const body = render(fs.readFileSync(path.join(TPL, '发行版说明.md'), 'utf8'), vars);
  const relName = 'v' + vars.version + '（' + vars.date + '）';
  let rel = null;
  try { rel = await api('GET', `/repos/${CRED.user}/${REPO}/releases/tags/${TAG}`); } catch (e) { rel = null; }
  if (rel) {
    say('发行版 ' + TAG + ' 已存在，更新说明');
    rel = await api('PATCH', `/repos/${CRED.user}/${REPO}/releases/${rel.id}`,
      { tag_name: TAG, name: relName, body, prerelease: 'false' });
  } else {
    say('创建发行版 ' + TAG);
    rel = await api('POST', `/repos/${CRED.user}/${REPO}/releases`,
      { tag_name: TAG, name: relName, body, target_commitish: branch, prerelease: 'false' });
  }

  /* 3) 清掉旧附件（换过的分片数、旧版说明都别留在页面上） */
  const want = new Set(files.map(f => path.basename(f)));
  const old = await api('GET', `/repos/${CRED.user}/${REPO}/releases/${rel.id}/attach_files`);
  for (const a of old || []) {
    if (want.has(a.name)) {
      await api('DELETE', `/repos/${CRED.user}/${REPO}/releases/${rel.id}/attach_files/${a.id}`);
      say('清掉旧附件 ' + a.name);
    }
  }

  /* 4) 上传 */
  console.log('→ 上传 ' + files.length + ' 个附件（共 ' + mb(apkStat.size) + 'MB，慢慢来）');
  for (const f of files) {
    const name = path.basename(f);
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        await uploadAttachment(rel.id, f);
        say('✓ ' + name + '（' + mb(fs.statSync(f).size) + 'MB）');
        done = true;
      } catch (e) {
        if (attempt === 3) throw e;
        console.warn('   ' + name + ' 第 ' + attempt + ' 次失败，重试：' + e.message.slice(0, 120));
        await sleep(3000 * attempt);
      }
    }
  }

  /* 5) 仓库首页 README */
  const readme = render(fs.readFileSync(path.join(TPL, 'README.md'), 'utf8'), vars);
  let sha = null;
  try { sha = (await api('GET', `/repos/${CRED.user}/${REPO}/contents/README.md?ref=${branch}`)).sha; } catch (e) {}
  await api('PUT', `/repos/${CRED.user}/${REPO}/contents/README.md`, {
    content: Buffer.from(readme, 'utf8').toString('base64'),
    message: 'README：' + TAG + ' 下载说明与校验值',
    branch, ...(sha ? { sha } : {})
  });
  say('README 已更新');

  if (!KEEP) fs.rmSync(work, { recursive: true, force: true });
  console.log('\n✓ Gitee 镜像完成：' + releaseUrl);
  console.log('  同学下载：' + n + ' 个分片 + 合并安装脚本，合并后 SHA-256 = ' + digest);
  console.log('  耗时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
