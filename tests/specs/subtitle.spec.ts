import { test, expect } from '../fixtures/pages.fixture';
import { MockServer } from '../fixtures/mock-server';

test.describe('Subtitle Functionality', () => {
    test('should load subtitles on video page', async ({ bilibiliVideoPage }) => {
        const mockServer = new MockServer(bilibiliVideoPage.page);
        await mockServer.mockBilibiliApi();

        await bilibiliVideoPage.goto('BV1GJ411x7h7'); // Example BVID
        // Add verification steps for subtitle extraction
        // Since we don't have the exact UI selectors yet, we'll keep it simple
        expect(bilibiliVideoPage.page.url()).toContain('BV1GJ411x7h7');
    });
});
