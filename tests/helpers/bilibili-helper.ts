import { type Page } from '@playwright/test';

export async function waitForVideoPlayer(page: Page) {
    await page.waitForSelector('.bpx-player-video-area', { state: 'visible' });
}

export async function isVideoPlaying(page: Page) {
    return await page.evaluate(() => {
        const video = document.querySelector('video');
        return video ? !video.paused : false;
    });
}

export async function getCurrentVideoId(page: Page) {
    const url = page.url();
    const match = url.match(/video\/(BV[a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}
