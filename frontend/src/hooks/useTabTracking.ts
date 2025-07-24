import { useEffect, useRef } from 'react'
import { useAnalytics } from './useAnalytics'

export const useTabTracking = (activeTab: string) => {
  const analytics = useAnalytics()
  const previousTabRef = useRef<string>('')

  useEffect(() => {
    if (previousTabRef.current && previousTabRef.current !== activeTab) {
      analytics.trackTabChange(previousTabRef.current, activeTab)
    }
    previousTabRef.current = activeTab
  }, [activeTab, analytics])
}