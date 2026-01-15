import { type BrowserContext, type Page, expect } from '@playwright/test';

export class ExtensionSidepanel {
    constructor(public readonly page: Page) { }

    static async waitFor(context: BrowserContext) {
        const sidepanelUrlPattern = /sidepanel/;

        await expect.poll(async () => {
            const pages = context.pages();
            return pages.find(p => sidepanelUrlPattern.test(p.url()));
        }, {
            message: 'Sidepanel page not found in context',
            timeout: 10000
        }).toBeTruthy();

        const page = context.pages().find(p => sidepanelUrlPattern.test(p.url()));
        if (!page) throw new Error('Sidepanel page should exist after polling');

        return new ExtensionSidepanel(page);
    }

    async clickAutoStudy() {
        await this.page.locator('button', { hasText: '自动学习' }).click();
    }

    async clickStartScan() {
        await this.page.locator('button', { hasText: '开始自动扫描' }).click();
    }

    async expectScanComplete() {
        await expect(this.page.locator('text=自动化学习完成')).toBeVisible({ timeout: 30000 });
    }

    async expectVideoSubmitted(count: number) {
        await expect(this.page.locator(`text=已提交 ${count} 个视频`)).toBeVisible();
    }

    async expectWarningMessage(text: string) {
        await expect(this.page.locator(`text=${text}`)).toBeVisible({ timeout: 10 * 1000 });
    }

    async mockChatCompletion() {
        await this.page.route('**/v1/chat/completions', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify([
                                {
                                    category: 'class',
                                    link: 'https://www.bilibili.com/video/BV1test123',
                                    level: 9,
                                    confidence: 10,
                                    reason: 'High quality tutorial'
                                }
                            ])
                        }
                    }]
                })
            });
        });
    }
}
