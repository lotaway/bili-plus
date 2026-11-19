# TODO

## [已修复] 合并下载报跨 origin Worker 错误

### 现象
- 选"合并视频（自动合并）"后报：
  `页面上下文下载失败: 视频合并失败: Failed to construct 'Worker':
  Script at 'chrome-extension://.../assets/worker-*.js' cannot be accessed
  from origin 'https://www.bilibili.com'`。

### 根因
- FFmpeg 的 worker 脚本位于扩展 origin，而合并逻辑跑在 bilibili.com 页面上下文，
  浏览器禁止跨 origin 构造 Worker。
- 尝试改由 background 合并后，CDN 对 service worker 的请求返回 HTTP 403
  （请求上下文的 Origin/Referer 不同），故保留页面上下文下载。
- 页面上下文用 blob URL 加载 worker 后又报 `network error`：worker 是 module worker，
  不能用 `importScripts` 加载 UMD core，而 `import()` UMD 脚本拿不到 default 导出，
  抛 `failed to import ffmpeg-core.js`。

### 修复
1. `vite.config.ts`：构建时把 FFmpeg worker 复制为固定名
   `assets/ffmpeg-worker.js`；`manifest.json` 加入 web accessible resources。
2. `video_page_inject.ts`：从注入脚本的 `currentScript.src` 取扩展 origin，
   fetch 该 worker 并转成 blob URL，通过 `classWorkerURL` 交给 FFmpeg。
3. `FFmpegUtils.load()`：core/wasm 从 `/dist/umd/` 换成 `/dist/esm/`，
   module worker 才能通过 `import()` 拿到 `createFFmpegCore`。
4. 下载仍走页面上下文（Range 分段 + `credentials: 'omit'`）。

### 验证
- 本地真实网络合并下载成功，得到 `.mp4`（43.5s）。
- 本地全量 22 个用例通过（含真实网络下载，未 mock）。

## [已修复，CI 全绿] GitHub Actions E2E 测试在 CI 上持续失败

### 进展
- 第一轮修复（`daf68da`）推送后 CI run `44252136657`：
  **21 个用例 20 通过，仅剩 `video_download_e2e.spec.ts` 失败**；
  原先的 `ai-summary`、`integration`、`study-automation` 均已通过。
- 剩余失败的根因是测试竞态：点击“从当前页面解析”后没有等待解析完成，
  CI 较慢时立即点击下载，页面提示 `请先输入BVID和CID`，
  因此从未发出下载请求（trace 中可见该错误状态）。30s 的默认超时对
  “真实网络加载 + 完整音视频下载”也偏紧。
- 第二轮修复：`video_download_e2e.spec.ts` 增加 `test.setTimeout(180_000)`，
  用 `expect().toPass()` 重试解析直到出现 `已解析: BVID=`，
  并为下载事件单独设置 120s 超时；仍然是真实网络下载，未 mock、未跳过。
- 第二轮修复（`a0a9a45`）推送后 CI run `44254113689`：仍然 21 个用例
  20 通过，仅 `video_download_e2e` 失败（3 次重试，共 ~417s）。
  此时解析已成功（trace 中第二次重试出现 `已解析: BVID=BV1L3sz6vEza`），
  但等待 120s 仍没有 download 事件，侧边栏显示
  `页面上下文下载失败: Failed to fetch`。
- 第三轮根因（来自 run `44254113689` 的 trace）：
  1. B 站按 `Accept-Language` 在文档加载完成后再做一次整页跳转；
     trace 中 `/video/BV1L3sz6vEza/` 先 `412`、再 `200`，
     随后在点击下载约 900ms 后跳转到 `/en/video/BV1L3sz6vEza/`。
  2. 整页跳转会销毁页面上下文，使页面内的 `fetch`（WBI nav / playurl）
     被中止并抛出 `Failed to fetch`，于是从未发起真正的取流下载。
     测试恰好在这个跳转窗口内点击了下载。
- 第三轮修复（`7f4a654`）推送后 CI run `44257593003`：仍是 21 个用例
  20 通过、仅 `video_download_e2e` 失败（~435s），但失败点后移了：
  解析成功、侧边栏进入 `开始页面上下文下载...`，最终仍是
  `页面上下文下载失败: Failed to fetch`，trace 里出现取流 CDN 的
  `net::ERR_FAILED`。
- 真正根因（run `44257593003` 的 console）：**CORS，而非跳转**。
  1. `DownloadUtils.downloadToBlob` 用 `credentials: 'include'` 跨域请求
     取流 CDN；
  2. CI 海外节点下 CDN 返回 `Access-Control-Allow-Origin: *`，或
     `Access-Control-Allow-Credentials` 为空，与 `include` 冲突，控制台明确报
     `The value of the 'Access-Control-Allow-Origin' header ... must not be the wildcard '*' when the request's credentials mode is 'include'`；
  3. 本地（国内节点）CDN 返回精确 origin + `credentials: true`，
     所以 `include` 在本地一直能过，问题只在 CI 暴露。
- CORS 修复（`765f51a`）推送后 CI run `44261664251`：22 个用例 21 通过，
  新回归测试通过，但 `video_download_e2e` 仍失败（~426s）。
  CORS 错误确实消失了，取流请求真的发到了 CDN，但 CDN 返回 HTTP 567
  （`content-type: text/html` 的错误页）。
- 567 的差异点：播放器自己的成功请求全部带 `Range` 头并返回 206，
  而 `downloadToBlob` 是一次性请求完整文件。海外 CDN 拒绝无 Range 的取流。
- 最终修复：`DownloadUtils.downloadToBlob` 改为 2 MiB 的 **Range 分段下载**，
  按 `content-range` 解析总长度、拼接分片，保留 `credentials: 'omit'`
  以避免 CORS。对应回归测试也断言 `Range` 头与 omit 凭据。
  本地真实网络下载 27.8s 通过，未 mock。
- 最终验证：CI run `44264339049`（#26，提交 `797f098`）**全部 22 个用例通过**，
  workflow conclusion = `SUCCESS`，耗时 2m20s。

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
- 第二轮修复后，本地以同样的 CI 模拟环境单独运行
  `video_download_e2e.spec.ts`：22.1s 通过。
- 第三轮修复：E2E 在解析前等待页面稳定（URL 连续 5s 不变）、等
  `#bili-plus-generate-btn` 与 `__INITIAL_STATE__.videoData` 就绪，并在下载前
  再做一次 2s 稳定检查 + `page.bringToFront()`。这消除了跳转中止 fetch 的风险，
  但 run `44257593003` 表明它不是 CI 失败的根因。
- 最终修复（CORS + 567）：`src/utils/DownloadUtils.ts` 的 `downloadToBlob`
  改用 `credentials: 'omit'` 并按 2 MiB 分段带 `Range` 请求；
  新增 `tests/specs/download_utils_credentials.spec.ts` 回归测试。
- 验证：`yarn build` 通过；新单元测试通过；本地同样环境真实网络下载
  27.8s 通过；第三轮修复后本地连续 2 次 27.7s / 28.1s 通过。
- 单独脚本验证 `/en` 与 `/en/video/BV1L3sz6vEza/` 均能注入对应内容脚本。
- `tests/specs/url.spec.ts` 4 个用例通过。
- 说明：以上 Edge/locale 仅为本地复现 CI 的临时手段，已从
  `tests/fixtures/extension.fixture.ts` 还原，测试仍使用默认 Chromium。

### 备注
- 未跳过任何工作流步骤，未 mock `video_download_e2e.spec.ts`，
  仍为真实网络下载；仅修正了失效数据（BV 号）、`/en` 适配、
  测试时序/超时，以及 CDN 下载的 CORS credentials 与 Range 分段问题。
- 结论：CI run `44264339049` 与 `44265091364` 均已全绿。
  合并下载修复后需再观察一次 CI。
