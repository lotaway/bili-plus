import { test, expect } from '../fixtures/extension.fixture';

test.describe('SidePanel Tabs', () => {
    test('should switch between tabs', async ({ sidepanelPage }) => {
        await sidepanelPage.locator('button', { hasText: '自动学习' }).click();
        await expect(sidepanelPage.locator('h3', { hasText: '自动学习机' })).toBeVisible();

        await sidepanelPage.locator('button', { hasText: '字幕生成' }).click();
        await expect(sidepanelPage.locator('button', { hasText: 'AI 总结' })).toBeVisible();
    });
});
