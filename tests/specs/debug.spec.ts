import { test, expect } from '../fixtures/extension.fixture'

const SIDE_PANEL_TABS = {
    SUBTITLE: '字幕生成',
    CALCULATOR: '贷款计算器',
    DOWNLOAD: '视频下载',
    STUDY: '自动学习',
} as const

test.describe('Sidepanel labels', () => {
    test('should display all main tabs', async ({ sidepanelPage }) => {
        for (const label of Object.values(SIDE_PANEL_TABS)) {
            await expect(sidepanelPage.locator('button', { hasText: label })).toBeVisible()
        }
    })
})
