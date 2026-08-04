# OpsLingo Lite 交接

当前版本：`1.2.0`。这是零账号、零跟踪的 Preact PWA；场景与词句数据写入当前设备的 IndexedDB。默认没有云端调用；Azure Speech 发音评分是经用户确认后启用的可选服务。

## 功能清单

- 首页、场景、对话、进度、词句五个底部页，首页右上角设置
- 48 个内容经 Zod Schema 与 SHA-256 目录校验
- 邮件、聊天和三种对话模式；本地意图、实体、纠错、目标与评分规则
- 状态规则：完成为总分 ≥70 且目标 ≥80%；掌握为两天完成、最近 ≥85、全部目标和 ≥90% 完整率
- IndexedDB 迁移、草稿主动保存、历史、词句、导出导入去重、清空二次确认
- PWA 更新提示、内容检查/安装/回滚、离线提示、浅深色与安全区适配
- 5 个分级离线词汇包共 20,000 词，前 3,000 个高频词内置标准美式发音；词库切换不会删除收藏或场景成绩
- 词汇底部抽屉：IPA、逐字拼读、系统英文朗读、例句、小贴士与加入词句
- 麦克风录音、WAV 转码、Azure Speech 评分结果（准确度、流利度、完整度、综合分、可用时的韵律与单词分）
- `azure-function/` 无状态 Node 20 Azure Function：仅转发 30 秒内的 PCM WAV，不记录音频，订阅密钥只读环境变量
- `android/` Capacitor Android 工程；`.github/workflows/android-debug.yml` 生成调试 APK 工件

## 目录

- `src/engine.ts`：可测试的本地规则、状态和对话引擎
- `src/storage.ts`：IndexedDB、内容安装、备份
- `src/main.tsx` / `src/styles.css`：移动端 UI
- `public/content/`：目录与四个内容包
- `public/vocabulary/`：独立日常词汇目录与词汇包
- `scripts/build-content-catalog.ts`：验证、计数、摘要生成
- `.github/workflows/`：CI 与 Pages 发布
- `azure-function/`：Azure Speech Function 源码与本地配置模板
- `capacitor.config.ts`、`android/`：Android 原生容器

## 内容维护

为场景维持稳定 `id`。调整内容或发布新版本后，运行 `npm run build:catalog`；再用 `npm run validate:content` 和测试验证。目录版本不同即被检测为更新，失败不会覆盖当前可用包，设置页可回滚。

## 名称、图标、发布

改名时同步 `index.html`、`vite.config.ts` manifest 与文档。图标源在 `public/icons/`。推送 `main` 后选择 GitHub Actions Pages；Vite 在 Actions 中自动使用 `/opslingo-lite/` 基路径。

## Azure Speech 配置与发布

1. 创建 Azure Speech 资源后，在 Function App 配置 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION` 和 `ALLOWED_ORIGINS=https://546671791-cell.github.io,http://localhost,https://localhost`。
2. 在 GitHub Secrets 设置 `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`，从 Actions 手动运行 **Deploy Azure Speech Proxy**。
3. 在 GitHub Actions Variables 设置 `VITE_SPEECH_API_URL=https://FUNCTION-NAME.azurewebsites.net/api/pronunciation`，再手动运行 **Deploy GitHub Pages**。
4. 未完成以上配置时，词库、朗读、录音准备与 Android 应用照常可用；上传评分按钮会明确提示服务尚未配置。

## 下一阶段建议

1. 为每个主题补充更细粒度、非模板化的业务分支与评分关键词。
2. 在真实业务脱敏样本上校准纠错规则。
3. 增加可选择的场景包与词汇包导入 UI 预览。
4. 取得 Azure 成本预算与真实设备录音样本后，校准短音频时长和分数提示语。

## 真实 iPhone 15 验收清单

1. Safari 打开 GitHub Pages，分享 → 添加到主屏幕，确认图标/名称。
2. 从主屏幕启动，确认没有地址栏，顶部/底部安全区无遮挡。
3. 完成一个邮件和一个聊天/对话场景；关闭重开后进度仍在。
4. 开启飞行模式，确认首页、场景与已缓存内容可打开；恢复网络后检查内容更新。
5. 更新内容包和应用，确认历史、草稿仍在。
6. 测试浅/深色、中文/英文输入法、键盘弹出、系统大字号和窄屏。
7. 导出到“文件”，清空数据，再导入并确认恢复。
8. 在浏览器网络面板确认没有登录、广告、分析或远程 AI API 请求。
9. 打开任一日常词汇，确认 IPA、朗读、例句与“加入我的词句”可用；点击刷新后确认词句收藏仍在。
10. 若已配置 Azure：授权麦克风、录制短句，确认只有点击“上传并评分”才发起对 Function/Azure 的网络请求；拒绝麦克风权限时页面给出可理解提示。
11. Android：安装 `app-debug.apk`，确认词库、系统朗读、麦克风授权与底部安全区正常。

移动 WebKit 自动化只能模拟，并不能替代以上真机验收。
