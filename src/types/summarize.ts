export interface SummarizeCommonResponse {
    bvid: string
    cid: number
}

export interface SummarizeSuccessResponse extends SummarizeCommonResponse {
    think: string
    content: string
    done: boolean
}

export interface CommonErrorResponse {
    error: string
}

export interface SummarizeErrorResponse extends CommonErrorResponse, SummarizeCommonResponse {

}

export type SummarizeResponse = SummarizeSuccessResponse | SummarizeErrorResponse

// {
//   "status": "waiting_human",
//   "current_agent": "planning", 
//   "iteration_count": 3,
//   "history": [
//     { ... }, 
//     {
//       "agent": "risk",  // or "task_mcp"
//       "status": "needs_human",
//       "data": {
//         "task": { ... },
//         "prompt": "需要人工审批此操作...", // The message to show the user
//         "risk_assessment": { ... } // If triggered by risk agent
//       },
//       "metadata": { ... }
//     }
//   ],
//   "context": { ... }
// }

export enum AgentRuntimeStatus {
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    WAITING_HUMAN = "waiting_human",
    MAX_ITERATIONS = "max_iterations",
}

export type Agent = string


export interface AgentTask {

}

export interface AgentMetadata {
}

export interface AgentData {
    task: AgentTask
    prompt: string
    risk_assessment: any
    metadata: AgentMetadata
}

export interface AgentHistory {
    agent: Agent
    status: AgentRuntimeStatus
    data: AgentData
}

export interface Message {
    type: string
    content: string
    [key: string]: string
}

export interface AgentSuccessResponse extends SummarizeSuccessResponse {
    status: AgentRuntimeStatus
    current_agent: Agent
    iteration_count: number
    history: AgentHistory[]
    context: Message[]
}

export type AgentResponse = AgentSuccessResponse | CommonErrorResponse