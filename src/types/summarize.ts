export interface SummarizeCommonResponse {
    bvid: number
    cid: number
}

export interface SummarizeSuccessResponse extends SummarizeCommonResponse {
    content: string
    done: boolean
}

export interface CommonErrorResponse {
    error: string
}

export interface SummarizeErrorResponse extends CommonErrorResponse, SummarizeCommonResponse {

}

export type SummarizeResponse = SummarizeSuccessResponse | SummarizeErrorResponse