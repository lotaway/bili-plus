import { BrowserContext } from '@playwright/test';
import { TEST_VIDEO_DATA } from './test-constants';

export class TestMockService {
    static async mockAIResponse(context: BrowserContext): Promise<void> {
        // Broaden the mock to catch various potential endpoints
        await context.route('**/v1/chat/completions', async route => {
            const mockResponse = this.buildAIResponseBody();
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: mockResponse,
            });
        });

        await this.mockBilibiliApi(context);
        await this.setupMockProvider(context);
    }

    private static async setupMockProvider(context: BrowserContext): Promise<void> {
        const pages = context.pages();
        const sidepanelPage = pages.find(p => p.url().startsWith('chrome-extension://'));

        if (!sidepanelPage) {
            console.warn('Extension sidepanel page not found, storage mock might fail');
            return;
        }

        await sidepanelPage.evaluate(() => {
            return new Promise((resolve) => {
                chrome.storage.sync.set({
                    llmProvidersConfig: {
                        providers: [{
                            id: 'test-provider',
                            name: 'Test Provider',
                            type: 'custom',
                            endpoint: 'https://api.openai.com',
                            apiKey: 'test-key',
                            defaultModel: 'gpt-3.5-turbo',
                            enabled: true,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        }],
                        selectedProviderId: 'test-provider',
                        version: 1
                    }
                }, () => resolve(true));
            });
        });
    }

    private static async mockBilibiliApi(context: BrowserContext): Promise<void> {
        await context.route('https://api.bilibili.com/x/web-interface/view?bvid=' + TEST_VIDEO_DATA.SAMPLE_BVID, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: '0',
                    ttl: 1,
                    data: {
                        bvid: TEST_VIDEO_DATA.SAMPLE_BVID,
                        aid: 1234567,
                        cid: 7654321,
                        title: TEST_VIDEO_DATA.SAMPLE_TITLE,
                        pages: [{ cid: 7654321, part: 'Part 1' }]
                    }
                })
            });
        });

        await context.route('https://api.bilibili.com/x/player/wbi/v2?aid=1234567&cid=7654321', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: '0',
                    ttl: 1,
                    data: {
                        subtitle: {
                            subtitles: [{
                                lan: 'zh-CN',
                                subtitle_url: 'https://aisubtitle.hdslb.com/mock-subtitle-url'
                            }]
                        }
                    }
                })
            });
        });

        await context.route('https://aisubtitle.hdslb.com/mock-subtitle-url', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    body: [
                        { from: 0, to: 10, content: '这是测试字幕' },
                        { from: 10, to: 20, content: '这是第二条测试字幕' }
                    ]
                })
            });
        });
    }

    private static buildAIResponseBody() {
        const data = {
            choices: [{
                index: 0,
                delta: {
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
        return `data: ${JSON.stringify(data)}\n\ndata: [DONE]\n\n`;
    }
}
