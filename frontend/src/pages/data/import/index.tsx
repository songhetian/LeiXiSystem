import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Button,
  Upload,
  Tag,
  Space,
  Form,
  Select,
  Grid,
  Progress,
  Tabs,
} from '@arco-design/web-react'
import {
  IconUpload,
  IconDownload,
  IconFile,
  IconPlus,
} from '@arco-design/web-react/icon'
import type { TableProps, UploadProps } from '@arco-design/web-react'
import { downloadTemplate, uploadImportFile } from '@/api/data'
import { saveBlob } from '@/utils/url'
import { toast } from '@/utils/toast'
import styles from '../style.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

const STORAGE_KEY = 'import_records'

interface ImportRecord {
  id: number
  fileName: string
  type: string
  totalCount: number
  successCount: number
  failCount: number
  status: 'uploading' | 'processing' | 'success' | 'failed'
  operator: string
  createTime: string
}

const statusMap: Record<string, { text: string; color: string }> = {
  uploading: { text: '上传中', color: 'blue' },
  processing: { text: '处理中', color: 'orange' },
  success: { text: '成功', color: 'green' },
  failed: { text: '失败', color: 'red' },
}

function loadRecords(): ImportRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveRecords(records: ImportRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function DataImport() {
  const [data, setData] = useState<ImportRecord[]>([])
  const [importType, setImportType] = useState('employee')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    setData(loadRecords())
  }, [])

  const handleAddRecord = useCallback((record: Omit<ImportRecord, 'id'>) => {
    const records = loadRecords()
    const newRecord = {
      ...record,
      id: Date.now(),
    }
    const updatedRecords = [newRecord, ...records]
    saveRecords(updatedRecords)
    setData(updatedRecords)
  }, [])

  const columns: TableProps<ImportRecord>['columns'] = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      width: 200,
      render: (value: string) => (
        <Space size="small">
          <IconFile />
          {value}
        </Space>
      ),
    },
    {
      title: '导入类型',
      dataIndex: 'type',
      width: 120,
    },
    {
      title: '总数',
      dataIndex: 'totalCount',
      width: 80,
    },
    {
      title: '成功',
      dataIndex: 'successCount',
      width: 80,
      render: (value: number) => (
        <span className={styles['data-import__success']}>{value}</span>
      ),
    },
    {
      title: '失败',
      dataIndex: 'failCount',
      width: 80,
      render: (value: number) => (
        <span className={styles['data-import__fail']}>{value}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const info = statusMap[value]
        if (value === 'processing') {
          return (
            <Space size="small">
              <Progress percent={60} width={80} size="small" />
              <Tag color={info.color}>{info.text}</Tag>
            </Space>
          )
        }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      width: 100,
    },
    {
      title: '导入时间',
      dataIndex: 'createTime',
      width: 160,
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record: ImportRecord) => (
        <Space size="small">
          {record.status === 'failed' && (
            <Button type="text" size="small" icon={<IconDownload />}>
              下载错误
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const customRequest: UploadProps['customRequest'] = (option) => {
    const file = option.file as File
    const lowerName = file.name.toLowerCase()
    const isAllowed = ['.xlsx', '.xls', '.csv'].some((ext) => lowerName.endsWith(ext))
    if (!isAllowed) {
      toast.error('仅支持 .xlsx、.xls 或 .csv 文件')
      option.onError?.()
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件大小不能超过 10MB')
      option.onError?.()
      return
    }
    setSelectedFile(file)
    option.onSuccess?.({})
    toast.success('文件已选择，点击开始导入后上传校验')
  }

  const handleDownloadTemplate = async () => {
    const loading = toast.loading('正在下载模板...')
    try {
      const blob = await downloadTemplate(importType)
      saveBlob(blob as unknown as Blob, `${importType}_template.csv`)
      loading()
      toast.success('模板下载成功')
    } catch (err) {
      loading()
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleStartImport = async () => {
    if (!selectedFile) {
      toast.warning('请先选择导入文件')
      return
    }
    const loading = toast.loading('正在上传文件...')
    try {
      await uploadImportFile(importType, selectedFile)
      handleAddRecord({
        fileName: selectedFile.name,
        type: `${importType}导入`,
        totalCount: 0,
        successCount: 0,
        failCount: 0,
        status: 'success',
        operator: '当前用户',
        createTime: new Date().toLocaleString('zh-CN'),
      })
      loading()
      toast.success('文件已上传并通过安全校验')
      setSelectedFile(null)
    } catch (err) {
      loading()
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  return (
    <div className={styles['data-import']}>
      <Row gutter={16}>
        <Col span={8}>
          <Card bordered={false}>
            <div className={styles['data-import__form']}>
              <h3 className={styles['data-import__form-title']}>数据导入</h3>
              <p className={styles['data-import__form-desc']}>支持 Excel 格式文件导入</p>
            </div>

            <Form layout="vertical">
              <FormItem label="导入类型">
                <Select value={importType} onChange={setImportType} className={styles['data-import__select-full']}>
                  <Option value="employee">员工信息导入</Option>
                  <Option value="department">部门信息导入</Option>
                  <Option value="attendance">考勤数据导入</Option>
                  <Option value="shift">排班数据导入</Option>
                </Select>
              </FormItem>
            </Form>

            <Upload
              customRequest={customRequest}
              accept=".xlsx,.xls,.csv"
              drag
              tip="仅支持 .xlsx / .xls / .csv，最大 10MB"
              className={styles['data-import__upload']}
            >
              <div className={styles['data-import__upload-content']}>
                <IconUpload className={styles['data-import__upload-icon']} />
                <div>点击或拖拽文件到此处上传</div>
              </div>
            </Upload>

            <Space className={styles['data-import__space-between']}>
              <Button type="text" icon={<IconDownload />} onClick={handleDownloadTemplate}>
                下载模板
              </Button>
              <Button type="primary" icon={<IconPlus />} onClick={handleStartImport}>
                开始导入
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={16}>
          <Card bordered={false}>
            <Tabs defaultActiveTab="all">
              <TabPane key="all" title="全部记录" />
              <TabPane key="success" title="成功" />
              <TabPane key="failed" title="失败" />
            </Tabs>

            <Table
              columns={columns}
              data={data}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              noDataElement={<div className={styles['data-import__empty']}>暂无导入记录</div>}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DataImport
