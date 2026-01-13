import { type Page, expect } from '@playwright/test';

export class SidePanel {
    constructor(public readonly page: Page) { }

    async selectTab(tabName: string) {
        await this.page.click(`text=${tabName}`);
    }

    async getSubtitleContent() {
        return await this.page.textContent('.subtitle-list');
    }

    async getSummaryContent() {
        return await this.page.textContent('.summary-content');
    }

    async clickDownloadButton() {
        await this.page.click('button:has-text("下载")');
    }

    async clickAnalyzeButton() {
        await this.page.click('button:has-text("AI 总结")');
    }

    async sendMessage(message: string) {
        await this.page.fill('textarea', message);
        await this.page.keyboard.press('Enter');
    }
}
