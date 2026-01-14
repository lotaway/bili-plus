import { test, expect } from '../fixtures/extension.fixture';
import path from 'path';

test.describe('Study Automation', () => {
    test('should show warning when not on Bilibili homepage', async ({ context }) => {
        // 1. Open a non-Bilibili page (Google)
        const mainPage = await context.newPage();
        await mainPage.goto('https://www.google.com');

        // 2. Trigger Sidepanel via Background API simulation or injected button
        // Since Google won't have the button, we can't click it.
        // But the user said: "用 page.click()来触发 src/entry/inject 注入到页面的按钮"
        // So for this warning test, we need a Bilibili page that is NOT the homepage.
        await mainPage.goto('https://www.bilibili.com/video/BV1GJ411x7h7');

        // Wait for injected button (video page also has one)
        const injectorButton = mainPage.locator('#bili-plus-generate-btn');
        await expect(injectorButton).toBeVisible({ timeout: 10000 });

        // 3. Trigger and catch sidepanel
        const [sidepanelPage] = await Promise.all([
            context.waitForEvent('page', p => p.url().includes('sidepanel')),
            injectorButton.click()
        ]);

        // 4. Select Study Automation tab
        await sidepanelPage.locator('button', { hasText: '自动学习' }).click();

        // 5. Click Start button
        await sidepanelPage.locator('button', { hasText: '开始自动扫描' }).click();

        // 6. Check for warning message
        await expect(sidepanelPage.locator('text=自动学习机目前仅支持在 Bilibili 首页运行')).toBeVisible({ timeout: 10000 });

        await mainPage.close();
    });

    test('should handle successful video scanning on homepage', async ({ context }) => {
        // 1. Open Bilibili Homepage
        const page = await context.newPage();
        await page.goto('https://www.bilibili.com/');

        // Mock video cards if necessary (usually homepage has them, but we want predictable results)
        await page.evaluate(() => {
            const container = document.querySelector('.bili-feed4-layout') || document.body;
            const card = document.createElement('div');
            card.className = 'bili-video-card';
            card.innerHTML = `
                <div class="bili-video-card__info--tit" title="深度学习教程">深度学习教程</div>
                <a href="https://www.bilibili.com/video/BV1test123"></a>
            `;
            container.appendChild(card);
        });

        // 2. Trigger Sidepanel
        const injectorButton = page.locator('#bili-plus-home-generate-btn');
        await expect(injectorButton).toBeVisible({ timeout: 10000 });

        console.log('Clicking injector button...');
        await injectorButton.click();

        // Wait a bit and check pages
        await page.waitForTimeout(2000);
        const pages = context.pages();
        console.log('Open pages:', pages.map(p => p.url()));

        const sidepanelPage = pages.find(p => p.url().includes('sidepanel'));
        if (!sidepanelPage) {
            console.log('Sidepanel page not found in context.pages()');
            throw new Error('Sidepanel not found');
        }

        // 3. Mock AI Response
        await context.route('**/v1/chat/completions', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify([
                                {
                                    category: 'class',
                                    link: 'https://www.bilibili.com/video/BV1test123',
                                    level: 9,
                                    confidence: 10,
                                    reason: 'High quality tutorial'
                                }
                            ])
                        }
                    }]
                })
            });
        });

        // 4. Perform Task in Sidepanel
        await sidepanelPage.locator('button', { hasText: '自动学习' }).click();
        await sidepanelPage.locator('button', { hasText: '开始自动扫描' }).click();

        // 5. Verify results
        await expect(sidepanelPage.locator('text=自动化学习完成')).toBeVisible({ timeout: 30000 });
        await expect(sidepanelPage.locator('text=已提交 1 个视频')).toBeVisible();

        await page.close();
    });
});
