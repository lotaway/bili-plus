import { test, expect } from '../fixtures/extension.fixture';

const SCREENSHOT_BUTTON_TEXT = '界面总结（截图分析）' as const;

test.describe('Screenshot Analysis Functionality', () => {
    test('should display screenshot analysis button', async ({ sidepanelPage }) => {
        await expect(
            sidepanelPage.locator('button', { hasText: SCREENSHOT_BUTTON_TEXT })
        ).toBeVisible();
    });
});
