import { useEffect } from 'react'
import { useAnalytics } from './useAnalytics'
import useDirectFileImport from './useDirectFileImport'
import { useAppStore } from '@/store/appStore'

interface UseUrlParameterHandlerProps {
  processFile: ReturnType<typeof useDirectFileImport>['processFile']
  addFile: ReturnType<typeof useAppStore>['addFile']
  analytics: ReturnType<typeof useAnalytics>
}

export const useUrlParameterHandler = ({ processFile, addFile, analytics }: UseUrlParameterHandlerProps) => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const demoFile = urlParams.get('demo')

    if (demoFile && demoFile.includes('.csv')) {
      // Load sample data for demo
      const sampleData = 'id,name,value\\n1,Sample,100\\n2,Demo,200'
      const file = new File([sampleData], demoFile, { type: 'text/csv' })
      
      processFile(file, (result) => {
        addFile(result)
        analytics.trackFileUpload(result)
      })
    }
  }, [processFile, addFile, analytics])
}