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