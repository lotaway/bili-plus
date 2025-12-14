import { configureStore } from '@reduxjs/toolkit'
import videoSummaryReducer from './slices/videoSummarySlice'

export const store = configureStore({
  reducer: {
    videoSummary: videoSummaryReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
