import { test as base, chromium, Page, type BrowserContext } from '@playwright/test';
import path from 'path';

export type ExtensionFixtures = {
    context: BrowserContext;
    extensionId: string;
    popupPage: Page;
    sidepanelPage: Page;
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

    popupPage: async ({ context }, use: (r: Page) => Promise<void>) => {
        const page = await context.waitForEvent('page', p => p.url().includes('popup'));
        await use(page);
    },

    sidepanelPage: async ({ context }, use: (r: Page) => Promise<void>) => {
        const page = await context.waitForEvent('page', p => p.url().includes('sidepanel'));
        await use(page);
    },
});

export const expect = test.expect;
