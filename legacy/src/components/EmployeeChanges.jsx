import React, { useState, useEffect, useMemo } from 'react'
import { formatBeijingDate, getLocalDateString } from '../utils/date'
import { toast } from 'sonner'
import { getApiUrl } from '../utils/apiConfig'
import { 
    SearchOutlined, 
    DownloadOutlined, 
    SyncOutlined,
    ArrowRightOutlined
} from '@ant-design/icons';
import { 
    Table, 
    Row, 
    Col, 
    Select, 
    Input, 
    Button, 
    Tag, 
    Tooltip, 
    ConfigProvider, 
    Avatar, 
    Typography,
    Space,
    Divider
} from 'antd';

const { Text, Title } = Typography;

function EmployeeChanges() {
  const [changes, setChanges] = useState([])
  const [filter, setFilter] = useState('all')
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [searchFilteredPositions, setSearchFilteredPositions] = useState([])

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: '',
    position: '',
    dateFrom: '',
    dateTo: ''
  })

  const fetchChanges = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? getApiUrl('/api/employee-changes') : getApiUrl(`/api/employee-changes?type=${filter}`)
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      if (response.ok) setChanges(await response.json())
    } catch (e) { toast.error('同步流水失败') }
    finally { setLoading(false); }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch(getApiUrl('/api/departments'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json()
      setDepartments(data.filter(d => d.status === 'active'))
    } catch (e) {}
  }

  const fetchPositions = async () => {
    try {
      const res = await fetch(getApiUrl('/api/positions?limit=1000'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      const data = await res.json()
      setPositions(data.filter(p => p.status === 'active'))
    } catch (e) {}
  }

  useEffect(() => { fetchChanges(); fetchDepartments(); fetchPositions(); }, [filter])

  useEffect(() => {
    if (searchFilters.department) {
      setSearchFilteredPositions(positions.filter(p => !p.department_id || String(p.department_id) === String(searchFilters.department)))
    } else { setSearchFilteredPositions(positions) }
  }, [searchFilters.department, positions])

  const { filteredChanges } = useMemo(() => {
    let list = [...changes]
    if (searchFilters.keyword) {
      const kw = searchFilters.keyword.toLowerCase()
      list = list.filter(c => c.real_name?.toLowerCase().includes(kw) || c.employee_no?.toLowerCase().includes(kw))
    }
    if (searchFilters.department) {
      list = list.filter(c => String(c.new_department_id) === String(searchFilters.department) || String(c.old_department_id) === String(searchFilters.department))
    }
    if (searchFilters.position) {
      list = list.filter(c => c.new_position_name === searchFilters.position || c.old_position_name === searchFilters.position)
    }
    if (searchFilters.dateFrom) list = list.filter(c => formatBeijingDate(c.change_date) >= searchFilters.dateFrom)
    if (searchFilters.dateTo) list = list.filter(c => formatBeijingDate(c.change_date) <= searchFilters.dateTo)
    return { filteredChanges: list }
  }, [searchFilters, changes])

  const handlePageChange = (p, s) => { setCurrentPage(p); setPageSize(s); }
  const handleSearchChange = (field, value) => { setSearchFilters(prev => ({ ...prev, [field]: value })); setCurrentPage(1); }
  const clearFilters = () => { setSearchFilters({ keyword: '', department: '', position: '', dateFrom: '', dateTo: '' }); setFilter('all'); setCurrentPage(1); }

  const handleDateQuickSelect = (type) => {
    const now = new Date(); let from = '', to = getLocalDateString(now);
    switch(type) {
      case 'today': from = to; break;
      case 'yesterday': const yest = new Date(); yest.setDate(yest.getDate() - 1); from = to = getLocalDateString(yest); break;
      case 'last7': const last7 = new Date(); last7.setDate(last7.getDate() - 6); from = getLocalDateString(last7); break;
      case 'last30': const last30 = new Date(); last30.setDate(last30.getDate() - 29); from = getLocalDateString(last30); break;
      case 'thisMonth': from = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)); break;
    }
    setSearchFilters(prev => ({ ...prev, dateFrom: from, dateTo: to })); setCurrentPage(1);
  }

  const columns = [
    {
      title: '变动日期',
      dataIndex: 'change_date',
      key: 'change_date',
      width: 150,
      render: (date) => <Text className="text-slate-900 font-black">{formatBeijingDate(date)}</Text>
    },
    {
      title: '员工信息',
      key: 'employee',
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar shape="square" className="bg-slate-800 text-white font-black">{record.real_name?.charAt(0)}</Avatar>
          <div className="flex flex-col">
            <Text className="text-slate-900 font-black">{record.real_name}</Text>
            <Text className="text-slate-500 text-xs font-bold">{record.employee_no}</Text>
          </div>
        </Space>
      )
    },
    {
      title: '变动类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 120,
      render: (type) => {
        const labels = { hire:'核准入职', transfer:'部门调动', promotion:'职级晋升', resign:'主动辞职', terminate:'辞退离职' };
        return <Tag className="font-black border-slate-900 text-slate-900">{labels[type] || type}</Tag>
      }
    },
    {
      title: '变动详情',
      key: 'details',
      render: (_, record) => (
        <div className="text-slate-900 font-black">
          {record.change_type === 'transfer' && <span>{record.old_department_name} → {record.new_department_name}</span>}
          {record.change_type === 'promotion' && <span>{record.old_position_name} → {record.new_position_name}</span>}
          {record.change_type === 'hire' && <span>入职部门: {record.new_department_name}</span>}
          {['resign', 'terminate'].includes(record.change_type) && <span>离任部门: {record.old_department_name}</span>}
        </div>
      )
    },
    {
      title: '备注说明',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (reason) => <Text className="text-slate-600 font-bold">{reason || '-'}</Text>
    }
  ];

  const nowTime = new Date();
  const dateOptions = [
    { label: '今天', type: 'today', f: getLocalDateString(), t: getLocalDateString() },
    { label: '昨天', type: 'yesterday', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))), t: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-1))) },
    { label: '近7天', type: 'last7', f: getLocalDateString(new Date(new Date().setDate(new Date().getDate()-6))), t: getLocalDateString() },
    { label: '本月', type: 'thisMonth', f: getLocalDateString(new Date(nowTime.getFullYear(), nowTime.getMonth(), 1)), t: getLocalDateString() }
  ];

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#000000', borderRadius: 4, colorBorder: '#64748b' }
    }}>
    <div className="p-8 bg-white min-h-screen text-left">
      <div className="flex justify-between items-end mb-8">
        <div>
          <Title level={3} className="m-0 font-black text-slate-900">变动记录</Title>
          <Text className="text-slate-500 font-bold">查看员工全生命周期变动流水</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={fetchChanges} loading={loading} className="font-black border-slate-900">刷新</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.open(getApiUrl('/api/export/employee-changes'), '_blank')} className="font-black bg-slate-900">导出报表</Button>
        </Space>
      </div>

      <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-lg">
        <Row gutter={[16, 16]} align="middle">
          <Col span={6}>
            <Input prefix={<SearchOutlined />} placeholder="姓名/工号" value={searchFilters.keyword} onChange={e => handleSearchChange('keyword', e.target.value)} className="font-black border-slate-500" />
          </Col>
          <Col span={4}>
            <Select placeholder="部门" className="w-full font-black" value={searchFilters.department || undefined} onChange={v => handleSearchChange('department', v)} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
          </Col>
          <Col span={4}>
            <Select placeholder="类型" className="w-full font-black" value={filter} onChange={setFilter} options={[{label:'全部记录',value:'all'},{label:'入职',value:'hire'},{label:'调动',value:'transfer'},{label:'晋升',value:'promotion'},{label:'离职',value:'terminate'}]} />
          </Col>
          <Col span={6}>
            <Space.Compact className="w-full">
              <Input type="date" value={searchFilters.dateFrom} onChange={e => handleSearchChange('dateFrom', e.target.value)} className="font-black border-slate-500" />
              <Input type="date" value={searchFilters.dateTo} onChange={e => handleSearchChange('dateTo', e.target.value)} className="font-black border-slate-500" />
            </Space.Compact>
          </Col>
          <Col span={4}>
            <Button onClick={clearFilters} className="w-full font-black border-slate-900">重置</Button>
          </Col>
        </Row>
        <Divider className="my-4 border-slate-200" />
        <Space>
          {dateOptions.map(opt => (
            <Button 
              key={opt.type} 
              size="small" 
              onClick={() => handleDateQuickSelect(opt.type)}
              className={`font-black ${searchFilters.dateFrom === opt.f ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              {opt.label}
            </Button>
          ))}
        </Space>
      </div>

      <Table 
        dataSource={filteredChanges} 
        columns={columns} 
        rowKey="id"
        loading={loading}
        bordered
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: filteredChanges.length,
          onChange: handlePageChange,
          className: "mt-8 font-black"
        }}
        rowClassName="hover:bg-slate-50"
      />
    </div>
    </ConfigProvider>
  );
}

export default EmployeeChanges;
