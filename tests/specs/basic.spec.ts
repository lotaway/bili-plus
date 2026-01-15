import { test, expect } from '../fixtures/extension.fixture';

const EXTENSION_ID_LENGTH = 32;
const PAGE_TITLES = {
    POPUP: /BILI PLUS/,
    SIDEPANEL: /BILI PLUS - Sidepane/,
} as const;

test.describe('Extension Basic Functionality', () => {
    test('extension should be loaded successfully', async ({ extensionId }) => {
        expect(extensionId).toBeTruthy();
        expect(extensionId.length).toBe(EXTENSION_ID_LENGTH);
    });

    test('popup page should be accessible', async ({ popupPage }) => {
        await expect(popupPage).toHaveTitle(PAGE_TITLES.POPUP);
    });

    test('side panel page should be accessible', async ({ sidepanelPage }) => {
        await expect(sidepanelPage).toHaveTitle(PAGE_TITLES.SIDEPANEL);
    });
});
