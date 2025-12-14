import { SubtitleFetcher } from '../services/SubtitleFetcher'

export class VideoInfoUtils {
  constructor(private readonly subtitleFetcher: SubtitleFetcher) {}

  checkVideoInfo() {
    if (!this.subtitleFetcher.cid || !this.subtitleFetcher.aid) {
      let msg = 'Can not get video info, maybe not the target page'
      if (!this.subtitleFetcher.isInit) {
        msg = 'video_page_inject.js maybe not trigger, please try refresh the page'
      }
      return {
        isOk: false,
        error: msg,
      }
    }
    return {
      isOk: true,
    }
  }
}
