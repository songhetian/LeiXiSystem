import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Message, Modal, Select, Space, Table, Tabs, Tag } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconPlus, IconRefresh } from '@arco-design/web-react/icon'
import { createCandidate, createJobOpening, getCandidates, getJobOpenings } from '@/api/recruitment'
import { getDepartmentsList, getPositions } from '@/api/organization'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

type JobOpening = {
  id: number
  title: string
  headcount: number
  status: string
  department?: { name: string }
  position?: { name: string }
  _count?: { candidates: number }
}

type Candidate = {
  id: number
  name: string
  phone?: string
  email?: string
  status: string
  rating: number
  jobOpening?: { title: string }
}

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  open: { text: '招聘中', color: 'green' },
  paused: { text: '暂停', color: 'orange' },
  closed: { text: '已关闭', color: 'gray' },
  new: { text: '新候选人', color: 'blue' },
  screening: { text: '筛选中', color: 'cyan' },
  interviewing: { text: '面试中', color: 'orange' },
  offered: { text: '已发 Offer', color: 'purple' },
  hired: { text: '已录用', color: 'green' },
  rejected: { text: '已淘汰', color: 'red' },
}

function StatusTag({ value }: { value: string }) {
  const info = statusMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function RecruitmentOverviewPage() {
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [openingVisible, setOpeningVisible] = useState(false)
  const [candidateVisible, setCandidateVisible] = useState(false)
  const [openingForm] = Form.useForm()
  const [candidateForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [openingRes, candidateRes, departmentRes, positionRes]: any[] = await Promise.all([
        getJobOpenings({ page: 1, pageSize: 100 }),
        getCandidates({ page: 1, pageSize: 100 }),
        getDepartmentsList(),
        getPositions({ page: 1, pageSize: 100 }),
      ])
      setOpenings(openingRes?.data?.list || [])
      setCandidates(candidateRes?.data?.list || [])
      setDepartments(departmentRes?.data || [])
      setPositions(positionRes?.data?.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateOpening = async () => {
    const values = await openingForm.validate()
    await createJobOpening(values)
    Message.success('招聘职位已创建')
    setOpeningVisible(false)
    openingForm.resetFields()
    loadData()
  }

  const handleCreateCandidate = async () => {
    const values = await candidateForm.validate()
    await createCandidate(values)
    Message.success('候选人已创建')
    setCandidateVisible(false)
    candidateForm.resetFields()
    loadData()
  }

  const openingColumns: TableProps<JobOpening>['columns'] = [
    { title: '职位名称', dataIndex: 'title' },
    { title: '部门', width: 140, render: (_: any, record) => record.department?.name || '-' },
    { title: '岗位', width: 140, render: (_: any, record) => record.position?.name || '-' },
    { title: '招聘人数', dataIndex: 'headcount', width: 100 },
    { title: '候选人', width: 100, render: (_: any, record) => record._count?.candidates || 0 },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
  ]

  const candidateColumns: TableProps<Candidate>['columns'] = [
    { title: '姓名', dataIndex: 'name', width: 120 },
    { title: '应聘职位', render: (_: any, record) => record.jobOpening?.title || '-' },
    { title: '手机', dataIndex: 'phone', width: 140 },
    { title: '邮箱', dataIndex: 'email', width: 180 },
    { title: '评分', dataIndex: 'rating', width: 90 },
    { title: '状态', dataIndex: 'status', width: 120, render: (value) => <StatusTag value={value} /> },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>招聘管理</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>职位、候选人、面试、Offer</Tag>
          </div>
          <Space>
            <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
            <Button icon={<IconPlus />} onClick={() => setCandidateVisible(true)}>新增候选人</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => setOpeningVisible(true)}>新增职位</Button>
          </Space>
        </div>
        <Tabs defaultActiveTab="openings">
          <TabPane key="openings" title="招聘职位">
            <Table rowKey="id" loading={loading} columns={openingColumns} data={openings} pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane key="candidates" title="候选人">
            <Table rowKey="id" loading={loading} columns={candidateColumns} data={candidates} pagination={{ pageSize: 10 }} />
          </TabPane>
        </Tabs>
      </Card>

      <Modal title="新增招聘职位" visible={openingVisible} onOk={handleCreateOpening} onCancel={() => setOpeningVisible(false)} style={{ width: 620 }}>
        <Form form={openingForm} layout="vertical" initialValues={{ status: 'open', headcount: 1 }}>
          <FormItem label="职位名称" field="title" rules={[{ required: true, message: '请输入职位名称' }]}>
            <Input placeholder="例如：前端工程师" />
          </FormItem>
          <FormItem label="部门" field="departmentId" rules={[{ required: true, message: '请选择部门' }]}>
            <Select placeholder="请选择部门">
              {departments.map((department) => <Option key={department.id} value={department.id}>{department.name}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="岗位" field="positionId">
            <Select placeholder="请选择岗位" allowClear>
              {positions.map((position) => <Option key={position.id} value={position.id}>{position.name}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="招聘人数" field="headcount">
            <InputNumber min={1} max={999} style={{ width: '100%' }} />
          </FormItem>
          <FormItem label="职位描述" field="description"><Input.TextArea rows={3} /></FormItem>
          <FormItem label="任职要求" field="requirements"><Input.TextArea rows={3} /></FormItem>
        </Form>
      </Modal>

      <Modal title="新增候选人" visible={candidateVisible} onOk={handleCreateCandidate} onCancel={() => setCandidateVisible(false)} style={{ width: 620 }}>
        <Form form={candidateForm} layout="vertical" initialValues={{ status: 'new', rating: 0 }}>
          <FormItem label="应聘职位" field="jobOpeningId" rules={[{ required: true, message: '请选择应聘职位' }]}>
            <Select placeholder="请选择招聘职位">
              {openings.map((opening) => <Option key={opening.id} value={opening.id}>{opening.title}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="姓名" field="name" rules={[{ required: true, message: '请输入候选人姓名' }]}>
            <Input />
          </FormItem>
          <FormItem label="手机" field="phone"><Input /></FormItem>
          <FormItem label="邮箱" field="email"><Input /></FormItem>
          <FormItem label="来源" field="source"><Input placeholder="例如：BOSS直聘、内推、猎头" /></FormItem>
          <FormItem label="评分" field="rating"><InputNumber min={0} max={5} style={{ width: '100%' }} /></FormItem>
          <FormItem label="备注" field="note"><Input.TextArea rows={3} /></FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default RecruitmentOverviewPage
