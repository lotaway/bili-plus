export interface CompletionData {
    id?: string
    object?: string
    created?: number
    model?: string
    choices: Array<{
        index: number
        delta: {
            content?: string
            role?: string
        }
        finish_reason?: string | null
    }>
    agent_metadata?: any
}