# PWABuilder 出 APK 逐步指引

> 适用：把已上线的 **https://2123801245-coder.github.io/thai-kb/** 打包成安卓 App（TWA 壳）。
> 全程在浏览器里完成，**不需要本机装 JDK/Android SDK**。
> 前提提醒：壳里打开的是线上网址，**国内运营商网络对 github.io 时好时坏** —— 这条路线发给网络好的同学/自己用；要「装上即离线、不依赖任何网站」的版本，走 Capacitor 全量套壳（另见对话记录）。

---

## ① 打开 PWABuilder 并扫描站点

1. 浏览器打开 **https://www.pwabuilder.com**
2. 输入框粘贴：`https://2123801245-coder.github.io/thai-kb/` → 点 **Start**
3. 等它拉取 manifest 和 SW，两个检查都应是绿勾：
   - **Manifest**：我们已配 name / 192+512+maskable 图标 / standalone / start_url，应全绿
   - **Service worker**：已配离线缓存，应显示通过

## ② 打包 Android

1. 点 **Package for stores → Android**
2. 选项按下面填：

   | 选项 | 填什么 | 说明 |
   |---|---|---|
   | Package ID | `com.zhb.thaikb` | 一旦发布就别再改 |
   | App name | `泰语个人知识库` | 装到手机后的名字 |
   | Version | `1.0.0.0` | 每次重打 +1 |
   | Host | 默认（github.io 那个 URL） | 别动 |
   | Display mode | `standalone` | 跟 manifest 一致 |
   | Theme/background color | `#5B5FC7` / `#F4F5FA` | 页面同款配色 |
   | Signing key | **Generate new**（默认） | PWABuilder 生成并帮你签好 |
   | 其余开关（推送、离线页等） | 默认不勾 | 我们有自己的 SW |

3. 点 **Download package**，得到一个 zip。

## ③ zip 里有什么、怎么用

| 文件 | 用途 |
|---|---|
| `app-release-signed.apk` | **直接发给同学安装的就是它** |
| `app-release-bundle.aab` | 只有上 Google Play 才用得上，自己装用不到 |
| `assetlinks.json` | **去掉地址栏的关键**，见 ④ |
| 签名密钥相关文件/说明 | **整个 zip 永久保存**（网盘 + 本地各一份）：以后升级 APK 必须用同一把钥匙，丢了就只能换包名重装 |

## ④ 去掉顶部地址栏（assetlinks 闭环）

TWA 默认会在屏幕上留一条地址栏提示，把 `assetlinks.json` 放进站点后即消失：

1. 把 zip 里的 `assetlinks.json` 拷进仓库：
   ```bash
   cd ~/Desktop/大二上（泰语）
   mkdir -p .well-known && cp <下载的zip解压目录>/assetlinks.json .well-known/
   git add .well-known && git commit -m "加入 TWA 校验 assetlinks.json" && git push
   ```
2. 等 Pages 自动重新发布（1~2 分钟），验证：
   ```bash
   curl -s -o /dev/null -w '%{http_code}' https://2123801245-coder.github.io/thai-kb/.well-known/assetlinks.json
   # 应输出 200（打包脚本已支持自动携带 .well-known/，自检也会把关）
   ```
3. **删掉手机上的旧 App 重装一次**（校验在安装时读取），即得全屏无地址栏的 App。

## ⑤ 装到手机

1. 把 `app-release-signed.apk` 传到手机：微信会改名，建议用**网盘 / USB / AirDrop（安卓互传用 Quick Share）**
2. 手机上点开 apk → 系统提示「未知来源应用」→ 允许该来源 → 安装
3. 首次打开需要**网络能访问 github.io**（打不开就白屏 —— 见顶部提醒）；首开成功后 SW 会缓存全部数据（约 60MB），之后断网也能用（视频除外，完整视频包走桌面离线版 zip）

## ⑥ 以后的更新流程

- **改数据/内容**：push → Pages 自动重发 → 手机上 App 重新打开即见新内容（SW 对数据是网络优先），**不用重新打包**
- **改壳本身**（图标、名字、包名、配色）：回 PWABuilder 重打一次，Version +1，签名选**同一把 key** 重签
