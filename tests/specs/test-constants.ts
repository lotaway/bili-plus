export const TEST_URLS = {
    BAIDU: 'https://www.baidu.com',
    BILIBILI_HOME: 'https://www.bilibili.com/',
    BILIBILI_VIDEO: (bvid: string) => `https://www.bilibili.com/video/${bvid}`,
} as const;

export const TEST_VIDEO_DATA = {
    SAMPLE_BVID: 'BV1test123',
    SAMPLE_TITLE: '深度学习教程',
    SAMPLE_CATEGORY: 'class',
    SAMPLE_LEVEL: 9,
    SAMPLE_CONFIDENCE: 10,
    SAMPLE_REASON: 'High quality tutorial',
} as const;

export const TEST_MESSAGES = {
    WARNING_NOT_HOMEPAGE: '自动学习机目前仅支持在 Bilibili 首页运行',
    STATUS_PROCESSING: '已提交到学习队列',
    STATUS_COMPLETE: '自动化学习完成',
} as const;

export const TEST_TIMEOUTS = {
    PAGE_ACTIVATION: 500,
    STATUS_CHECK: 1000,
    STATUS_UPDATE: 2000,
} as const;
