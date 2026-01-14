import { test, expect } from '../fixtures/extension.fixture';

test('debug sidepanel labels', async ({ sidepanelPage }) => {
    await sidepanelPage.waitForSelector('button');
    const buttons = await sidepanelPage.locator('button').allTextContents();
    console.log('--- BUTTONS ---');
    console.log(buttons.join(', '));
    console.log('--- END ---');
});
