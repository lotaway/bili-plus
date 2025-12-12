import { useEffect, useRef } from 'react'

interface UseScrollManagementProps {
  resultContainerRef: React.RefObject<HTMLDivElement>
  thinkingContainerRef: React.RefObject<HTMLDivElement>
  hasUserScrolled: boolean
  setHasUserScrolled: (scrolled: boolean) => void
  dependencies: any[]
}

export const useScrollManagement = ({
  resultContainerRef,
  thinkingContainerRef,
  hasUserScrolled,
  setHasUserScrolled,
  dependencies
}: UseScrollManagementProps) => {
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
  }, dependencies)

  useEffect(() => {
    const container = resultContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10
        setHasUserScrolled(!isAtBottom)
      }, 100) as unknown as number
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [resultContainerRef, setHasUserScrolled])
}
