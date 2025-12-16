import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface DecisionData {
  reason: string
  message?: string
  max_iterations?: number
  [key: string]: any
}

interface OutputContent {
  markdown: string
  thinking: string
}

interface VideoSummaryState {
  isAssistantRunning: boolean
  outputContent: OutputContent
  decisionData: DecisionData | null
  hasUserScrolled: boolean
  messages: string
  showDownloadButton: boolean
}

const initialState: VideoSummaryState = {
  isAssistantRunning: false,
  outputContent: { markdown: '', thinking: '' },
  decisionData: null,
  hasUserScrolled: false,
  messages: '',
  showDownloadButton: false,
}

export const videoSummarySlice = createSlice({
  name: 'videoSummary',
  initialState,
  reducers: {
    setAssistantRunning: (state, action: PayloadAction<boolean>) => {
      state.isAssistantRunning = action.payload
    },
    setMessage: (state, action: PayloadAction<string>) => {
      state.messages = action.payload
      state.hasUserScrolled = false
    },
    clearOutput: (state) => {
      state.messages = ''
      state.outputContent = { markdown: '', thinking: '' }
      state.showDownloadButton = false
      state.decisionData = null
    },
    appendMarkdownContent: (state, action: PayloadAction<string>) => {
      state.outputContent.markdown += action.payload
      state.hasUserScrolled = false
    },
    setMarkdownContent: (state, action: PayloadAction<string>) => {
      state.outputContent.markdown = action.payload
      state.messages = ''
      state.showDownloadButton = true
      state.hasUserScrolled = false
    },
    appendThinkingContent: (state, action: PayloadAction<string>) => {
      state.outputContent.thinking += action.payload
      state.hasUserScrolled = false
    },
    setThinkingContent: (state, action: PayloadAction<string>) => {
      state.outputContent.thinking = action.payload
      state.hasUserScrolled = false
    },
    setDecisionData: (state, action: PayloadAction<DecisionData | null>) => {
      state.decisionData = action.payload
    },
    setHasUserScrolled: (state, action: PayloadAction<boolean>) => {
      state.hasUserScrolled = action.payload
    },
    setShowDownloadButton: (state, action: PayloadAction<boolean>) => {
      state.showDownloadButton = action.payload
    },
  },
})

export const {
  setAssistantRunning,
  setMessage,
  clearOutput,
  appendMarkdownContent,
  setMarkdownContent,
  appendThinkingContent,
  setThinkingContent,
  setDecisionData,
  setHasUserScrolled,
  setShowDownloadButton,
} = videoSummarySlice.actions

export default videoSummarySlice.reducer
