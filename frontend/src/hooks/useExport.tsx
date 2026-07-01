import { useCallback } from 'react'
import { Button } from '@arco-design/web-react'
import { IconDownload } from '@arco-design/web-react/icon'

interface ExportOptions {
  apiUrl: string
  params?: Record<string, any>
  filename?: string
}

export function useExport() {
  const handleExport = useCallback(({ apiUrl, params = {}, filename: _filename }: ExportOptions) => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    const url = `${apiUrl}${queryString ? `?${queryString}` : ''}`
    window.open(url, '_blank')
  }, [])

  const ExportButton = ({ apiUrl, params, filename, ...props }: ExportOptions & Omit<React.ComponentProps<typeof Button>, 'icon' | 'onClick'>) => (
    <Button icon={<IconDownload />} onClick={() => handleExport({ apiUrl, params, filename })} {...props}>
      导出
    </Button>
  )

  return { handleExport, ExportButton }
}

export default useExport
