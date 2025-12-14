import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../store/store'
import { setHasUserScrolled } from '../../../store/slices/videoSummarySlice'

export const useScrollManagement = (
  resultContainerRef: React.RefObject<HTMLDivElement>,
  thinkingContainerRef: React.RefObject<HTMLDivElement>
) => {
  const dispatch = useDispatch()
  const { hasUserScrolled, outputContent, messages } = useSelector((state: RootState) => state.videoSummary)
  const scrollTimeoutRef = useRef<number>()

  useEffect(() => {
    const scrollToBottom = () => {
      if (resultContainerRef.current && !hasUserScrolled) {
        resultContainerRef.current.scrollTop = resultContainerRef.current.scrollHeight
      }
      if (thinkingContainerRef.current) {
        thinkingContainerRef.current.scrollTop = thinkingContainerRef.current.scrollHeight
      }
    }

    scrollToBottom()
  }, [resultContainerRef, thinkingContainerRef, hasUserScrolled, outputContent.markdown, outputContent.thinking, messages])

  useEffect(() => {
    const container = resultContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10
        dispatch(setHasUserScrolled(!isAtBottom))
      }, 100) as unknown as number
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [resultContainerRef, dispatch])
}
