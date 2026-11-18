# TODO

## [已修复，待 CI 验证] GitHub Actions E2E 测试在 CI 上持续失败

### 现象
- 工作流 `.github/workflows/e2e.yml`（E2E Tests）在每次 push 后运行，持续失败。
- 最新失败 run: #20 (`44137070001`)，提交 `70958fe`，链接:
  https://github.com/lotaway/bili-plus/actions/runs/44137070001
- 失败步骤固定为 **step 7 "Run Playwright tests"**（`xvfb-run yarn test`）。
  - step 1–6（checkout / setup-node / install deps / install playwright browsers / build）均成功。
  - step 8 上传 artifact 成功（说明 playwright-report 已生成）。
- Annotation 仅有 `Process completed with exit code 1.`，无具体测试失败信息。

### 根因（来自 run #20 的 playwright-report artifact）
CI 的真实失败为 4 个用例（其余 13 个通过）：

1. `ai-summary.spec.ts`
2. `integration.spec.ts`
3. `study-automation.spec.ts`（首页校验那条）
4. `video_download_e2e.spec.ts`

CI 环境（Ubuntu/Chromium）默认 `Accept-Language: en-US`，B 站会把首页和视频页
重定向到英文站点 `/en`、`/en/video/...`。而此前扩展只声明/识别：

- 内容脚本 match pattern：`*://www.bilibili.com/video/*`、`.../`（根路径）；
- `home.ts` 与 `StudyAutomationPanel.tsx` 的首页判断也只认 `/` 与 `/?...`。

于是：

- 首页上 `home.js` 不会注入 → `#bili-plus-home-generate-btn` 不存在（integration 失败）；
  学习机面板判定当前标签页不是首页（study-automation 失败）。
- 视频页 `video.js` 不会注入 → `chrome.tabs.sendMessage` 没有接收方，
  下载请求从未发出，测试等待下载超时（video_download_e2e 失败）；
  trace 中可见 `GET /video/BV... -> 412` 后跳转 `/en/video/...`，
  且请求头为 `Accept-Language: en-US`。
- `ai-summary.spec.ts` 断言的是一个会被后台错误响应瞬间覆盖的临时文案
  “正在使用AI处理字幕...”，实际稳定出现的是 `Video info not initialized`。

### 修复
1. `public/manifest.json`
   - 视频页内容脚本增加 `*://www.bilibili.com/en/video/*`、
     `*://www.bilibili.com/en/list/watchlater?*`。
   - 首页内容脚本增加 `/en`、`/en/`、`/en/?*`（http/https）。
2. 新增 `src/utils/url.ts::isBilibiliHomepageUrl()`，统一判断首页：
   `www.bilibili.com` / `bilibili.com` 上的 `/`、`/index.html`、`/en`、`/en/`、
   `/en/index.html`，并忽略 query。
   - `src/entry/content/home.ts` 与
     `src/features/studyAutomation/StudyAutomationPanel.tsx` 改为使用它。
3. `tests/specs/ai-summary.spec.ts` 改为断言确定性的错误路径
   `Video info not initialized`（非视频页面打开侧边栏时的真实行为）。
4. 新增 `tests/specs/url.spec.ts`，覆盖中文首页、`/en` 首页及非首页的回归用例。

### 验证
- `yarn build` 通过。
- 本地以系统 Edge，并模拟 CI 的 `locale: 'en-US'` 跑目标用例：
  `ai-summary`、`integration`、`study-automation`、`video_download_e2e`
  全部通过（真实网络下载，未 mock）。
- 单独脚本验证 `/en` 与 `/en/video/BV1L3sz6vEza/` 均能注入对应内容脚本。
- `tests/specs/url.spec.ts` 4 个用例通过。
- 说明：以上 Edge/locale 仅为本地复现 CI 的临时手段，已从
  `tests/fixtures/extension.fixture.ts` 还原，测试仍使用默认 Chromium。

### 备注
- 未跳过任何工作流步骤，未 mock `video_download_e2e.spec.ts`，
  仍为真实网络下载；仅修正了失效数据（BV 号）与 `/en` 适配。
- 剩余动作：推送后观察 CI 是否全绿。若仍有失败，重点看
  `video_download_e2e.spec.ts` 在无登录 cookie / 风控下的表现。
