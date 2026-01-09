export const STUDY_AUTOMATION_CONFIG = {
    MAX_RETRY_MULTIPLIER: 2,
    PAGE_LOAD_DELAY: 3000,
    REQUEST_TIMEOUT: 30000,
    MIN_TITLE_LENGTH: 5,
} as const

export const VIDEO_BLACKLIST_KEYWORDS = [
    '番剧',
    '动漫',
    '游戏',
    '开箱',
    '日常',
    'vlog',
    '记录',
    '娱乐',
] as const

export enum VideoCategory {
    CLASS = 'class',
    KNOWLEDGE = 'knowledge',
}

export const LOG_PREFIX = '[Study Automation]' as const
