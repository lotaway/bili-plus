import { test, expect } from '../fixtures/extension.fixture';

const SUBTITLE_TAB_LABEL = '字幕生成' as const;
const SUMMARY_STATUS_TEXT = '正在使用AI处理字幕...' as const;
const SUMMARY_BUTTON_TEXT = '视频知识总结（按照字幕）' as const;

test.describe('AI Summary Functionality', () => {
    test('should show status message when starting subtitle summary', async ({ sidepanelPage }) => {
        await sidepanelPage.locator('button', { hasText: SUBTITLE_TAB_LABEL }).click();
        await sidepanelPage.locator('button', { hasText: SUMMARY_BUTTON_TEXT }).click();

        await expect(sidepanelPage.locator(`text=${SUMMARY_STATUS_TEXT}`)).toBeVisible();
    });
});
