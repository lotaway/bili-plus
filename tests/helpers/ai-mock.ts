import { type Page } from '@playwright/test';

export async function mockAISummaryResponse(page: Page, content: string) {
    await page.route('**/v1/chat/completions', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                choices: [{ message: { content } }]
            })
        });
    });
}

export async function mockAIChatResponse(page: Page, content: string) {
    await page.route('**/v1/chat/completions', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                choices: [{ message: { content } }]
            })
        });
    });
}

export async function mockAIStreamingResponse(page: Page, chunks: string[]) {
    await page.route('**/v1/chat/completions', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: chunks.map(chunk => {
                const data = JSON.stringify({
                    choices: [{ delta: { content: chunk } }]
                });
                return `data: ${data}\n\n`;
            }).join('') + 'data: [DONE]\n\n'
        });
    });
}
