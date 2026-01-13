import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export type ExtensionFixtures = {
    context: BrowserContext;
    extensionId: string;
    popupPage: any;
    sidepanelPage: any;
};

export const test = base.extend<ExtensionFixtures>({
    context: async ({ }, use: (r: BrowserContext) => Promise<void>) => {
        const pathToExtension = path.resolve(__dirname, '../../dist');
        const context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ],
        });
        await use(context);
        await context.close();
    },

    extensionId: async ({ context }: { context: BrowserContext }, use: (r: string) => Promise<void>) => {
        let [serviceWorker] = context.serviceWorkers();
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker');
        }
        const extensionId = serviceWorker.url().split('/')[2];
        await use(extensionId);
    },

    popupPage: async ({ context, extensionId }: { context: BrowserContext; extensionId: string }, use: (r: any) => Promise<void>) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/src/entry/popup/index.html`);
        await use(page);
        await page.close();
    },

    sidepanelPage: async ({ context, extensionId }: { context: BrowserContext; extensionId: string }, use: (r: any) => Promise<void>) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/src/entry/sidepanel/index.html`);
        await use(page);
        await page.close();
    },
});

export const expect = test.expect;
