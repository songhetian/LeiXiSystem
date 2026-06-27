import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Form,
  Select,
  DatePicker,
  Message,
  Grid,
} from '@arco-design/web-react'
import {
  IconDownload,
  IconFile,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { createExportTask, downloadExportFile } from '@/api/data'
import { saveBlob } from '@/utils/url'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

interface ExportRecord {
  id: number
  fileName: string
  type: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  operator: string
  createTime: string
  size: string
}

const mockData: ExportRecord[] = [
  { id: 1, fileName: '员工信息_20240624.xlsx', type: '员工导出', status: 'success', operator: '管理员', createTime: '2024-06-24 10:30', size: '2.5MB' },
  { id: 2, fileName: '考勤报表_6月.xlsx', type: '考勤导出', status: 'success', operator: '管理员', createTime: '2024-06-23 14:00', size: '5.2MB' },
  { id: 3, fileName: '薪资明细_6月.xlsx', type: '薪资导出', status: 'processing', operator: '管理员', createTime: '2024-06-24 09:00', size: '-' },
]

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'gray' },
  processing: { text: '生成中', color: 'orange' },
  success: { text: '已完成', color: 'green' },
  failed: { text: '失败', color: 'red' },
}

function DataExport() {
  const [data] = useState<ExportRecord[]>(mockData)
  const [form] = Form.useForm()

  const columns: TableProps<ExportRecord>['columns'] = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      width: 220,
      render: (value: string) => (
        <Space size="small">
          <IconFile />
          {value}
        </Space>
      ),
    },
    {
      title: '导出类型',
      dataIndex: 'type',
      width: 120,
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 160,
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, record: ExportRecord) =>
        record.status === 'success' ? (
          <Button
            type="text"
            size="small"
            icon={<IconDownload />}
            onClick={async () => {
              const blob = await downloadExportFile(record.id)
              saveBlob(blob as unknown as Blob, record.fileName)
            }}
          >
            下载
          </Button>
        ) : null,
    },
  ]

  const handleExport = async () => {
    const values = await form.validate()
    const [startDate, endDate] = values.dateRange || []
    await createExportTask({
      type: values.type,
      format: values.format,
      departmentIds: values.departmentIds || [],
      startDate,
      endDate,
    })
    Message.success('导出任务已创建，请稍候...')
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card bordered={false}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h3 style={{ marginBottom: 4 }}>数据导出</h3>
              <p style={{ color: '#86909C', fontSize: 12 }}>选择导出类型和条件</p>
            </div>

            <Form form={form} layout="vertical" initialValues={{ type: 'employee', format: 'xlsx' }}>
              <FormItem label="导出类型" field="type" rules={[{ required: true, message: '请选择导出类型' }]}>
                <Select style={{ width: '100%' }}>
                  <Option value="employee">员工信息导出</Option>
                  <Option value="department">部门信息导出</Option>
                  <Option value="attendance">考勤数据导出</Option>
                  <Option value="shift">排班数据导出</Option>
                  <Option value="salary">薪资数据导出</Option>
                </Select>
              </FormItem>

              <FormItem label="时间范围" field="dateRange">
                <RangePicker style={{ width: '100%' }} />
              </FormItem>

              <FormItem label="部门范围" field="departmentIds">
                <Select mode="multiple" style={{ width: '100%' }} placeholder="不选则全部">
                  <Option value={1}>技术部</Option>
                  <Option value={2}>产品部</Option>
                  <Option value={3}>市场部</Option>
                  <Option value={4}>人事部</Option>
                </Select>
              </FormItem>

              <FormItem label="文件格式" field="format" rules={[{ required: true, message: '请选择文件格式' }]}>
                <Select style={{ width: '100%' }}>
                  <Option value="xlsx">Excel (.xlsx)</Option>
                  <Option value="xls">Excel (.xls)</Option>
                  <Option value="csv">CSV (.csv)</Option>
                </Select>
              </FormItem>

              <Button
                type="primary"
                long
                icon={<IconDownload />}
                onClick={handleExport}
              >
                生成导出文件
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={16}>
          <Card bordered={false}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>导出记录</span>
            </div>

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

export default DataExport
