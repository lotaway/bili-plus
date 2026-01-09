import { VIDEO_BLACKLIST_KEYWORDS, STUDY_AUTOMATION_CONFIG } from './constants'
import { Video } from './types'

export class VideoFilter {
    static filterByBlacklist(videos: Video[]): Video[] {
        return videos.filter(video => {
            const title = (video.title || '').toLowerCase()

            if (title.length < STUDY_AUTOMATION_CONFIG.MIN_TITLE_LENGTH) {
                return false
            }

            if (VIDEO_BLACKLIST_KEYWORDS.some(keyword => title.includes(keyword))) {
                return false
            }

            return true
        })
    }

    static isValidVideoArray(videos: any): videos is Video[] {
        return videos && Array.isArray(videos) && videos.length > 0
    }
}
