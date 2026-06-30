import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  DatePicker,
  Form,
  Tag,
  Card,
  Spin,
} from '@arco-design/web-react'
import { IconSearch, IconRefresh } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getEmployeeChanges, EmployeeChange } from '@/api/personnel'
import './changes.css'

const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

function Changes() {
  const [data, setData] = useState<EmployeeChange[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<ReturnType<typeof dayjs>[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const loadData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getEmployeeChanges({
        page,
        pageSize,
        keyword: searchText || undefined,
        type: searchType,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(pagination.current, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeMap: Record<string, { text: string; color: string }> = {
    '信息变更': { text: '信息变更', color: 'blue' },
    '删除员工': { text: '删除员工', color: 'red' },
    '新增员工': { text: '新增员工', color: 'green' },
  }

  const columns: TableProps<EmployeeChange>['columns'] = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'employeeName',
      width: 100,
    },
    {
      title: '变动类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => {
        const info = typeMap[value]
        return <Tag color={info?.color || 'gray'}>{info?.text || value}</Tag>
      },
    },
    {
      title: '变动前',
      dataIndex: 'beforeContent',
      width: 180,
      ellipsis: true,
    },
    {
      title: '变动后',
      dataIndex: 'afterContent',
      width: 180,
      ellipsis: true,
    },
    {
      title: '变动日期',
      dataIndex: 'changeDate',
      width: 120,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      width: 100,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
    },
  ]

  const handleSearch = () => {
    loadData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchType(undefined)
    setDateRange([])
    loadData(1, pagination.pageSize)
  }

  const handlePageChange = (current: number, pageSize: number) => {
    loadData(current, pageSize)
  }

  return (
    <div className="changes-page">
      <Card bordered={false} className="changes-page__search-card">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="changes-page__search-input"
              placeholder="姓名/工号"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="变动类型">
            <Select
              className="changes-page__type-select"
              placeholder="请选择类型"
              value={searchType}
              onChange={(val) => {
                setSearchType(val)
                loadData(1, pagination.pageSize)
              }}
              allowClear
            >
              <Option value="信息变更">信息变更</Option>
              <Option value="删除员工">删除员工</Option>
              <Option value="新增员工">新增员工</Option>
            </Select>
          </FormItem>
          <FormItem label="变动时间">
            <RangePicker
              className="changes-page__date-range"
              onChange={(v: ReturnType<typeof dayjs>[] | string[]) => {
                setDateRange(v as ReturnType<typeof dayjs>[])
                if (v && v.length === 2) {
                  loadData(1, pagination.pageSize)
                }
              }}
            />
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div className="changes-page__margin-bottom">
          <span className="changes-page__title">变动记录</span>
          <Tag color="blue" className="changes-page__tag-margin">
            共 {pagination.total} 条
          </Tag>
        </div>

        <Spin loading={loading}>
          <Table
            columns={columns}
            data={data}
            rowKey="id"
            pagination={{
              ...pagination,
              sizeOptions: [10, 20, 50],
              onChange: handlePageChange,
            }}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default Changes
