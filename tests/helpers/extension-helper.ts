import { type Page, type BrowserContext } from '@playwright/test';

export async function waitForExtensionReady(context: BrowserContext) {
    const [worker] = context.serviceWorkers();
    if (worker) return worker;
    return await context.waitForEvent('serviceworker');
}

export async function getExtensionMessages(page: Page) {
    return await page.evaluate(() => {
        return (window as any).EXTENSION_MESSAGES || [];
    });
}
