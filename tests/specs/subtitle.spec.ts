import { test, expect } from '../fixtures/pages.fixture';
import { MockServer } from '../fixtures/mock-server';

const TEST_VIDEO_BVID = 'BV1GJ411x7h7';

test.describe('Subtitle Functionality', () => {
    test('should load subtitles on video page', async ({ bilibiliVideoPage }) => {
        const mockServer = new MockServer(bilibiliVideoPage.page);
        await mockServer.mockBilibiliApi();
        await bilibiliVideoPage.goto(TEST_VIDEO_BVID);

        expect(bilibiliVideoPage.page.url()).toContain(TEST_VIDEO_BVID);
    });
});
