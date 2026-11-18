import { test, expect } from '@playwright/test';
import { isBilibiliHomepageUrl } from '../../src/utils/url';

test.describe('isBilibiliHomepageUrl', () => {
    test('should accept the Chinese homepage', () => {
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/')).toBe(true);
        expect(isBilibiliHomepageUrl('http://www.bilibili.com/')).toBe(true);
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/?spm_id_from=333.1007')).toBe(true);
        expect(isBilibiliHomepageUrl('https://bilibili.com/')).toBe(true);
    });

    test('should accept the English homepage redirected by Accept-Language', () => {
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/en')).toBe(true);
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/en/')).toBe(true);
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/en/?spm_id_from=333.1007')).toBe(true);
        expect(isBilibiliHomepageUrl('http://www.bilibili.com/en/')).toBe(true);
    });

    test('should reject non-homepage bilibili pages', () => {
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/video/BV1L3sz6vEza/')).toBe(false);
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/en/video/BV1L3sz6vEza/')).toBe(false);
        expect(isBilibiliHomepageUrl('https://www.bilibili.com/list/watchlater?bvid=BV1L3sz6vEza')).toBe(false);
        expect(isBilibiliHomepageUrl('https://space.bilibili.com/1')).toBe(false);
        expect(isBilibiliHomepageUrl('https://example.com/en/')).toBe(false);
    });

    test('should reject missing or malformed urls', () => {
        expect(isBilibiliHomepageUrl(undefined)).toBe(false);
        expect(isBilibiliHomepageUrl(null)).toBe(false);
        expect(isBilibiliHomepageUrl('')).toBe(false);
        expect(isBilibiliHomepageUrl('not a url')).toBe(false);
    });
});
