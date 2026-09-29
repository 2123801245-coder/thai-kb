#!/usr/bin/env node
/* tools/release.js —— 一键发版：自检 → 打包 → 增量包 → 压缩，一条命令出 zip。
   用法：node tools/release.js [--skip-check]

   把原本要按顺序手敲的三条命令并成一条：
     node tools/check.js            自检（硬失败即终止，不出包）
     node tools/make-package.js     打包 → ~/Desktop/泰语知识库-发布版/
     python3 tools/make-zip.py      压缩 → ~/Desktop/泰语知识库-离线版.zip
   任何一步退出码非 0 就停在那里，不继续执行后面的步骤。

   中间顺手做一步：若桌面上已有上一版 zip，先用它生成「增量更新包」
   （tools/make-update.py，只装变化过的文件），给已拿到完整包的同学补丁用。
   ⚠︎ 这一步必须在压缩之前：make-zip.py 会覆盖旧 zip，等压完再比对，
      读到的「上一版」就是刚出炉的新 zip，永远比不出差异。

   --skip-check 只建议在刚跑过 check.js、只改了说明文本这类低风险改动时用。 */
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SKIP_CHECK = process.argv.includes('--skip-check');
const ZIP = path.join(os.homedir(), 'Desktop', '泰语知识库-离线版.zip');

const steps = [];
if (!SKIP_CHECK) steps.push(['自检', process.execPath, [path.join(__dirname, 'check.js')]]);
steps.push(['打包', process.execPath, [path.join(__dirname, 'make-package.js')]]);
if (fs.existsSync(ZIP)) {
  /* 顺序敏感：必须在压缩（覆盖旧 zip）之前比对 */
  steps.push(['增量更新包', 'python3', [path.join(__dirname, 'make-update.py')]]);
} else {
  console.log('· 桌面上没有上一版 zip，跳过增量包（这次就是第一版）');
}
steps.push(['压缩', 'python3', [path.join(__dirname, 'make-zip.py')]]);

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
console.log('✓ 发版完成：' + ZIP);
