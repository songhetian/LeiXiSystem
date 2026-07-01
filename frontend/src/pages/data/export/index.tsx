import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Form,
  Select,
  DatePicker,
  Grid,
} from '@arco-design/web-react'
import {
  IconDownload,
  IconFile,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { createExportTask, downloadExportFile } from '@/api/data'
import { saveBlob } from '@/utils/url'
import { toast } from '@/utils/toast'
import styles from '../style.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

const STORAGE_KEY = 'export_records'

interface ExportRecord {
  id: number
  fileName: string
  type: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  operator: string
  createTime: string
  size: string
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'gray' },
  processing: { text: '生成中', color: 'orange' },
  success: { text: '已完成', color: 'green' },
  failed: { text: '失败', color: 'red' },
}

const typeLabels: Record<string, string> = {
  employee: '员工信息导出',
  department: '部门信息导出',
  attendance: '考勤数据导出',
  shift: '排班数据导出',
  salary: '薪资数据导出',
}

function loadRecords(): ExportRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveRecords(records: ExportRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function DataExport() {
  const [data, setData] = useState<ExportRecord[]>([])
  const [form] = Form.useForm()

  useEffect(() => {
    setData(loadRecords())
  }, [])

  const handleAddRecord = useCallback((record: Omit<ExportRecord, 'id'>) => {
    const records = loadRecords()
    const newRecord = {
      ...record,
      id: Date.now(),
    }
    const updatedRecords = [newRecord, ...records]
    saveRecords(updatedRecords)
    setData(updatedRecords)
  }, [])

  const handleDownload = async (record: ExportRecord) => {
    try {
      const blob = await downloadExportFile(record.id)
      saveBlob(blob as unknown as Blob, record.fileName)
      toast.success('下载成功')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }

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
            onClick={() => handleDownload(record)}
          >
            下载
          </Button>
        ) : null,
    },
  ]

  const handleExport = async () => {
    const loading = toast.loading('正在创建导出任务...')
    try {
      const values = await form.validate()
      const [startDate, endDate] = values.dateRange || []
      await createExportTask({
        type: values.type,
        format: values.format,
        departmentIds: values.departmentIds || [],
        startDate,
        endDate,
      })
      handleAddRecord({
        fileName: `${typeLabels[values.type]}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.${values.format}`,
        type: typeLabels[values.type],
        status: 'success',
        operator: '当前用户',
        createTime: new Date().toLocaleString('zh-CN'),
        size: '-',
      })
      loading()
      toast.success('导出任务已创建，请稍候...')
    } catch (err) {
      loading()
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  return (
    <div className={styles['data-export']}>
      <Row gutter={16}>
        <Col span={8}>
          <Card bordered={false}>
            <div className={styles['data-export__form']}>
              <h3 className={styles['data-export__form-title']}>数据导出</h3>
              <p className={styles['data-export__form-desc']}>选择导出类型和条件</p>
            </div>

            <Form form={form} layout="vertical" initialValues={{ type: 'employee', format: 'xlsx' }}>
              <FormItem label="导出类型" field="type" rules={[{ required: true, message: '请选择导出类型' }]}>
                <Select className={styles['data-export__select-full']}>
                  <Option value="employee">员工信息导出</Option>
                  <Option value="department">部门信息导出</Option>
                  <Option value="attendance">考勤数据导出</Option>
                  <Option value="shift">排班数据导出</Option>
                  <Option value="salary">薪资数据导出</Option>
                </Select>
              </FormItem>

              <FormItem label="时间范围" field="dateRange">
                <RangePicker className={styles['data-export__select-full']} />
              </FormItem>

              <FormItem label="部门范围" field="departmentIds">
                <Select mode="multiple" className={styles['data-export__select-full']} placeholder="不选则全部">
                  <Option value={1}>技术部</Option>
                  <Option value={2}>产品部</Option>
                  <Option value={3}>市场部</Option>
                  <Option value={4}>人事部</Option>
                </Select>
              </FormItem>

              <FormItem label="文件格式" field="format" rules={[{ required: true, message: '请选择文件格式' }]}>
                <Select className={styles['data-export__select-full']}>
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
            <div className={styles['data-export__header']}>
              <span className={styles['data-export__title']}>导出记录</span>
            </div>

            <Table
              columns={columns}
              data={data}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              noDataElement={<div className={styles['data-export__empty']}>暂无导出记录</div>}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DataExport
