/**
 * B 站接口相关的固定参数配置。
 *
 * 这里的值由 B 站维护，会不定期调整（尤其是 WBI 签名置换表 MIXIN_KEY_ENC_TAB）。
 * 当下载/字幕大面积报 -403、-412 时，优先核对这里是否与 B 站当前实现一致。
 * 参考: https://github.com/XiaoYouChR/Ghost-Downloader-3/tree/master/features/bili_pack
 */

export const BILIBILI_API_HOST = 'https://api.bilibili.com'
export const BILIBILI_WEBSITE_HOST = 'https://www.bilibili.com'

export const NAV_URL = `${BILIBILI_API_HOST}/x/web-interface/nav`
export const FINGER_SPI_URL = `${BILIBILI_API_HOST}/x/frontend/finger/spi`

/**
 * WBI 签名置换表（官方文档/开源下载器通用版本，2026-11 校验通过）。
 * 历史问题：此表曾被写错 33/64 项，导致 w_rid 全部无效、playurl 返回 -403。
 * 修改前请务必与参考项目的 account.py:MIXIN_KEY_ENC_TAB 核对。
 */
export const MIXIN_KEY_ENC_TAB: readonly number[] = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
]

/** WBI 签名时需要从参数值中剔除的字符 */
export const WBI_FILTER_CHARS = "!'()*"

/** WBI key 缓存有效期。B 站一般每天轮换，6 小时兼顾稳定性与及时更新。 */
export const WBI_KEYS_TTL_MS = 6 * 60 * 60 * 1000

/** 请求 B 站接口时使用的 UA（DownloadUtils 里的 UA 与其保持一致） */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

export const BILIBILI_REFERER = `${BILIBILI_WEBSITE_HOST}/`

/** 风控 Cookie 名，取流请求必须携带 */
export const BUVID3_COOKIE_NAME = 'buvid3'

// 视频流格式常量
export const VideoFormat = {
  MP4: 1,        // MP4 格式
  DASH: 16,      // DASH 格式
  DASH_HDR: 80,  // DASH + HDR (16 | 64)
  DASH_DOLBY: 272, // DASH + 杜比音频 (16 | 256)
  DASH_DOLBY_VISION: 528, // DASH + 杜比视界 (16 | 512)
  DASH_4K: 144,  // DASH + 4K (16 | 128)
  DASH_8K: 1040, // DASH + 8K (16 | 1024)
  DASH_AV1: 2064, // DASH + AV1 (16 | 2048)
  ALL_DASH: 4048 // 所有可用 DASH 流
} as const

// 视频清晰度常量
export const VideoQuality = {
  LD_240P: 6,    // 240P 极速
  SD_360P: 16,   // 360P 流畅
  SD_480P: 32,   // 480P 清晰
  HD_720P: 64,   // 720P 高清
  HD_720P60: 74, // 720P 60帧
  FHD_1080P: 80, // 1080P 高清
  AI_ENHANCED: 100, // 智能修复
  FHD_1080P_PLUS: 112, // 1080P+ 高码率
  FHD_1080P60: 116, // 1080P 60帧
  UHD_4K: 120,   // 4K 超清
  HDR: 125,      // HDR 真彩色
  DOLBY_VISION: 126, // 杜比视界
  UHD_8K: 127,   // 8K 超高清
  HDR_VIVID: 129 // HDR Vivid
} as const

// 平台常量
export const Platform = {
  PC: 'pc',      // Web 端
  HTML5: 'html5' // 移动端 HTML5
} as const

// playurl 默认请求参数
export const PLAYURL_DEFAULT_QUALITY = VideoQuality.FHD_1080P
export const PLAYURL_DEFAULT_FNVAL = VideoFormat.ALL_DASH
export const PLAYURL_DEFAULT_FOURK = 0
export const PLAYURL_DEFAULT_PLATFORM = Platform.PC

/** 降级清晰度：参考 B 站下载器，高清晰度失败时回退到 qn=80 */
export const PLAYURL_FALLBACK_QUALITY = VideoQuality.FHD_1080P
