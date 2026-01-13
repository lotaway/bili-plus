import { type Page, expect } from '@playwright/test';

export class ExtensionPopup {
    constructor(public readonly page: Page) { }

    async isOpen() {
        await expect(this.page).toHaveTitle(/BILI PLUS/);
    }

    async getSettings() {
        // Assuming settings are visible in the UI
        return await this.page.evaluate(() => {
            // Logic to extract settings from the page
            return {};
        });
    }
}
