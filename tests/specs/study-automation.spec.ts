import { test, expect } from '../fixtures/extension.fixture';
import { BilibiliVideoPage } from '../page-objects/BilibiliVideoPage';
import { ExtensionSidepanel } from '../page-objects/ExtensionSidepanel';
import { TEST_URLS, TEST_MESSAGES } from './test-constants';
import { TestMockService } from './test-mock.service';
import { TestPageHelper } from './test-page.helper';

test.describe('Study Automation', () => {
    test('should show warning when not on Bilibili homepage', async ({ context, sidepanelPage }) => {
        const sidepanel = new ExtensionSidepanel(sidepanelPage);
        const page = await context.newPage();

        await page.goto(TEST_URLS.BAIDU);
        await sidepanel.clickAutoStudy();
        await sidepanel.clickStartScan();
        await sidepanel.expectWarningMessage(TEST_MESSAGES.WARNING_NOT_HOMEPAGE);

        await page.close();
    });

    test('should handle successful video scanning on homepage', async ({ context, sidepanelPage }) => {
        const sidepanel = new ExtensionSidepanel(sidepanelPage);
        const page = await context.newPage();
        const videoPage = new BilibiliVideoPage(page);

        await setupBilibiliHomepage(videoPage, page);
        await TestMockService.mockAIResponse(context);
        await triggerAutomation(sidepanel, page);
        await verifyAutomationSuccess(sidepanel);

        await page.close();
    });
});

async function setupBilibiliHomepage(videoPage: BilibiliVideoPage, page: any) {
    await videoPage.gotoHomePage();
    await videoPage.injectFakeVideoCard();
    await TestPageHelper.activatePage(page);
}

async function triggerAutomation(sidepanel: ExtensionSidepanel, page: any) {
    await sidepanel.clickAutoStudy();
    await TestPageHelper.activatePage(page);
    await sidepanel.clickStartScan();
}

async function verifyAutomationSuccess(sidepanel: ExtensionSidepanel) {
    await sidepanel.expectScanComplete();
    await sidepanel.expectVideoSubmitted(1);
}
