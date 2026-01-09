import Logger from '../../utils/Logger'
import { LOG_PREFIX } from './constants'
import { VideoAnalysis, StudyTask } from './types'

export class StudyTaskSubmitter {
    constructor(
        private submitRequest: (link: string) => Promise<{ success: boolean }>,
        private checkRunning: () => boolean
    ) { }

    async submitTasks(videos: VideoAnalysis[]): Promise<StudyTask[]> {
        const submittedTasks: StudyTask[] = []

        for (const item of videos) {
            if (!this.checkRunning()) {
                Logger.I(`${LOG_PREFIX} Automation stopped during submission`)
                break
            }

            const task = await this.submitSingleTask(item.link)
            submittedTasks.push(task)
        }

        return submittedTasks
    }

    private async submitSingleTask(link: string): Promise<StudyTask> {
        try {
            const studyRequest = await this.submitRequest(link)
            return { link, submitted: studyRequest.success }
        } catch (err: any) {
            Logger.E(`${LOG_PREFIX} Failed to submit study request:`, err)
            return { link, submitted: false }
        }
    }
}
