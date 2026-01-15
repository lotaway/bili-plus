import { Page } from '@playwright/test';
import { TEST_TIMEOUTS } from './test-constants';

export class TestPageHelper {
    static async activatePage(page: Page): Promise<void> {
        await page.bringToFront();
        await page.waitForTimeout(TEST_TIMEOUTS.PAGE_ACTIVATION);
    }

    static async checkContentScriptLoaded(page: Page): Promise<boolean> {
        return await page.evaluate(() => {
            return !!(document.getElementById('home_page_inject'));
        });
    }
}
