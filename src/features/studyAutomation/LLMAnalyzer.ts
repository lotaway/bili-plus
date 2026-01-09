import Logger from '../../utils/Logger'
import { LOG_PREFIX } from './constants'
import { Video, VideoAnalysis, LLMResponse } from './types'

export class LLMAnalyzer {
    constructor(private callLLM: (prompt: string) => Promise<LLMResponse>) { }

    async analyzeVideos(videos: Video[]): Promise<VideoAnalysis[]> {
        if (!videos || videos.length === 0) {
            Logger.I(`${LOG_PREFIX} No videos to analyze`)
            return []
        }

        const prompt = this.buildAnalysisPrompt(videos)

        try {
            Logger.I(`${LOG_PREFIX} Calling LLM to analyze ${videos.length} videos`)
            const result = await this.callLLM(prompt)
            return this.parseResponse(result)
        } catch (e: any) {
            Logger.E(`${LOG_PREFIX} Failed to analyze videos with LLM:`, e)
            Logger.E(`${LOG_PREFIX} Error details:`, e.message, e.stack)
            return []
        }
    }

    private buildAnalysisPrompt(videos: Video[]): string {
        const videoData = videos.map(v => ({ title: v.title, link: v.link }))
        return `Please analyze these Bilibili video titles and determine which ones are "tutorials" or "knowledge-based" about real world.
    Return a JSON array of objects with fields: category (class|knowledge), link, level (1-10), confidence (1-10), reason.
    Titles: ${JSON.stringify(videoData)}`
    }

    private parseResponse(result: LLMResponse): VideoAnalysis[] {
        const content = result?.choices?.[0]?.message?.content || ''

        if (!content) {
            Logger.E(`${LOG_PREFIX} LLM returned empty content`)
            return []
        }

        Logger.D(`${LOG_PREFIX} LLM response content length:`, content.length)
        const jsonStr = content.match(/\[[\s\S]*\]/)?.[0]

        if (!jsonStr) {
            Logger.E(`${LOG_PREFIX} No JSON array found in LLM response`)
            Logger.D(`${LOG_PREFIX} LLM response:`, content.substring(0, 500))
            return []
        }

        const parsed = JSON.parse(jsonStr)

        if (!Array.isArray(parsed)) {
            Logger.E(`${LOG_PREFIX} LLM response is not an array:`, typeof parsed)
            return []
        }

        Logger.I(`${LOG_PREFIX} LLM analyzed ${parsed.length} videos`)
        return parsed
    }
}
