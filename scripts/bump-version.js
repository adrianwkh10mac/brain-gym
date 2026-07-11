#!/usr/bin/env node
// 一次性把版本号同步改到 js/version.js（页面显示用）和 sw.js（缓存刷新用），
// 避免两处手动改漏了一处导致"改了版本号但手机上没更新"。
// 用法：node scripts/bump-version.js 1.2.0
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('用法：node scripts/bump-version.js 1.2.0（必须是 x.y.z 格式）');
  process.exit(1);
}
const date = new Date().toISOString().slice(0, 10);
const root = path.join(__dirname, '..');

const versionPath = path.join(root, 'js/version.js');
fs.writeFileSync(versionPath,
  `// ===== 版本号：唯一来源，页面和 Service Worker 都读这里 =====\n` +
  `// 每次更新只改这一处：版本号变了，手机上的缓存会自动刷新成新版本。\n` +
  `var APP_VERSION = '${version}';\n` +
  `var APP_BUILD_DATE = '${date}';\n`
);

const swPath = path.join(root, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const VERSION = 'brain-gym-v[\d.]+';/, `const VERSION = 'brain-gym-v${version}';`);
fs.writeFileSync(swPath, sw);

console.log(`✅ 版本号已同步更新为 v${version}（${date}）`);
console.log('   - js/version.js（设置面板显示用）');
console.log('   - sw.js（Service Worker 缓存刷新用）');
