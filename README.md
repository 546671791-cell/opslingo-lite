# OpsLingo Lite / 航旅英语

一个面向中文用户的英语学习 PWA：既可练习与海外酒店、航司、票务代理沟通时的英文邮件、即时聊天和半开放式对话，也提供可独立更新的日常实用词汇、朗读、音标与拼读练习。学习记录仅保存在当前设备的 IndexedDB。

## 功能

- 4 个独立内容包、48 个内置场景（酒店/航班 × 邮件/聊天）
- 本地可追溯规则评分：目标、实体、清晰度、礼貌、表达与格式
- 有限状态对话、提示、参考结构、词句收藏和本地复习
- 进度、连续天数、有效学习时长、导入/导出和去重
- 内容包 SHA-256 校验、原子安装与上一个版本回滚
- PWA 离线壳、应用更新提示、GitHub Pages 与 iPhone 安装适配
- 47 条日常词汇（时间、日常、餐饮、出行、职场、健康、应急、社交、科技），词库可单独刷新，且不影响收藏与学习记录
- 系统英文朗读、IPA 音标、字母拼读、例句朗读与麦克风录音
- 可选 Azure Speech 云端发音评测：用户明确点“上传并评分”后才上传短音频；Function 不保存音频或密钥
- Capacitor Android 工程与 GitHub Actions 调试 APK 构建工作流

截图请在本地运行后采集；仓库不依赖任何不存在的截图资源。

## 本地运行与测试

```bash
nvm use
npm ci
npm run dev
npm run quality
npx playwright install chromium webkit
npm run test:e2e
```

`npm run build` 会先验证内容包。PWA 的移动 WebKit 测试只是近似 Safari，不能替代真机验收。

## Android 调试 APK

本项目使用 Capacitor 7 封装 Android。Android Studio 已安装时，可使用其自带 JDK 与 SDK 本机构建：

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/azhe/Library/Android/sdk"
npm run android:debug
```

生成文件为 `android/app/build/outputs/apk/debug/app-debug.apk`。它由调试密钥签名，适合本机安装测试，不适合发布到应用商店。推送 `main` 也会运行 **Android Debug APK** 工作流，产物可在该次 Actions 的 Artifacts 中下载。

## Azure Speech 发音评测（可选）

朗读功能不需要任何云服务。发音评测需要 Azure Speech 资源与本仓库的无状态 Azure Function 代理：订阅密钥绝不会写进 PWA、APK、仓库或 GitHub Pages。Azure 的短音频 REST 评测支持参考文本、准确度、流利度、完整度与韵律等字段；本应用把浏览器录音转为 16 kHz PCM WAV 后再上传。

1. 在 Azure 创建 Speech 资源，记录区域和访问密钥。
2. 在 Function App 的 Configuration 中设置 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION` 与 `ALLOWED_ORIGINS`。后者至少应包含 `https://546671791-cell.github.io,http://localhost,https://localhost`。
3. 将 Function App 的发布配置文件作为仓库 Secret `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` 保存；在 Actions 手动运行 **Deploy Azure Speech Proxy**，输入 Function App 名称。
4. 在仓库 Settings → Secrets and variables → Actions → Variables 设置 `VITE_SPEECH_API_URL`，值为 `https://YOUR-FUNCTION.azurewebsites.net/api/pronunciation`；手动运行 Pages 工作流重新构建。

本地调试时复制 `.env.example` 为 `.env` 并仅填写 Function URL；不得填写 Azure 订阅密钥。复制 `azure-function/local.settings.example.json` 为 `azure-function/local.settings.json` 时才填写本机开发密钥，该文件已被 Git 忽略。Function 仅接受配置过的来源，单次音频最大约 30 秒，不记录请求正文或音频。

## 内容包

内容位于 `public/content/`，与应用壳分离。每个包有稳定场景 ID；进度以 ID 关联，因此更新不会删除历史。修改 `scripts/build-content-catalog.ts` 中的内容模板或新增包后执行：

```bash
npm run build:catalog
npm run validate:content
```

命令将生成 `catalog.json` 并计算 SHA-256 与场景数量。应用通过同源目录检查新版本，下载后进行 JSON Schema、ID、版本和摘要验证；失败会保留旧版本。设置页可回滚到上一可用包。

## 部署 GitHub Pages

1. 创建公开仓库 `opslingo-lite`，推送 `main`。
2. 在仓库 **Settings → Pages** 选择 **GitHub Actions** 作为发布源。
3. `deploy-pages.yml` 会以仓库子路径构建 Vite；Hash 路由不需要服务器回退。
4. 等待工作流完成，访问 `https://USERNAME.github.io/opslingo-lite/`。

## iPhone 15 安装与离线

用 Safari 打开 Pages 地址，点分享按钮，选择“添加到主屏幕”。首次在线加载完成后，应用壳和已下载内容可离线打开。词汇与场景目录检查需要联网；普通训练文字不会上传。只有你主动提交发音评分时，短音频和该次跟读文本会通过 Function 转发到 Azure Speech。

## 备份、隐私与限制

在设置中导出 JSON，建议在清除 Safari 数据或换机前备份。导入可合并或替换，导入指纹会防止同一文件重复统计。邮件与聊天评分是本地固定规则，不是“AI 精准评分”；Azure 发音分数仅用于跟读参考，也不构成语言能力认证。

## 故障排除

- 内容更新失败：保持旧包，检查网络与 `catalog.json` 摘要。
- 离线首次无法打开：需先在联网状态完成一次加载。
- 真机未见更新：关闭应用后重新打开，或在设置中手动检查内容更新。
