import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Upload,
  Tag,
  Space,
  Form,
  Select,
  Message,
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

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

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

const mockData: ImportRecord[] = [
  { id: 1, fileName: '员工信息_202406.xlsx', type: '员工导入', totalCount: 150, successCount: 148, failCount: 2, status: 'success', operator: '管理员', createTime: '2024-06-20 10:30' },
  { id: 2, fileName: '部门架构.xlsx', type: '部门导入', totalCount: 20, successCount: 20, failCount: 0, status: 'success', operator: '管理员', createTime: '2024-06-15 14:00' },
  { id: 3, fileName: '考勤数据_06月.xlsx', type: '考勤导入', totalCount: 500, successCount: 0, failCount: 0, status: 'processing', operator: '管理员', createTime: '2024-06-24 09:00' },
]

const statusMap: Record<string, { text: string; color: string }> = {
  uploading: { text: '上传中', color: 'blue' },
  processing: { text: '处理中', color: 'orange' },
  success: { text: '成功', color: 'green' },
  failed: { text: '失败', color: 'red' },
}

function DataImport() {
  const [data] = useState<ImportRecord[]>(mockData)
  const [importType, setImportType] = useState('employee')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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
        <span style={{ color: '#00B42A' }}>{value}</span>
      ),
    },
    {
      title: '失败',
      dataIndex: 'failCount',
      width: 80,
      render: (value: number) => (
        <span style={{ color: '#F53F3F' }}>{value}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string, record) => {
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
          <Button type="text" size="small" icon={<IconDownload />}>
            下载错误
          </Button>
        </Space>
      ),
    },
  ]

  const customRequest: UploadProps['customRequest'] = (option) => {
    const file = option.file as File
    const lowerName = file.name.toLowerCase()
    const isAllowed = ['.xlsx', '.xls', '.csv'].some((ext) => lowerName.endsWith(ext))
    if (!isAllowed) {
      Message.error('仅支持 .xlsx、.xls 或 .csv 文件')
      option.onError?.()
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      Message.error('文件大小不能超过 10MB')
      option.onError?.()
      return
    }
    setSelectedFile(file)
    option.onSuccess?.({})
    Message.success('文件已选择，点击开始导入后上传校验')
  }

  const handleDownloadTemplate = async () => {
    const blob = await downloadTemplate(importType)
    saveBlob(blob as unknown as Blob, `${importType}_template.csv`)
    Message.success('模板下载成功')
  }

  const handleStartImport = async () => {
    if (!selectedFile) {
      Message.warning('请先选择导入文件')
      return
    }
    await uploadImportFile(importType, selectedFile)
    Message.success('文件已上传并通过安全校验')
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card bordered={false}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h3 style={{ marginBottom: 4 }}>数据导入</h3>
              <p style={{ color: '#86909C', fontSize: 12 }}>支持 Excel 格式文件导入</p>
            </div>

            <Form layout="vertical">
              <FormItem label="导入类型">
                <Select value={importType} onChange={setImportType} style={{ width: '100%' }}>
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
              style={{ marginBottom: 16 }}
            >
              <div style={{ padding: '30px 0' }}>
                <IconUpload style={{ fontSize: 48, marginBottom: 8 }} />
                <div>点击或拖拽文件到此处上传</div>
              </div>
            </Upload>

            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
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
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DataImport
