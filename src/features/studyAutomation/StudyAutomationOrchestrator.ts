import Logger from '../../utils/Logger'
import { VideoFilter } from './VideoFilter'
import { LLMAnalyzer } from './LLMAnalyzer'
import { StudyTaskSubmitter } from './StudyTaskSubmitter'
import { PageActionService } from './PageActionService'
import { LOG_PREFIX, STUDY_AUTOMATION_CONFIG, VideoCategory } from './constants'
import { Video, VideoAnalysis, StudyAutomationResult } from './types'

export class StudyAutomationOrchestrator {
    private isRunning = false

    constructor(
        private pageActionService: PageActionService,
        private llmAnalyzer: LLMAnalyzer,
        private taskSubmitter: StudyTaskSubmitter
    ) { }

    async run(limitCount: number): Promise<StudyAutomationResult> {
        this.isRunning = true

        const studyList = await this.collectVideos(limitCount)

        if (!this.isRunning) {
            return this.createStoppedResult()
        }

        if (studyList.length === 0) {
            return this.createNoVideosResult()
        }

        const finalSelection = this.selectTopVideos(studyList, limitCount)
        const submittedTasks = await this.taskSubmitter.submitTasks(finalSelection)

        return {
            success: true,
            submittedCount: finalSelection.length,
            tasks: submittedTasks
        }
    }

    stop(): void {
        this.isRunning = false
    }

    isAutomationRunning(): boolean {
        return this.isRunning
    }

    private async collectVideos(limitCount: number): Promise<VideoAnalysis[]> {
        const studyList: VideoAnalysis[] = []
        let retryCount = 0
        const maxRetries = limitCount * STUDY_AUTOMATION_CONFIG.MAX_RETRY_MULTIPLIER

        while (this.shouldContinueCollection(studyList.length, limitCount, retryCount, maxRetries)) {
            try {
                const videos = await this.fetchAndFilterVideos(retryCount, maxRetries)

                if (!videos) {
                    retryCount++
                    continue
                }

                const categorizedVideos = await this.analyzeAndCategorize(videos)

                if (categorizedVideos.length > 0) {
                    studyList.push(...categorizedVideos)
                    Logger.I(`${LOG_PREFIX} Study list now has ${studyList.length}/${limitCount} videos`)
                } else {
                    Logger.I(`${LOG_PREFIX} No videos categorized as class/knowledge, retry ${retryCount + 1}/${maxRetries}`)
                }

                retryCount++
            } catch (err: any) {
                if (!this.handleCollectionError(err, retryCount, maxRetries)) {
                    break
                }
                retryCount++
            }
        }

        return studyList
    }

    private shouldContinueCollection(
        currentCount: number,
        limitCount: number,
        retryCount: number,
        maxRetries: number
    ): boolean {
        return currentCount < limitCount && retryCount < maxRetries && this.isRunning
    }

    private async fetchAndFilterVideos(retryCount: number, maxRetries: number): Promise<Video[] | null> {
        const videos = await this.pageActionService.sendAction('extractVideosFromPage')

        if (!VideoFilter.isValidVideoArray(videos)) {
            Logger.I(`${LOG_PREFIX} No videos found, retry ${retryCount + 1}/${maxRetries}`)
            await this.refreshPage()
            return null
        }

        Logger.I(`${LOG_PREFIX} Extracted ${videos.length} videos, retry ${retryCount + 1}/${maxRetries}`)

        const filteredVideos = VideoFilter.filterByBlacklist(videos)
        Logger.I(`${LOG_PREFIX} Filtered ${filteredVideos.length} videos after blacklist filter`)

        if (filteredVideos.length === 0) {
            Logger.I(`${LOG_PREFIX} No videos passed blacklist filter, retry ${retryCount + 1}/${maxRetries}`)
            await this.refreshPage()
            return null
        }

        return filteredVideos
    }

    private async refreshPage(): Promise<void> {
        await this.pageActionService.sendAction('clickChangeButton').catch(err => {
            Logger.E(`${LOG_PREFIX} Failed to click change button:`, err)
        })
        await this.delay(STUDY_AUTOMATION_CONFIG.PAGE_LOAD_DELAY)
    }

    private async analyzeAndCategorize(videos: Video[]): Promise<VideoAnalysis[]> {
        const videoAnalysis = await this.llmAnalyzer.analyzeVideos(videos)
        const categorizedVideos = videoAnalysis.filter(item =>
            item.category === VideoCategory.CLASS || item.category === VideoCategory.KNOWLEDGE
        )

        Logger.I(`${LOG_PREFIX} LLM categorized ${categorizedVideos.length} videos as class/knowledge`)
        return categorizedVideos
    }

    private handleCollectionError(err: any, retryCount: number, maxRetries: number): boolean {
        Logger.E(`${LOG_PREFIX} Error in automation loop:`, err)

        if (retryCount >= maxRetries) {
            Logger.E(`${LOG_PREFIX} Max retries reached`)
            return false
        }

        this.delay(STUDY_AUTOMATION_CONFIG.PAGE_LOAD_DELAY)
        return true
    }

    private selectTopVideos(studyList: VideoAnalysis[], limitCount: number): VideoAnalysis[] {
        studyList.sort((a, b) => (b.level + b.confidence) - (a.level + a.confidence))
        const finalSelection = studyList.slice(0, limitCount)
        Logger.I(`${LOG_PREFIX} Final selection: ${finalSelection.length} videos`)
        return finalSelection
    }

    private createStoppedResult(): StudyAutomationResult {
        Logger.I(`${LOG_PREFIX} Automation stopped by user`)
        return {
            success: false,
            submittedCount: 0,
            tasks: [],
            message: 'Automation stopped by user'
        }
    }

    private createNoVideosResult(): StudyAutomationResult {
        Logger.E(`${LOG_PREFIX} No videos found after all retries`)
        return {
            success: false,
            submittedCount: 0,
            tasks: [],
            message: 'No suitable videos found'
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
