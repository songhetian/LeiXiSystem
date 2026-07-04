import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Select,
  Popconfirm,
} from '@arco-design/web-react'
import {
  IconDownload,
  IconFile,
  IconDelete,
  IconRefresh,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getExportTasks,
  downloadExportTask,
  deleteExportTask,
  type ExportTask,
  type ExportStatus,
  type ReportType,
  type ExportTaskListResponse,
} from '@/api/export'
import { saveBlob } from '@/utils/url'
import { toast } from '@/utils/toast'
import styles from './style.module.css'
const Option = Select.Option

const statusMap: Record<ExportStatus, { text: string; color: string }> = {
  pending: { text: '等待中', color: 'gray' },
  processing: { text: '进行中', color: 'orange' },
  completed: { text: '已完成', color: 'green' },
  failed: { text: '失败', color: 'red' },
}

const reportTypeLabels: Record<ReportType, string> = {
  schedule: '排班报表',
  attendance: '考勤报表',
  'leave-overtime': '请假加班报表',
  finance: '财务报表',
}

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function ExportTasks() {
  const [data, setData] = useState<ExportTask[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<ExportStatus | undefined>()
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportType | undefined>()
  const timerRef = useRef<number | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await getExportTasks({
        page,
        pageSize,
        status: statusFilter,
        reportType: reportTypeFilter,
      })) as unknown as ExportTaskListResponse
      setData(res.list || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('[ExportTasks] 获取任务列表失败:', err)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, reportTypeFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const hasProcessingTasks = data.some(
    (task) => task.status === 'pending' || task.status === 'processing'
  )

  useEffect(() => {
    if (hasProcessingTasks) {
      timerRef.current = window.setInterval(() => {
        fetchTasks()
      }, 5000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [hasProcessingTasks, fetchTasks])

  const handleDownload = async (record: ExportTask) => {
    try {
      const blob = await downloadExportTask(record.id)
      saveBlob(blob as unknown as Blob, record.fileName)
      toast.success('下载成功')
    } catch (err) {
      console.error('[ExportTasks] 下载失败:', err)
    }
  }

  const handleDelete = async (record: ExportTask) => {
    try {
      await deleteExportTask(record.id)
      toast.success('删除成功')
      fetchTasks()
    } catch (err) {
      console.error('[ExportTasks] 删除失败:', err)
    }
  }

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage)
    setPageSize(newPageSize)
  }

  const handleStatusChange = (value: ExportStatus | undefined) => {
    setStatusFilter(value)
    setPage(1)
  }

  const handleReportTypeChange = (value: ReportType | undefined) => {
    setReportTypeFilter(value)
    setPage(1)
  }

  const handleRefresh = () => {
    fetchTasks()
  }

  const columns: TableProps<ExportTask>['columns'] = [
    {
      title: '任务ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '报表类型',
      dataIndex: 'reportType',
      width: 140,
      render: (value: ReportType) => reportTypeLabels[value] || value,
    },
    {
      title: '格式',
      dataIndex: 'format',
      width: 80,
      render: (value: string) => value.toUpperCase(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: ExportStatus) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
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
      title: '文件大小',
      dataIndex: 'fileSize',
      width: 100,
      render: (value: number) => formatFileSize(value),
    },
    {
      title: '行数',
      dataIndex: 'totalRows',
      width: 80,
      render: (value: number) => (value ? value.toLocaleString() : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      width: 160,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_: any, record: ExportTask) => (
        <Space size="small">
          {record.status === 'completed' && (
            <Button
              type="text"
              size="small"
              icon={<IconDownload />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确认删除"
            content="确定要删除此导出任务吗？"
            onOk={() => handleDelete(record)}
          >
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles['export-tasks']}>
      <Card bordered={false}>
        <div className={styles['export-tasks__header']}>
          <span className={styles['export-tasks__title']}>导出任务管理</span>
          <Button
            type="text"
            icon={<IconRefresh />}
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </div>

        <div className={styles['export-tasks__filters']}>
          <Space size="medium">
            <div className={styles['export-tasks__filter-item']}>
              <span className={styles['export-tasks__filter-label']}>状态：</span>
              <Select
                className={styles['export-tasks__filter-select']}
                placeholder="全部状态"
                allowClear
                value={statusFilter}
                onChange={handleStatusChange}
              >
                <Option value="pending">等待中</Option>
                <Option value="processing">进行中</Option>
                <Option value="completed">已完成</Option>
                <Option value="failed">失败</Option>
              </Select>
            </div>
            <div className={styles['export-tasks__filter-item']}>
              <span className={styles['export-tasks__filter-label']}>报表类型：</span>
              <Select
                className={styles['export-tasks__filter-select-wide']}
                placeholder="全部类型"
                allowClear
                value={reportTypeFilter}
                onChange={handleReportTypeChange}
              >
                <Option value="schedule">排班报表</Option>
                <Option value="attendance">考勤报表</Option>
                <Option value="leave-overtime">请假加班报表</Option>
                <Option value="finance">财务报表</Option>
              </Select>
            </div>
          </Space>
        </div>

        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: true,
            pageSizeChangeResetCurrent: true,
            onChange: handlePageChange,
          }}
          scroll={{ x: 1200 }}
          noDataElement={<div className={styles['export-tasks__empty']}>暂无导出任务</div>}
        />
      </Card>
    </div>
  )
}

export default ExportTasks
