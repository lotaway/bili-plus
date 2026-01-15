import { test, expect } from '../fixtures/extension.fixture';

const TAB_LABELS = {
    AUTO_STUDY: '自动学习',
    SUBTITLE: '字幕生成',
} as const;

const PANEL_HEADERS = {
    AUTO_STUDY: '自动学习机',
} as const;

const PANEL_BUTTONS = {
    AI_SUMMARY: '视频知识总结（按照字幕）',
} as const;

test.describe('SidePanel Tabs', () => {
    test('should switch between tabs', async ({ sidepanelPage }) => {
        await switchToAutoStudyTab(sidepanelPage);
        await verifyAutoStudyTabVisible(sidepanelPage);

        await switchToSubtitleTab(sidepanelPage);
        await verifySubtitleTabVisible(sidepanelPage);
    });
});

async function switchToAutoStudyTab(page: any) {
    await page.locator('button', { hasText: TAB_LABELS.AUTO_STUDY }).click();
}

async function verifyAutoStudyTabVisible(page: any) {
    await expect(page.locator('h3', { hasText: PANEL_HEADERS.AUTO_STUDY })).toBeVisible();
}

async function switchToSubtitleTab(page: any) {
    await page.locator('button', { hasText: TAB_LABELS.SUBTITLE }).click();
}

async function verifySubtitleTabVisible(page: any) {
    await expect(page.locator('button', { hasText: PANEL_BUTTONS.AI_SUMMARY })).toBeVisible();
}
