import { BrowserContext } from '@playwright/test';
import { TEST_VIDEO_DATA } from './test-constants';

export class TestMockService {
    static async mockAIResponse(context: BrowserContext): Promise<void> {
        await context.route('**/v1/chat/completions', async route => {
            const mockResponse = this.buildAIResponseBody();
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockResponse),
            });
        });
    }

    private static buildAIResponseBody() {
        return {
            choices: [{
                message: {
                    content: JSON.stringify([{
                        category: TEST_VIDEO_DATA.SAMPLE_CATEGORY,
                        link: `https://www.bilibili.com/video/${TEST_VIDEO_DATA.SAMPLE_BVID}`,
                        level: TEST_VIDEO_DATA.SAMPLE_LEVEL,
                        confidence: TEST_VIDEO_DATA.SAMPLE_CONFIDENCE,
                        reason: TEST_VIDEO_DATA.SAMPLE_REASON,
                    }])
                }
            }]
        };
    }
}
