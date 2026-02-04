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
            return this.parseResponse(result, videos)
        } catch (e: any) {
            Logger.E(`${LOG_PREFIX} Failed to analyze videos with LLM:`, e)
            Logger.E(`${LOG_PREFIX} Error details:`, e.message, e.stack)
            return []
        }
    }

    private buildAnalysisPrompt(videos: Video[]): string {
        const videoData = videos.map(v => ({ title: v.title, link: v.link }))
        return `你是一个知识挖掘专家，专门从 B 站首页推荐中筛选出高质量的“教程”、“实战”、“原理科普”或“技术分享”类视频。
    
    任务要求：
    1. 分析提供的视频标题，判断其是否属于“正式课程/讲座(class)”或“深度知识/科普(knowledge)”类型。
    2. 排除掉纯娱乐、生活 VLOG、纯新闻报道、标题党、以及碎片化的短视频。
    3. 必须严格按照 JSON 数组格式返回，不要包含任何解释文字。
    
    返回格式示例：
    [{"category": "class", "link": "...", "level": 8, "confidence": 9, "reason": "这是一篇关于 React 源码的深度分析"}]
    
    待分析视频数据：
    ${JSON.stringify(videoData)}`
    }

    private parseResponse(result: LLMResponse | any, originalVideos: Video[]): VideoAnalysis[] {
        const content = result?.choices?.[0]?.message?.content || result?.content || result?.data?.content || ''

        if (!content) {
            Logger.E(`${LOG_PREFIX} LLM returned empty content`)
            return []
        }

        Logger.D(`${LOG_PREFIX} LLM response content length:`, content.length)
        const jsonStr = content.match(/\[[\s\S]*\]/)?.[0]

        if (!jsonStr) {
            Logger.E(`${LOG_PREFIX} No JSON array found in LLM response`)
            return []
        }

        try {
            const parsed = JSON.parse(jsonStr) as any[]
            if (!Array.isArray(parsed)) {
                Logger.E(`${LOG_PREFIX} LLM response is not an array`)
                return []
            }

            const results = parsed.map(item => {
                const itemBvid = this.extractBvid(item.link)
                const original = originalVideos.find(v => this.extractBvid(v.link) === itemBvid)

                if (!original) {
                    Logger.E(`${LOG_PREFIX} Could not find original video for link: ${item.link}`)
                    return null
                }

                return {
                    ...original,
                    category: item.category,
                    level: item.level,
                    confidence: item.confidence,
                    reason: item.reason,
                    analysis: item.analysis
                } as VideoAnalysis
            }).filter(Boolean) as VideoAnalysis[]

            Logger.I(`${LOG_PREFIX} Successfully analyzed ${results.length} videos`)
            return results
        } catch (err) {
            Logger.E(`${LOG_PREFIX} Error parsing AI response JSON:`, err)
            return []
        }
    }

    private extractBvid(link: string): string {
        if (!link) return ''
        const match = link.match(/BV[a-zA-Z0-9]+/)
        return match ? match[0] : ''
    }
}
