import { test as base } from './extension.fixture';
import { BilibiliVideoPage } from '../page-objects/BilibiliVideoPage';

import { type BrowserContext } from '@playwright/test';

type PageFixtures = {
    bilibiliVideoPage: BilibiliVideoPage;
};

export const test = base.extend<PageFixtures>({
    bilibiliVideoPage: async ({ context }: { context: BrowserContext }, use: (r: BilibiliVideoPage) => Promise<void>) => {
        const page = await context.newPage();
        const videoPage = new BilibiliVideoPage(page);
        await use(videoPage);
        await page.close();
    },
});

export { expect } from '@playwright/test';
