import { test, expect } from '../fixtures/extension.fixture';

test.describe('Extension Basic Functionality', () => {
    test('extension should be loaded successfully', async ({ extensionId }) => {
        expect(extensionId).toBeTruthy();
        expect(extensionId.length).toBe(32);
    });

    test('popup page should be accessible', async ({ popupPage }) => {
        await expect(popupPage).toHaveTitle(/BILI PLUS/);
    });

    test('side panel page should be accessible', async ({ sidepanelPage }) => {
        await expect(sidepanelPage).toHaveTitle(/BILI PLUS - Sidepane/);
    });
});
