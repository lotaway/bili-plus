# TODO

## [待解决] GitHub Actions E2E 测试在 CI 上持续失败

### 现象
- 工作流 `.github/workflows/e2e.yml`（E2E Tests）在每次 push 后运行，持续失败。
- 最新失败 run: #20 (`44137070001`)，提交 `70958fe`，链接:
  https://github.com/lotaway/bili-plus/actions/runs/44137070001
- 失败步骤固定为 **step 7 "Run Playwright tests"**（`xvfb-run yarn test`）。
  - step 1–6（checkout / setup-node / install deps / install playwright browsers / build）均成功。
  - step 8 上传 artifact 成功（说明 playwright-report 已生成）。
- Annotation 仅有 `Process completed with exit code 1.`，无具体测试失败信息。

### 已确认的事实
1. 曾因 Playwright 1.57.0 不支持 Ubuntu 26 导致 step 5（浏览器安装）失败；
   升级到 `@playwright/test@^1.65.1` 后已修复，step 5 现通过。
2. 历史 run #17 之前失败在 step 5；#18/#19/#20 失败在 step 7。
3. 测试套件中 `tests/specs/video_download_e2e.spec.ts` 是"真实网络下载"测试，
   原视频 `BV19PFGzMENr` 已失效，已在 #20 提交中改为有效视频 `BV1L3sz6vEza`。
4. 本地用系统 Edge（临时把 fixture 的 launcher 改为 `channel: 'msedge'`）跑测试：
   - 纯 UI / mock 类测试（basic、debug、tab-switch、subtitle、integration）全部通过；
   - `video_download_e2e.spec.ts` 换成有效 BV 号后本地也通过（约 9s）。
   - 即：**本地全通过，但 CI 仍失败**。

### 待排查方向
- CI 的 Ubuntu + xvfb + bundled Chromium 环境与本地 macOS + Edge 存在差异，
  需拿到 CI 的真实失败日志才能定位具体失败用例。
- CI 日志和 artifact 通过匿名 API 无法下载（需仓库管理员权限 / 认证）：
  - `GET /actions/jobs/{job_id}/logs` 返回 403 "Must have admin rights to Repository."
  - artifact zip 返回 401 "Requires authentication"
  - `check-runs/.../annotations` 只有 `exit code 1`，无细节。
- **下一步（需要仓库所有者配合任一）**：
  1. 在 GitHub Actions 页面打开 run #20，展开 step 7 的日志，把失败用例名与错误贴出；
     或
  2. 提供有权限的 GitHub token（`gh` CLI 登录后可用 `gh run view <id> --log-failed`），
     以便下载日志/artifact 定位；
  3. 或在 workflow 中为 step 7 增加日志输出（如 `--reporter=list` 已经有了，可加
     `DEBUG=pw:api` 或把 `playwright-report` 的内容在失败时打印），再跑一次拿日志。
- 拿到日志后重点怀疑：
  - `video_download_e2e.spec.ts` 的真实网络下载在 CI 无登录 cookie / 风控下失败；
  - extension 加载 / service worker 就绪时序在无头 xvfb 下不稳定；
  - 其它尚未在 CI 环境验证过的用例。

### 备注
- 用户明确要求：不允许跳过流程、不允许 mock 真实 e2e（`video_download_e2e.spec.ts`
  必须保持真实网络下载），仅修正数据（BV 号）。
- 因此解决方向应是在保持完整真实流程的前提下，让 CI 环境具备通过条件
  （例如处理未登录/风控、增加重试、改善时序等待），而不是跳过或 mock。
