import { test, expect } from '../fixtures/pages.fixture';
import { TestPageHelper } from './test-page.helper';

const HOME_BUTTON_ID = 'bili-plus-home-generate-btn';

test.describe('Integration Testing', () => {
    test('should inject home button on Bilibili homepage', async ({ bilibiliVideoPage }) => {
        await bilibiliVideoPage.gotoHomePage();
        await TestPageHelper.activatePage(bilibiliVideoPage.page);
        await expect(bilibiliVideoPage.page.locator(`#${HOME_BUTTON_ID}`)).toBeVisible();
    });
});
