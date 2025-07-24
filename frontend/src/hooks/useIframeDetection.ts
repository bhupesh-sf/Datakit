import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'

/**
 * Hook to detect and handle iframe context
 */
export const useIframeDetection = () => {
  const { setIsInIframe, setSidebarCollapsed } = useAppStore()

  useEffect(() => {
    const detectIframe = () => {
      try {
        return window.self !== window.top
      } catch (e) {
        // If we can't access window.top due to cross-origin restrictions,
        // we're likely in an iframe
        return true
      }
    }

    const isInIframe = detectIframe()
    setIsInIframe(isInIframe)

    // If we're in an iframe, collapse the sidebar by default
    if (isInIframe) {
      setSidebarCollapsed(true)
    }
  }, [setIsInIframe, setSidebarCollapsed])
}