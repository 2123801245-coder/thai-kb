#!/usr/bin/env node
/* tools/release.js —— 一键发版：补烤发音 → 自检 → 打包 → 增量包 → 压缩（可选 APK / Gitee / 推送 / 线上确认）
   用法：node tools/release.js [选项]

   默认（不带选项）跑的仍是原来的五步：
     bake-vok-voice / bake-disc-voice   补烤缺的发音（幂等，没缺项不动文件）
     check.js                           自检，硬失败即停
     make-package.js                    打包 → ~/Desktop/泰语知识库-发布版/
     make-update.py                     增量包（必须用「上一版」zip 比对）
     make-zip.py                        压缩 → ~/Desktop/泰语知识库-离线版.zip

   选项：
     --from <旧zip>   指定增量包的基线 zip。不给则用桌面「泰语知识库-离线版.zip」。
                      基线版本必须低于当前 data/app.json 的版本，否则提示并停止
                      （同版本比对出来的补丁是空的，这是 1.9.7 那次踩过的坑）。
     --apk            出发布目录后再打签名 APK（make-apk.js --src <发布目录>）
     --gitee          把桌面 APK 切片发到 Gitee 发行版（make-gitee-parts.js）
     --push           检查工作区干净后推 origin main（触发 Pages），并轮询线上
                      data/app.json 直到版本号对得上
     --no-bake        断网时跳过补烤（缺发音交给自检报红）
     --skip-check     只在刚跑过 check.js 的低风险改动上用
     --dry            只打印将要执行的步骤与基线检查结果，什么都不做

   任何一步退出码非 0 就停在那里，不继续执行后面的步骤。 */
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const flag = name => process.argv.includes(name);

const SKIP_CHECK = flag('--skip-check');
const NO_BAKE = flag('--no-bake');
const WANT_APK = flag('--apk');
const WANT_GITEE = flag('--gitee');
const WANT_PUSH = flag('--push');
const DRY = flag('--dry');

const DESKTOP = path.join(os.homedir(), 'Desktop');
const OUT_DIR = path.join(DESKTOP, '泰语知识库-发布版');
const ZIP = path.join(DESKTOP, '泰语知识库-离线版.zip');
const PATCH = path.join(DESKTOP, '泰语知识库-更新包.zip');
const APK = path.join(DESKTOP, '泰语知识库.apk');
const PAGES_JSON = 'https://2123801245-coder.github.io/thai-kb/data/app.json';
const FROM_ARG = arg('--from', null);
const FROM = FROM_ARG ? path.resolve(FROM_ARG.replace(/^~(?=$|\/)/, os.homedir())) : ZIP;

const APP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'app.json'), 'utf8'));
const VER = APP.version + ' / build ' + APP.build;
const say = m => console.log(m);

/* ── 基线检查：增量包必须拿真正更旧的那版 zip 做比对 ── */
function zipVersion(zip) {
  try {
    const r = spawnSync('python3', ['-c',
      'import json,sys,zipfile\n' +
      'z=zipfile.ZipFile(sys.argv[1])\n' +
      'n=[i for i in z.namelist() if i.endswith("data/app.json")][0]\n' +
      'j=json.loads(z.read(n).decode("utf-8"))\n' +
      'print(str(j.get("version",""))+"|"+str(j.get("build","")))', zip], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    return r.stdout.trim();
  } catch (e) { return null; }
}

const steps = [];
if (!NO_BAKE) {
  steps.push(['补烤发音（词汇讲解）', process.execPath, [path.join(__dirname, 'bake-vok-voice.js')]]);
  steps.push(['补烤发音（辨析例句）', process.execPath, [path.join(__dirname, 'bake-disc-voice.js')]]);
}
/* 热更清单要在自检之前生成：自检会校验 data/hotupdate.json 与 data/ 当前内容一致 */
steps.push(['热更清单', process.execPath, [path.join(__dirname, 'make-hotupdate.js')]]);
if (!SKIP_CHECK) steps.push(['自检', process.execPath, [path.join(__dirname, 'check.js')]]);
steps.push(['打包', process.execPath, [path.join(__dirname, 'make-package.js')]]);

/* 增量包：基线存在且确实是更旧的版本才排进计划；顺序必须在压缩之前，
   因为 make-zip.py 会覆盖桌面 zip，覆盖后再比对就永远没有差异。 */
let baseline = null;
if (!fs.existsSync(FROM)) {
  if (FROM_ARG) { console.error('✗ 找不到 --from 指定的基线 zip：' + FROM); process.exit(1); }
  say('· 桌面上没有上一版 zip，跳过增量包（这次就是第一版）');
} else {
  const bv = zipVersion(FROM);
  baseline = { path: FROM, version: bv };
  if (!bv) {
    say('⚠︎ 读不出基线 zip 里的版本号：' + FROM + '（不是本项目的完整包？）');
  } else if (bv === APP.version + '|' + APP.build) {
    console.error('✗ 基线 zip 就是当前版本（' + bv.replace('|', ' / build ') + '），');
    console.error('  和它比对出来的增量包会是空的。请用 --from 指定上一版完整包，例如：');
    console.error('  node tools/release.js --from ~/Desktop/08_压缩包与安装包/泰语知识库-离线版-' +
      (APP.version === '1.9.8' ? '1.9.7' : '<上一版>') + '.zip');
    process.exit(1);
  }
  steps.push(['增量更新包', 'python3', [path.join(__dirname, 'make-update.py'), FROM, PATCH, OUT_DIR]]);
}
steps.push(['压缩', 'python3', [path.join(__dirname, 'make-zip.py')]]);

if (WANT_APK) steps.push(['打签名 APK', process.execPath, [path.join(__dirname, 'make-apk.js'), '--src', OUT_DIR]]);
if (WANT_GITEE) {
  steps.push(['发 Gitee 分片', process.execPath, [path.join(__dirname, 'make-gitee-parts.js'), '--apk', APK]]);
}
if (WANT_PUSH) steps.push(['推送 origin main', 'git', ['-c', 'pack.threads=1', '-c', 'pack.windowMemory=256m', '-c', 'http.postBuffer=524288000', 'push', 'origin', 'main']]);

say('发版计划（当前版本 ' + VER + '）');
say('  基线：' + (baseline ? baseline.path + '（' + String(baseline.version).replace('|', ' / build ') + '）' : '无'));
say('  输出：' + ZIP + ' + ' + PATCH + (WANT_APK ? '\n        ' + APK : ''));
say('  步骤：' + steps.map(s => s[0]).join(' → ') + (WANT_PUSH ? ' → 线上版本确认' : ''));

if (DRY) {
  say('');
  say('--dry：没有执行任何步骤。');
  process.exit(0);
}

/* 推送前置：工作区必须干净，避免把半成品推上线 */
if (WANT_PUSH) {
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (st.status !== 0) { console.error('✗ 读不到 git 状态，停止。'); process.exit(1); }
  if (st.stdout.trim()) {
    console.error('✗ 工作区还有未提交的改动，先 commit 再发版：');
    console.error(st.stdout.split('\n').slice(0, 10).join('\n'));
    process.exit(1);
  }
}

let failed = false;
for (const [name, cmd, args] of steps) {
  console.log('→ ' + name + '（' + [cmd, ...args].map(s => path.relative(ROOT, s) || s).join(' ') + '）');
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    console.error('✗ ' + name + ' 失败（退出码 ' + (r.status ?? r.error?.code) + '），停止发版。');
    failed = true;
    break;
  }
}
if (failed) process.exit(1);

/* 推完 Pages 要重新构建，轮询线上 app.json 直到版本对上 —— 否则「已推送」
   不等于「检查更新能看到新版」。 */
if (WANT_PUSH) {
  const want = APP.version + '|' + APP.build;
  const deadline = Date.now() + 6 * 60 * 1000;
  let ok = false;
  say('→ 等 Pages 部署（线上 app.json 变成 ' + APP.version + ' / build ' + APP.build + '）');
  while (Date.now() < deadline) {
    const r = spawnSync('curl', ['-s', '-H', 'Cache-Control: no-cache', PAGES_JSON + '?t=' + Date.now()], { encoding: 'utf8' });
    const txt = (r.stdout || '').trim();
    if (txt) {
      try {
        const j = JSON.parse(txt);
        if (String(j.version) + '|' + String(j.build) === want) { ok = true; break; }
      } catch (e) { /* 部署中途可能拿到半截内容 */ }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15000);
  }
  if (!ok) {
    console.error('✗ 6 分钟内线上 app.json 还是旧版本，去 Actions 看 Pages 构建是否失败。');
    process.exit(1);
  }
  say('✓ 线上已确认：' + APP.version + ' / build ' + APP.build);
}

console.log('✓ 发版完成：' + ZIP + ' + ' + PATCH + (WANT_APK ? ' + ' + APK : ''));
