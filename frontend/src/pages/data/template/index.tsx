import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Message,
} from '@arco-design/web-react'
import {
  IconDownload,
  IconFile,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { downloadTemplate } from '@/api/data'
import { saveBlob } from '@/utils/url'
import './style.css'

interface Template {
  id: number
  code: string
  name: string
  type: string
  description: string
  fileType: string
  size: string
  updateTime: string
}

const templateList: Template[] = [
  { id: 1, code: 'employee', name: '员工信息导入模板', type: '员工管理', description: '用于批量导入员工基础信息', fileType: 'csv', size: '按需生成', updateTime: '实时' },
  { id: 2, code: 'department', name: '部门信息导入模板', type: '公司架构', description: '用于批量导入部门架构信息', fileType: 'csv', size: '按需生成', updateTime: '实时' },
  { id: 3, code: 'attendance', name: '考勤数据导入模板', type: '考勤管理', description: '用于批量导入考勤打卡数据', fileType: 'csv', size: '按需生成', updateTime: '实时' },
  { id: 4, code: 'shift', name: '排班数据导入模板', type: '排班管理', description: '用于批量导入排班信息', fileType: 'csv', size: '按需生成', updateTime: '实时' },
  { id: 5, code: 'salary', name: '薪资数据导入模板', type: '薪资管理', description: '用于批量导入薪资数据', fileType: 'csv', size: '按需生成', updateTime: '实时' },
]

function Template() {
  const data = templateList

  const columns: TableProps<Template>['columns'] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 200,
      render: (value: string) => (
        <Space size="small">
          <IconFile />
          {value}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '文件格式',
      dataIndex: 'fileType',
      width: 100,
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 80,
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 120,
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, record: Template) => (
        <Button
          type="text"
          size="small"
          icon={<IconDownload />}
          onClick={() => handleDownload(record)}
        >
          下载
        </Button>
      ),
    },
  ]

  const handleDownload = async (record: Template) => {
    try {
      const blob = await downloadTemplate(record.code)
      saveBlob(blob as unknown as Blob, `${record.code}_template.csv`)
      Message.success('下载成功')
    } catch {
      // error handled by interceptor
    }
  }

  return (
    <div className="data-template">
      <Card bordered={false}>
        <div className="data-template__header">
          <span className="data-template__title">模板管理</span>
          <Tag color="blue" className="data-template__tag">
            共 {data.length} 个模板
          </Tag>
        </div>

        <Table columns={columns} data={data} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}

export default Template
