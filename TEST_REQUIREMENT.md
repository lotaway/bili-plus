# Bilibili Plus 端到端测试方案

## 项目概述

Bilibili Plus 是一个基于 Manifest V3 的 Chrome 浏览器扩展，用于增强 B 站视频观看体验。项目采用 TypeScript + React + Vite 技术栈，包含多个入口点和复杂的交互场景。

### 项目架构

- **Manifest Version**: V3
- **Background**: Service Worker (`background.js`)
- **Content Scripts**: 
  - `video.js` - 视频页面注入脚本
  - `home.js` - 首页注入脚本
- **UI 入口**:
  - Popup 页面 (`popup.html`)
  - Side Panel 侧边栏 (`sidepanel.html`)
- **Inject Scripts**:
  - `home_page_inject.ts` - 首页注入
  - `video_page_inject.ts` - 视频页面注入

### 核心功能模块

1. **字幕提取** - 自动提取视频字幕并支持 SRT/Markdown 格式导出
2. **AI 字幕总结** - 使用 AI 模型对字幕内容进行智能分析和总结
3. **截图分析** - 截取当前页面并使用 AI 分析界面内容
4. **AI 智能助手** - 与 AI 进行对话获取视频相关帮助（支持 Streaming 流式响应）
5. **学习计划** - 每日自动学习计划功能
6. **侧边栏状态同步** - 确保插件在不同页面间保持状态一致性

## 测试技术方案

### 技术选型：Playwright

**选择理由**：

1. **官方支持** - Playwright 提供原生 Chrome 扩展测试支持
2. **Manifest V3 兼容** - 完美支持 Service Worker 和现代扩展特性
3. **TypeScript 支持优秀** - 与项目技术栈高度契合
4. **测试能力全面** - 可测试所有扩展入口点（popup、sidepanel、content script、background）
5. **社区活跃** - 文档完善，示例丰富
6. **跨浏览器支持** - 可扩展到 Firefox、Edge 等其他浏览器

### 测试架构设计

```
bili-plus-e2e/
├── playwright.config.ts          # Playwright 配置文件
├── tests/
│   ├── fixtures/                 # 测试夹具
│   │   ├── extension.fixture.ts  # 扩展专用夹具
│   │   ├── pages.fixture.ts      # 页面访问夹具
│   │   └── mock-server.ts        # Mock 服务器
│   ├── helpers/                  # 测试辅助函数
│   │   ├── bilibili-helper.ts    # B站页面操作辅助
│   │   ├── extension-helper.ts   # 扩展操作辅助
│   │   └── ai-mock.ts           # AI 服务模拟
│   ├── page-objects/             # 页面对象模式
│   │   ├── BilibiliVideoPage.ts  # B站视频页面对象
│   │   ├── ExtensionPopup.ts     # Extension Popup 页面对象
│   │   └── SidePanel.ts          # Side Panel 页面对象
│   └── specs/                    # 测试用例
│       ├── basic.spec.ts         # 基础功能测试
│       ├── subtitle.spec.ts      # 字幕提取功能测试
│       ├── ai-summary.spec.ts    # AI 总结功能测试
│       ├── screenshot.spec.ts    # 截图分析功能测试
│       └── integration.spec.ts   # 集成测试
├── test-data/                    # 测试数据
│   ├── sample-subs.json         # 示例字幕数据
│   └── mock-responses/          # Mock API 响应
└── test-results/                 # 测试结果输出
```

## 测试环境搭建任务列表

### 阶段 1：环境准备

- [ ] 安装 Playwright 及相关依赖
  - `yarn add -D @playwright/test`
  - `yarn playwright install chromium`
  - `yarn playwright install-deps chromium`

- [ ] 创建测试目录结构
  - 创建 `tests/` 目录
  - 创建子目录：`fixtures/`、`helpers/`、`page-objects/`、`specs/`
  - 创建 `test-data/` 目录
  - 创建 `test-results/` 目录

- [ ] 配置 TypeScript 支持
  - 修改 `tsconfig.json`，添加 `tests/` 到 include
  - 配置测试文件的 TypeScript 编译选项

- [ ] 配置 Playwright
  - 创建 `playwright.config.ts`
  - 配置 Chromium 浏览器
  - 配置扩展加载路径（指向 `dist/` 目录）
  - 配置测试报告输出

### 阶段 2：核心夹具开发

- [ ] 创建扩展加载夹具 (`extension.fixture.ts`)
  - 实现 `context` fixture：加载已编译的扩展
  - 实现 `extensionId` fixture：获取扩展 ID
  - 实现 `backgroundPage` fixture：访问 Service Worker
  - 实现 `popupPage` fixture：访问 Popup 页面
  - 实现 `sidepanelPage` fixture：访问 Side Panel

- [ ] 创建 B站页面访问夹具 (`pages.fixture.ts`)
  - 实现 `bilibiliVideoPage` fixture：访问视频页面
  - 实现 `bilibiliHomePage` fixture：访问 B站首页
  - 实现 `testVideoPage` fixture：访问本地测试视频页面（可选）

- [ ] 创建 Mock 服务器 (`mock-server.ts`)
  - 实现 API 响应 Mock（B站 API、AI API）
  - 实现字幕数据 Mock
  - 实现登录状态 Mock

### 阶段 3：测试辅助函数开发

- [ ] B站页面操作辅助 (`bilibili-helper.ts`)
  - 函数：`waitForVideoPlayer()` - 等待视频播放器加载
  - 函数：`waitForSubtitles()` - 等待字幕加载
  - 函数：`getCurrentVideoId()` - 获取当前视频 ID
  - 函数：`isVideoPlaying()` - 检查视频是否播放中
  - 函数：`toggleVideoPlay()` - 切换视频播放/暂停

- [ ] 扩展操作辅助 (`extension-helper.ts`)
  - 函数：`openPopup()` - 打开扩展 Popup
  - 函数：`openSidePanel()` - 打开侧边栏
  - 函数：`clickExtensionIcon()` - 点击扩展图标
  - 函数：`waitForExtensionReady()` - 等待扩展初始化完成
  - 函数：`getExtensionMessages()` - 获取扩展消息记录

- [ ] AI 服务模拟 (`ai-mock.ts`)
  - 函数：`mockAISummaryResponse()` - Mock AI 总结响应
  - 函数：`mockAIChatResponse()` - Mock AI 对话响应
  - 函数：`mockAIStreamingResponse()` - Mock AI 流式（SSE）响应
  - 函数：`mockScreenshotAnalysis()` - Mock 截图分析响应

### 阶段 4：页面对象开发

- [ ] B站视频页面对象 (`BilibiliVideoPage.ts`)
  - 方法：`getVideoTitle()` - 获取视频标题
  - 方法：`getVideoDuration()` - 获取视频时长
  - 方法：`seekTo(time)` - 跳转到指定时间
  - 方法：`getSubtitleElement()` - 获取字幕元素

- [ ] Extension Popup 页面对象 (`ExtensionPopup.ts`)
  - 方法：`isOpen()` - 检查 Popup 是否打开
  - 方法：`clickSettings()` - 点击设置按钮
  - 方法：`getSettings()` - 获取当前设置
  - 方法：`setSettings(config)` - 设置配置

- [ ] Side Panel 页面对象 (`SidePanel.ts`)
  - 方法：`selectTab(tabName)` - 切换标签页
  - 方法：`getSubtitleContent()` - 获取字幕内容
  - 方法：`getSummaryContent()` - 获取总结内容
  - 方法：`clickDownloadButton()` - 点击下载按钮
  - 方法：`clickAnalyzeButton()` - 点击分析按钮
  - 方法：`sendMessage(message)` - 发送 AI 对话消息

### 阶段 5：基础功能测试用例

- [ ] 扩展加载测试 (`basic.spec.ts`)
  - 测试：扩展成功加载
  - 测试：Service Worker 正常运行
  - 测试：Popup 页面可正常打开
  - 测试：Side Panel 可正常打开
  - 测试：Content Script 注入成功
  - 测试：扩展图标显示正常

- [ ] 扩展权限测试 (`basic.spec.ts`)
  - 测试：正确请求和获取权限
  - 测试：访问 activeTab 权限
  - 测试：访问 storage 权限
  - 测试：访问 downloads 权限

### 阶段 6：字幕功能测试用例

- [ ] 字幕提取测试 (`subtitle.spec.ts`)
  - 测试：在视频页面成功注入 Content Script
  - 测试：正确识别视频字幕语言
  - 测试：提取字幕内容完整性
  - 测试：字幕时间戳准确性
  - 测试：多语言字幕切换功能
  - 测试：无字幕视频的处理

- [ ] 字幕导出测试 (`subtitle.spec.ts`)
  - 测试：导出 SRT 格式文件
  - 测试：导出 Markdown 格式文件
  - 测试：下载文件命名正确
  - 测试：文件内容格式正确
  - 测试：长字幕分段导出

### 阶段 7：AI 功能测试用例

- [ ] AI 总结测试 (`ai-summary.spec.ts`)
  - 测试：点击总结按钮触发请求
  - 测试：AI 总结正常生成（包含流式进度验证）
  - 测试：总结内容并在 Side Panel 中实时正确显示
  - 测试：处理字幕过长情况
  - 测试：处理 API 错误情况
  - 测试：处理网络超时情况

- [ ] 截图分析测试 (`screenshot.spec.ts`)
  - 测试：截图功能正常执行
  - 测试：截图内容正确传递
  - 测试：AI 分析结果正确显示
  - 测试：处理截图失败情况

- [ ] AI 智能助手测试 (`ai-summary.spec.ts`)
  - 测试：打开 AI 对话界面
  - 测试：发送消息并接收回复
  - 测试：多轮对话功能
  - 测试：对话历史显示
  - 测试：清空对话历史

### 阶段 8：集成测试用例

- [ ] 完整工作流测试 (`integration.spec.ts`)
  - 测试：打开 B站视频 → 提取字幕 → 生成总结
  - 测试：打开 B站视频 → 截图分析 → 获取结果
  - 测试：完整学习计划执行流程
  - 测试：从首页进入视频页面的功能衔接

- [ ] 多页面协作测试 (`integration.spec.ts`)
  - 测试：Popup 和 Side Panel 数据同步
  - 测试：Background 消息传递正确性
  - 测试：Content Script 与 Background 通信
  - 测试：Side Panel 与 Inject Script 交互

### 阶段 9：CI/CD 集成

- [ ] 配置 GitHub Actions
  - 创建 `.github/workflows/e2e.yml`
  - 配置 Chromium 安装步骤
  - 配置测试运行步骤
  - 配置测试报告上传
  - 配置失败通知

- [ ] 配置测试报告
  - 生成 HTML 测试报告
  - 配置截图保存（失败时）
  - 配置视频录制（可选）
  - 配置测试结果持久化

### 阶段 10：测试数据准备

- [ ] 准备测试视频数据
  - 创建带有字幕的测试视频 URL
  - 创建无字幕的测试视频 URL
  - 创建多语言字幕的测试视频 URL
  - 记录视频元数据（ID、时长等）

- [ ] 准备 Mock API 数据
  - B站视频信息 API 响应
  - B站字幕 API 响应
  - AI 总结 API 响应
  - AI 对话 API 响应
  - 错误场景 API 响应

## 实施步骤建议

### 第 1 周：环境搭建 + 基础夹具
1. 安装依赖和配置 Playwright
2. 创建目录结构
3. 实现扩展加载夹具
4. 实现基础功能测试（扩展加载）

### 第 2 周：辅助函数 + 页面对象
1. 实现所有辅助函数
2. 实现页面对象类
3. 完成基础测试用例
4. 测试框架验证

### 第 3 周：核心功能测试
1. 实现字幕功能测试
2. 实现 AI 总结功能测试
3. 实现截图分析功能测试
4. 修复发现的问题

### 第 4 周：集成测试 + CI/CD
1. 实现集成测试用例
2. 配置 GitHub Actions
3. 准备测试数据
4. 完善测试报告

## Playwright 配置示例

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'dist')}`,
            `--load-extension=${path.resolve(__dirname, 'dist')}`,
          ],
        },
      },
    },
  ],
});
```

## 扩展夹具示例

```typescript
// tests/fixtures/extension.fixture.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  backgroundPage: any;
  popupPage: any;
  sidepanelPage: any;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, '../../dist');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/entry/popup/index.html`);
    await use(page);
    await page.close();
  },

  sidepanelPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/entry/sidepanel/index.html`);
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;
```

## 测试用例示例

```typescript
// tests/specs/basic.spec.ts
import { test, expect } from '../fixtures/extension.fixture';

test.describe('扩展基础功能', () => {
  test('扩展成功加载', async ({ context, extensionId }) => {
    // 验证扩展 ID 存在
    expect(extensionId).toBeTruthy();
    expect(extensionId.length).toBe(32);
  });

  test('Popup 页面可正常打开', async ({ popupPage }) => {
    // 验证 Popup 页面加载成功
    await expect(popupPage).toHaveTitle(/Bilibili Plus/);
    const content = await popupPage.textContent('body');
    expect(content).toBeTruthy();
  });

  test('Side Panel 可正常打开', async ({ sidepanelPage }) => {
    // 验证 Side Panel 页面加载成功
    await expect(sidepanelPage).toHaveTitle(/Bilibili Plus/);
    const content = await sidepanelPage.textContent('body');
    expect(content).toBeTruthy();
  });
});
```

## 注意事项和最佳实践

### 测试稳定性
1. **等待策略**：使用 `waitForXXX()` 而非固定 `timeout`
2. **重试机制**：在 CI 环境中配置重试次数
3. **隔离性**：每个测试用例独立运行，不依赖其他测试
4. **清理工作**：确保测试后正确关闭页面和上下文

### Mock 策略
1. **API Mock**：Mock B站和 AI API，避免依赖外部服务
2. **测试数据**：使用固定的测试视频和数据
3. **网络条件**：模拟不同网络环境（慢速、离线）
4. **错误场景**：测试各种错误和异常情况

### 性能考虑
1. **并行执行**：合理配置 workers 数量
2. **资源复用**：复用 browser context
3. **超时设置**：为每个操作设置合理超时
4. **资源清理**：及时释放不用的资源

### 可维护性
1. **页面对象模式**：封装页面操作，提高可维护性
2. **辅助函数**：抽取通用操作到辅助函数
3. **测试数据分离**：测试数据独立管理
4. **命名规范**：使用清晰的测试命名

### 持续集成
1. **自动化运行**：每次 PR 和提交自动运行测试
2. **快速反馈**：配置快速失败机制
3. **测试报告**：生成详细的测试报告
4. **失败通知**：配置邮件或消息通知

## 预期收益

实施完整的端到端测试方案后，项目将获得以下收益：

1. **质量保障**：覆盖核心功能，确保版本稳定性
2. **回归测试**：快速发现功能回归问题
3. **重构信心**：为代码重构提供安全网
4. **文档价值**：测试用例作为功能使用示例
5. **团队协作**：统一的测试规范提高团队效率
6. **发布信心**：自动化测试提高发布信心

## 后续优化方向

1. **视觉回归测试**：集成 Percy 或类似工具
2. **性能测试**：添加页面加载和响应性能测试
3. **覆盖率分析**：集成代码覆盖率工具
4. **测试报告优化**：生成更详细的测试报告
5. **AI 辅助测试**：探索使用 AI 生成测试用例
6. **跨浏览器测试**：扩展到 Firefox、Edge 等浏览器

---

**文档版本**: 1.0  
**创建日期**: 2026-01-13  
**维护者**: 开发团队
