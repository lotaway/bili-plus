import { test, expect } from '../fixtures/extension.fixture';
import { BilibiliVideoPage } from '../page-objects/BilibiliVideoPage';
import { ExtensionSidepanel } from '../page-objects/ExtensionSidepanel';

test.describe('Study Automation', () => {
    test('should show warning when not on Bilibili homepage', async ({ context }) => {
        const page = await context.newPage();
        const videoPage = new BilibiliVideoPage(page);

        await videoPage.gotoHomePage();

        const injectorButton = await videoPage.getInjectorButton();
        await expect(injectorButton).toBeVisible({ timeout: 10 * 1000 });

        await videoPage.clickInjectorButton();
        const sidepanel = await ExtensionSidepanel.waitFor(context);

        await page.goto('https://www.baidu.com');
        await expect(await videoPage.getInjectorButton()).not.toBeVisible();

        await sidepanel.clickAutoStudy();
        await sidepanel.clickStartScan();
        await sidepanel.expectWarningMessage('自动学习机目前仅支持在 Bilibili 首页运行');

        await page.close();
    });

    test('should handle successful video scanning on homepage', async ({ context }) => {
        const page = await context.newPage();
        const videoPage = new BilibiliVideoPage(page);

        await videoPage.gotoHomePage();
        await videoPage.injectFakeVideoCard();

        const injectorButton = await videoPage.getInjectorButton();
        await expect(injectorButton).toBeVisible({ timeout: 10000 });

        await videoPage.clickInjectorButton();
        const sidepanel = await ExtensionSidepanel.waitFor(context);


        await sidepanel.mockChatCompletion();

        await sidepanel.clickAutoStudy();
        await sidepanel.clickStartScan();
        await sidepanel.expectScanComplete();
        await sidepanel.expectVideoSubmitted(1);

        await page.close();
    });
});
