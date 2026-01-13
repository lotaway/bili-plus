import { type Page } from '@playwright/test';

export class MockServer {
    constructor(private page: Page) { }

    async mockBilibiliApi() {
        await this.page.route('**/x/player/v2?*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    code: 0,
                    message: '0',
                    data: {
                        subtitle: {
                            subtitles: [
                                {
                                    id: 1,
                                    lan: 'zh-Hans',
                                    lan_doc: '中文（简体）',
                                    subtitle_url: '//api.bilibili.com/x/player/wbi/v2/subtitle?cid=1&aid=1'
                                }
                            ]
                        }
                    }
                })
            });
        });
    }

    async mockAiApi() {
        await this.page.route('**/v1/chat/completions', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: '这是一个AI生成的总结。'
                            }
                        }
                    ]
                })
            });
        });
    }
}
