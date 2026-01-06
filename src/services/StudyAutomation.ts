import { LLMProviderManager } from './LLMProviderManager'

export interface BiliVideoInfo {
    title: string
    link: string
    bvid: string
}

export class StudyAutomation {
    private llmProviderManager = new LLMProviderManager()
    private baseUrl = 'http://localhost:5051'

    constructor() {
        this.llmProviderManager.init()
    }

    async startAutomation() {
        console.log('[Study Automation] Starting...')

        const storageResult = await chrome.storage.local.get('studyAutomationBaseUrl')
        if (storageResult.studyAutomationBaseUrl) {
            this.baseUrl = storageResult.studyAutomationBaseUrl
        }

        const configResp = await fetch(`${this.baseUrl}/api/config`)
        if (!configResp.ok) {
            throw new Error(`Failed to fetch config: ${configResp.status}`)
        }
        const config = await configResp.json()
        const limitCount = config.STUDY_LIST_LIMIT_COUNT

        let allVideos: BiliVideoInfo[] = await this.extractVideosFromPage()

        let filteredVideos = allVideos.filter(v => {
            const title = v.title.toLowerCase()
            if (title.length < 5) return false // N = 5
            const blackList = ['番剧', '动漫', '游戏', '开箱', '日常', 'vlog', '记录', '娱乐']
            if (blackList.some(kw => title.includes(kw))) return false
            return true
        })

        let studyList: any[] = []
        let retryCount = 0
        const MAX_RETRIES = limitCount * 2

        while (studyList.length < limitCount && retryCount < MAX_RETRIES) {
            const batch = filteredVideos.splice(0, 10)
            if (batch.length === 0) {
                await this.clickChangeButton()
                await new Promise(r => setTimeout(r, 3000))
                filteredVideos = await this.extractVideosFromPage()
                retryCount++
                continue
            }

            const prompt = `Please analyze these Bilibili video titles and determine which ones are "tutorials" or "knowledge-based" about real world. 
            Return a JSON array of objects with fields: category (class|knowledge), link, level (1-10), confidence (1-10), reason.
            Titles: ${JSON.stringify(batch.map(v => ({ title: v.title, link: v.link })))}`

            const result = await this.llmProviderManager.callLLM([{ role: 'user', content: prompt }], { stream: false })

            try {
                // @ts-ignore
                const content = result.choices[0].message.content
                const jsonStr = content.match(/\[.*\]/s)?.[0]
                if (jsonStr) {
                    const parsed = JSON.parse(jsonStr)
                    studyList.push(...parsed.filter((item: any) => item.category === 'class' || item.category === 'knowledge'))
                }
            } catch (e) {
                console.error('Failed to parse LLM response', e)
            }

            retryCount++
        }

        studyList.sort((a, b) => (b.level + b.confidence) - (a.level + a.confidence))
        const finalSelection = studyList.slice(0, limitCount)

        for (const item of finalSelection) {
            const response = await fetch(`${this.baseUrl}/api/study/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: 'bilibili',
                    target: item.link,
                    targetType: 'videoLink',
                    studyType: 'summary'
                })
            })

            if (!response.ok) {
                console.error(`Failed to submit study request for ${item.link}: ${response.status}`)
            }
        }

        console.log(`[Study Automation] Submitted ${finalSelection.length} tasks.`)
    } catch(error) {
        console.error('[Study Automation] Error:', error)
        throw error
    }
}

    private async extractVideosFromPage(): Promise < BiliVideoInfo[] > {
    const cards = document.querySelectorAll('.bili-video-card')
        const results: BiliVideoInfo[] = []
        cards.forEach(card => {
        const titleEl = card.querySelector('.bili-video-card__info--tit')
        const linkEl = card.querySelector('a')
        if (titleEl && linkEl) {
            const title = titleEl.textContent?.trim() || ''
            const link = linkEl.href
            const bvidMatch = link.match(/BV[a-zA-Z0-9]+/)
            if (bvidMatch) {
                results.push({ title, link, bvid: bvidMatch[0] })
            }
        }
    })
        return results
}

    private async clickChangeButton() {
    const btn = document.querySelector('.roll-btn') as HTMLElement
    if (btn) {
        btn.click()
    }
}
}
