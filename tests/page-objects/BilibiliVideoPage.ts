import { type Page, expect } from '@playwright/test';

export class BilibiliVideoPage {
    constructor(public readonly page: Page) { }

    async goto(bvid: string) {
        await this.page.goto(`https://www.bilibili.com/video/${bvid}`);
    }

    async getVideoTitle() {
        return await this.page.textContent('.video-title');
    }

    async getVideoDuration() {
        return await this.page.textContent('.bpx-player-ctrl-duration-label');
    }

    async play() {
        const isPaused = await this.page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.paused : true;
        });
        if (isPaused) {
            await this.page.click('.bpx-player-ctrl-play');
        }
    }

    async pause() {
        const isPlaying = await this.page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? !video.paused : false;
        });
        if (isPlaying) {
            await this.page.click('.bpx-player-ctrl-play');
        }
    }
    async gotoHomePage() {
        await this.page.goto('https://www.bilibili.com/');
    }

    async getInjectorButton() {
        return this.page.locator('#bili-plus-home-generate-btn');
    }

    async clickInjectorButton() {
        await (await this.getInjectorButton()).click();
    }

    async injectFakeVideoCard() {
        await this.page.evaluate(() => {
            const container = document.querySelector('.bili-feed4-layout') || document.body;
            const card = document.createElement('div');
            card.className = 'bili-video-card';
            card.innerHTML = `
                <div class="bili-video-card__info--tit" title="深度学习教程">深度学习教程</div>
                <a href="https://www.bilibili.com/video/BV1test123"></a>
            `;
            container.appendChild(card);
        });
    }

}
