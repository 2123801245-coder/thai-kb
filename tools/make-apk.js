#!/usr/bin/env node
/* tools/make-apk.js —— 把整库打成全量离线安卓 APK（Capacitor 套壳）
   用法：node tools/make-apk.js [--skip-package] [--version x.y.z] [--no-sign]

   与 PWABuilder/TWA 路线的区别：这一条把 data/ 与 media/ 全部塞进 APK，
   装上即离线可用，不依赖 github.io 是否可达（国内同学主用这条）。

   流程：make-package 产出 → 拷进 apk/www（改名 index.html、去掉服务器脚本）
         → 补齐 node_modules / android 平台 → cap sync → 换图标 + 启动屏
         → 把 data/app.json 的版本写进 gradle → gradle assembleRelease
         → apksigner 用 apk/thai-kb.keystore 签名 → 桌面 泰语知识库.apk

   约定：签名密钥 apk/thai-kb.keystore 不入库（.gitignore 排除）；
         首次运行自动生成（本地自签，只用于直接分发安装，不上架商店）。
   前置：JDK 21（brew install openjdk@21，Capacitor 7 源码要求 21）、
         Android SDK（platform-35/build-tools 35.0.0/platform-tools + licenses）、
         apk/ 下的 Capacitor 工程（package.json + capacitor.config.json）。 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APK_DIR = path.join(ROOT, 'apk');
const WWW = path.join(APK_DIR, 'www');
const ANDROID = path.join(APK_DIR, 'android');
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'app.json'), 'utf8'));
const VERSION = (() => {
  const i = process.argv.indexOf('--version');
  return i >= 0 ? process.argv[i + 1] : APP_JSON.version || '1.0.0';
})();
const VERSION_CODE = (() => {
  const i = process.argv.indexOf('--version');
  if (i >= 0) return 1 + VERSION.split('.').reduce((n, s) => n * 1000 + (+s.replace(/\D/g, '') || 0), 0);
  return APP_JSON.build || 1;
})();
const SKIP_PACKAGE = process.argv.includes('--skip-package');
const NO_SIGN = process.argv.includes('--no-sign');
const OUT_APK = path.join(os.homedir(), 'Desktop', '泰语知识库.apk');

const say = m => console.log('  ' + m);
const run = (cmd, args, opts = {}) => (execFileSync(cmd, args, Object.assign({ stdio: ['ignore', 'pipe', 'inherit'] }, opts)) || '').toString();

/* 环境自检：JDK 与 SDK。Capacitor 7 的运行库源码要求 Java 21，优先找 openjdk@21 */
function findJdk() {
  const candidates = [
    '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
    '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home'
  ];
  for (const j of candidates) if (fs.existsSync(path.join(j, 'bin', 'java'))) return j;
  throw new Error('缺 JDK：brew install openjdk@21');
}
function envCheck() {
  const jdk = findJdk();
  const sdk = path.join(os.homedir(), 'Library/Android/sdk');
  if (!fs.existsSync(path.join(sdk, 'platforms', 'android-35'))) throw new Error('缺 Android platform-35（见 tools/README.txt 的装法）');
  const bt = path.join(sdk, 'build-tools', '35.0.0');
  if (!fs.existsSync(path.join(bt, 'apksigner'))) throw new Error('缺 build-tools 35.0.0');
  return { jdk, sdk, bt };
}

/* 1) 生成发布目录（复用离线包那套，数字/说明/媒体引用全一致） */
function buildPackage() {
  say('make-package → 生成发布目录');
  const out = path.join(os.tmpdir(), 'kb-apk-src-' + Date.now());
  run(process.execPath, [path.join(__dirname, 'make-package.js'), out], { stdio: ['ignore', 'ignore', 'inherit'] });
  return out;
}

/* 2) 发布目录 → Capacitor www/：入口改名 index.html，去掉服务器脚本 */
function fillWww(src) {
  say('填充 apk/www（全量 data + media + 入口改 index.html）');
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (['server.py', '使用说明.txt', '手机使用指南.txt'].includes(entry.name)) continue;
    fs.cpSync(path.join(src, entry.name), path.join(WWW, entry.name), { recursive: true });
  }
  const renamed = path.join(WWW, '泰语个人知识库.html');
  if (!fs.existsSync(renamed)) throw new Error('发布目录里没有主页面');
  fs.renameSync(renamed, path.join(WWW, 'index.html'));
  /* Capacitor 走 https://localhost 自定义 scheme，file:// 守卫不会拦；SW 不注册也无妨（本就全量在本地） */
  fs.rmSync(path.join(WWW, 'sw.js'), { force: true });
  /* APK 里的构建时间戳（关于页只在此环境显示） */
  fs.writeFileSync(path.join(WWW, 'build-info.js'),
    'window.KB_BUILD_TIME=' + JSON.stringify(new Date().toISOString()) + ';');
}

/* 3) node_modules / android 平台缺件自动补 */
function ensureCapacitor() {
  if (!fs.existsSync(path.join(APK_DIR, 'node_modules', '@capacitor', 'cli'))) {
    say('npm install（apk/）');
    run('npm', ['install', '--registry=https://registry.npmmirror.com', '--no-fund', '--no-audit'], { cwd: APK_DIR });
  }
  if (!fs.existsSync(path.join(ANDROID, 'gradlew'))) {
    say('npx cap add android');
    run('npx', ['cap', 'add', 'android'], { cwd: APK_DIR });
  }
}

/* 3.5) www/ → android 资产（cap sync；没这一步 APK 里只有占位页） */
function capSync() {
  const marker = path.join(ANDROID, 'app', 'src', 'main', 'assets', 'public', 'index.html');
  const wwwIndex = path.join(WWW, 'index.html');
  const need = !fs.existsSync(marker) || fs.statSync(wwwIndex).mtimeMs > fs.statSync(marker).mtimeMs;
  if (need) {
    say('npx cap sync android（www → 安卓资产，几百 MB 要拷一会儿）');
    run('npx', ['cap', 'sync', 'android'], { cwd: APK_DIR, stdio: ['ignore', 'ignore', 'inherit'] });
  } else {
    say('安卓资产已是最新，跳过 cap sync');
  }
}

/* 4) 品牌：图标 + 启动屏（都从 icons/ 与 tools/gen-splash.js 来） */
function applyBrand(bt) {
  const res = path.join(ANDROID, 'app', 'src', 'main', 'res');
  if (fs.existsSync(path.join(ROOT, 'icons', 'icon-512.png'))) {
    say('图标替换（mipmap 各密度）');
    for (const [dir, size] of [['mipmap-mdpi', 48], ['mipmap-hdpi', 72], ['mipmap-xhdpi', 96], ['mipmap-xxhdpi', 144], ['mipmap-xxxhdpi', 192]]) {
      const d = path.join(res, dir);
      fs.mkdirSync(d, { recursive: true });
      const dest = path.join(d, 'ic_launcher.png');
      /* 纯 Node 缩放太啰嗦，直接用 macOS 自带 sips（每台 Mac 都有） */
      fs.copyFileSync(path.join(ROOT, 'icons', 'icon-512.png'), '/tmp/kb-icon-resize.png');
      run('sips', ['-z', String(size), String(size), '/tmp/kb-icon-resize.png', '--out', dest], { stdio: 'ignore' });
      fs.copyFileSync(dest, path.join(d, 'ic_launcher_round.png'));
    }
  }
  say('启动屏（tools/gen-splash.js）');
  run(process.execPath, [path.join(__dirname, 'gen-splash.js')], { stdio: ['ignore', 'ignore', 'inherit'] });
  /* Android 12+ 系统启动屏背景色：跟图标的紫蓝渐变顶色一致 */
  const styles = path.join(res, 'values', 'styles.xml');
  let s = fs.readFileSync(styles, 'utf8');
  if (!s.includes('windowSplashScreenBackground')) {
    s = s.replace('(<item name="android:background">@drawable/splash</item>)',
      '$1<item name="windowSplashScreenBackground">#6F74E2</item>');
    fs.writeFileSync(styles, s);
  }
}

/* 5) 版本号与本地 properties：data/app.json → gradle（versionCode/versionName 一处来源） */
function writeLocal(sdk) {
  fs.writeFileSync(path.join(ANDROID, 'local.properties'), 'sdk.dir=' + sdk + '\n');
  const appGradle = path.join(ANDROID, 'app', 'build.gradle');
  let g = fs.readFileSync(appGradle, 'utf8');
  g = g.replace(/versionCode \d+/, 'versionCode ' + VERSION_CODE);
  g = g.replace(/versionName "[^"]*"/, 'versionName "' + VERSION + '"');
  fs.writeFileSync(appGradle, g);
  say('版本：' + VERSION + ' (code ' + VERSION_CODE + ')');
}

/* 6) 签名：keystore 不存在就生成（本地自签） */
function ensureKeystore(jdk) {
  const ks = path.join(APK_DIR, 'thai-kb.keystore');
  if (fs.existsSync(ks)) return ks;
  say('生成自签 keystore（apk/thai-kb.keystore，不入库）');
  const keytool = path.join(jdk, 'bin', 'keytool');
  run(keytool, [
    '-genkeypair', '-v', '-keystore', ks, '-alias', 'thaikb',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', 'thaikb2026', '-keypass', 'thaikb2026',
    '-dname', 'CN=Thai KB, OU=Personal, O=zhb, L=Bangkok, C=TH'
  ], { stdio: 'ignore' });
  return ks;
}

/* 7) gradle 打包 + 签名 + 对齐 → 桌面 泰语知识库.apk */
function gradleBuild(jdk, sdk, bt, ks) {
  const env = Object.assign({}, process.env, {
    JAVA_HOME: jdk,
    PATH: path.join(jdk, 'bin') + ':' + process.env.PATH,
    ANDROID_HOME: sdk
  });
  say('gradle assembleRelease（首次要下载依赖，可能几分钟）');
  run('./gradlew', ['assembleRelease', '--console=plain', '-q'], { cwd: ANDROID, env, stdio: ['ignore', 'ignore', 'inherit'] });
  const unsigned = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
  if (!fs.existsSync(unsigned)) throw new Error('gradle 没产出未签名 APK');
  const signed = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-signed.apk');
  if (NO_SIGN) {
    fs.copyFileSync(unsigned, OUT_APK);
  } else {
    say('apksigner 签名 + zipalign');
    const zipalign = path.join(bt, 'zipalign');
    const aligned = unsigned.replace('-unsigned', '-aligned');
    run(zipalign, ['-f', '4', unsigned, aligned], { env });
    run(path.join(bt, 'apksigner'), ['sign', '--ks', ks, '--ks-pass', 'pass:thaikb2026', '--key-pass', 'pass:thaikb2026', '--out', signed, aligned], { env });
    fs.copyFileSync(signed, OUT_APK);
  }
}

/* ── 主流程 ── */
(async () => {
  const t0 = Date.now();
  const { jdk, sdk, bt } = envCheck();
  const src = SKIP_PACKAGE ? WWW : buildPackage();
  if (!SKIP_PACKAGE) fillWww(src);
  else say('--skip-package：沿用现有 apk/www（上次填充的版本）');
  ensureCapacitor();
  capSync();
  applyBrand(bt);
  writeLocal(sdk);
  const ks = ensureKeystore(jdk);
  gradleBuild(jdk, sdk, bt, ks);
  const mb = (fs.statSync(OUT_APK).size / 1048576).toFixed(1);
  console.log('\n✓ APK 完成：' + OUT_APK + '（' + mb + 'MB，' + VERSION + '，全量离线，装上即用）');
  console.log('  发给同学：微信会改名，建议网盘/USB/AirDrop；安装时允许「未知来源」即可。');
  if (!SKIP_PACKAGE) fs.rmSync(src, { recursive: true, force: true });
  console.log('  耗时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
