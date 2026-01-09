export interface Video {
    title: string
    link: string
}

export interface VideoAnalysis {
    category: string
    link: string
    level: number
    confidence: number
    reason?: string
}

export interface StudyTask {
    link: string
    submitted: boolean
}

export interface StudyAutomationResult {
    success: boolean
    submittedCount: number
    tasks: StudyTask[]
    message?: string
}

export interface LLMResponse {
    choices?: Array<{
        message?: {
            content?: string
        }
    }>
}
