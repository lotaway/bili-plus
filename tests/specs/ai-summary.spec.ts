import { test, expect } from '../fixtures/extension.fixture';

const SUBTITLE_TAB_LABEL = '字幕生成' as const;
const SUMMARY_BUTTON_TEXT = '视频知识总结（按照字幕）' as const;
const MISSING_VIDEO_INFO_TEXT = 'Video info not initialized' as const;

test.describe('AI Summary Functionality', () => {
    test('should report missing video info when starting subtitle summary outside a video page', async ({ sidepanelPage }) => {
        // 侧边栏在非视频页面打开时没有视频信息，点击总结应立即给出明确提示。
        // 这里验证的是错误路径，而不是会被后台响应瞬间覆盖的“处理中”临时状态。
        await sidepanelPage.locator('button', { hasText: SUBTITLE_TAB_LABEL }).click();
        await sidepanelPage.locator('button', { hasText: SUMMARY_BUTTON_TEXT }).click();

        await expect(sidepanelPage.locator(`text=${MISSING_VIDEO_INFO_TEXT}`)).toBeVisible();
    });
});
