# OpsLingo Lite / 航旅英语

一个面向中文运营人员的离线 PWA：练习与海外酒店、航司、票务代理沟通时的英文邮件、即时聊天和半开放式对话。它没有账号、后端、跟踪或 AI API；所有学习数据仅保存在当前浏览器的 IndexedDB。

## 功能

- 4 个独立内容包、48 个内置场景（酒店/航班 × 邮件/聊天）
- 本地可追溯规则评分：目标、实体、清晰度、礼貌、表达与格式
- 有限状态对话、提示、参考结构、词句收藏和本地复习
- 进度、连续天数、有效学习时长、导入/导出和去重
- 内容包 SHA-256 校验、原子安装与上一个版本回滚
- PWA 离线壳、应用更新提示、GitHub Pages 与 iPhone 安装适配

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

用 Safari 打开 Pages 地址，点分享按钮，选择“添加到主屏幕”。首次在线加载完成后，应用壳和已下载内容可离线打开。目录检查需要联网；不会上传训练文字或工作内容。

## 备份、隐私与限制

在设置中导出 JSON，建议在清除 Safari 数据或换机前备份。导入可合并或替换，导入指纹会防止同一文件重复统计。规则评分是本地固定规则，不是“AI 精准评分”；它无法理解任意英文语境，也不会保证业务结果、退款或补偿。

## 故障排除

- 内容更新失败：保持旧包，检查网络与 `catalog.json` 摘要。
- 离线首次无法打开：需先在联网状态完成一次加载。
- 真机未见更新：关闭应用后重新打开，或在设置中手动检查内容更新。
