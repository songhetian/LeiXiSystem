import { useState } from 'react'
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react'
import { IconUpload, IconDownload, IconSettings } from '@arco-design/web-react/icon'
import { post, get } from '@/api/request'
import { PageHeader } from '@/components'
import { getToday } from '@/utils/date'
import { toast } from '@/utils/toast'
import './index.css'

const FormItem = Form.Item
const { Text } = Typography

interface ModuleInfo {
  key: string
  name: string
  description: string
  itemCount?: number
}

const availableModules: ModuleInfo[] = [
  { key: 'departments', name: '部门信息', description: '导出部门树结构、负责人等信息', itemCount: 0 },
  { key: 'positions', name: '岗位信息', description: '导出岗位名称、编码、级别等信息', itemCount: 0 },
  { key: 'vacation_types', name: '假期类型', description: '导出假期类型定义、额度规则等', itemCount: 0 },
  { key: 'vacation_rules', name: '假期规则', description: '导出假期计算规则、结转规则等', itemCount: 0 },
  { key: 'attendance_rules', name: '考勤规则', description: '导出考勤异常规则、扣款规则等', itemCount: 0 },
  { key: 'payroll_components', name: '薪资组件', description: '导出薪资项目、计算规则等', itemCount: 0 },
  { key: 'schedule_templates', name: '排班模板', description: '导出班次模板、排班规则等', itemCount: 0 },
  { key: 'roles', name: '角色权限', description: '导出角色定义和权限配置', itemCount: 0 },
]

function ConfigExportImportPage() {
  const [selectedModules, setSelectedModules] = useState<string[]>(['departments', 'positions'])
  const [includeData, setIncludeData] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const [importResult, setImportResult] = useState<any[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [fileContent, setFileContent] = useState('')
  const [importConfig, setImportConfig] = useState<any>(null)

  const handleModuleChange = (checkedValues: string[]) => {
    setSelectedModules(checkedValues)
  }

  const handleExport = async () => {
    if (selectedModules.length === 0) {
      toast.warning('请至少选择一个模块')
      return
    }

    setExportLoading(true)
    try {
      const res = await post<any>('/config/export', {
        modules: selectedModules,
        includeData,
      })

      // 生成配置文件内容
      const configStr = JSON.stringify(res.data, null, 2)

      // 创建下载
      const blob = new Blob([configStr], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `leixi_config_${getToday()}.json`
      link.click()
      window.URL.revokeObjectURL(url)

      toast.success(`配置导出成功，共导出 ${selectedModules.length} 个模块`)
    } catch (e: any) {
      toast.error(e?.message || '导出失败')
    } finally {
      setExportLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const config = JSON.parse(content)

        if (!config.modules) {
          toast.error('无效的配置文件')
          return
        }

        setFileContent(content)
        setImportConfig(config)
        setImportVisible(true)
        setCurrentStep(1)

        // 显示预览信息
        const moduleCount = Object.keys(config.modules).length
        const exportTime = config.exportTime ? new Date(config.exportTime).toLocaleString() : '未知'
        toast.info(`配置文件版本: ${config.version || '1.0'}, 导出时间: ${exportTime}, 包含 ${moduleCount} 个模块`)
      } catch (err) {
        toast.error('配置文件解析失败')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importConfig) {
      toast.error('请先选择配置文件')
      return
    }

    setImportLoading(true)
    try {
      const res = await post<any>('/config/import', {
        config: importConfig,
        mode: 'merge',
      })

      setImportResult(res.data || [])
      setCurrentStep(2)

      const successCount = res.data?.filter((r: any) => r.success)?.length || 0
      toast.success(`导入完成，成功 ${successCount} 个模块`)
    } catch (e: any) {
      toast.error(e?.message || '导入失败')
    } finally {
      setImportLoading(false)
    }
  }

  const handleReset = () => {
    setImportVisible(false)
    setImportResult([])
    setCurrentStep(0)
    setFileContent('')
    setImportConfig(null)
  }

  const columns = [
    { title: '模块', dataIndex: 'module', render: (v: string) => availableModules.find(m => m.key === v)?.name || v },
    { title: '状态', dataIndex: 'success', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '成功' : '失败'}</Tag> },
    { title: '导入数量', dataIndex: 'imported', render: (v: number) => v || '-' },
    { title: '错误信息', dataIndex: 'error', render: (v: string) => v || '-' },
  ]

  return (
    <div className="config-export-import">
      <Card bordered={false}>
        <PageHeader
          title="系统配置"
          description="导出和导入系统配置，支持备份和快速部署。"
        />
      </Card>

      <Card bordered={false}>
        <Space direction="vertical" size="large" className="config-export-import__space-full">
          <div>
            <Text bold className="config-export-import__section-title">导出配置</Text>
            <Text type="secondary" className="config-export-import__section-subtitle">选择要导出的系统模块</Text>
          </div>

          <Checkbox.Group value={selectedModules} onChange={handleModuleChange as any}>
            <Space direction="vertical">
              <Space>
                {availableModules.slice(0, 4).map((module) => (
                  <Checkbox key={module.key} value={module.key}>
                    <Space>
                      <IconSettings />
                      <span>{module.name}</span>
                    </Space>
                  </Checkbox>
                ))}
              </Space>
              <Space>
                {availableModules.slice(4).map((module) => (
                  <Checkbox key={module.key} value={module.key}>
                    <Space>
                      <IconSettings />
                      <span>{module.name}</span>
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Space>
          </Checkbox.Group>

          <Checkbox checked={includeData} onChange={setIncludeData as any}>
            包含关联数据（如部门员工数量等统计信息）
          </Checkbox>

          <Space>
            <Button
              type="primary"
              icon={<IconDownload />}
              loading={exportLoading}
              onClick={handleExport}
              disabled={selectedModules.length === 0}
            >
              导出配置
            </Button>
            <Button icon={<IconUpload />} onClick={() => document.getElementById('import-file')?.click()}>
              导入配置
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </Space>
        </Space>
      </Card>

      <Card bordered={false}>
        <Text bold className="config-export-import__section-title">配置说明</Text>
        <Descriptions
          column={2}
          className="config-export-import__descriptions-mt"
          data={[
            { label: '导出格式', value: 'JSON 文件' },
            { label: '配置文件版本', value: '1.0' },
            { label: '支持导入模式', value: '合并模式（merge）' },
            { label: '权限要求', value: 'system:config' },
          ]}
        />
      </Card>

      {/* 导入弹窗 */}
      <Modal
        title="导入配置"
        visible={importVisible}
        onCancel={handleReset}
        footer={currentStep === 2 ? (
          <Button type="primary" onClick={handleReset}>完成</Button>
        ) : (
          <Space>
            <Button onClick={handleReset}>取消</Button>
            <Button type="primary" loading={importLoading} onClick={handleImport}>
              开始导入
            </Button>
          </Space>
        )}
        width={700}
      >
        <Steps current={currentStep} className="config-export-import__steps-mb">
          <Steps.Step title="选择文件" />
          <Steps.Step title="确认预览" />
          <Steps.Step title="导入结果" />
        </Steps>

        {currentStep === 1 && importConfig && (
          <Space direction="vertical" className="config-export-import__space-full">
            <Descriptions
              column={2}
              data={[
                { label: '版本', value: importConfig.version || '1.0' },
                { label: '导出时间', value: importConfig.exportTime ? new Date(importConfig.exportTime).toLocaleString() : '未知' },
              ]}
            />

            <Text bold>包含的模块：</Text>
            <Space wrap>
              {Object.keys(importConfig.modules || {}).map((key) => {
                const module = availableModules.find(m => m.key === key)
                return <Tag key={key} color="arcoblue">{module?.name || key}</Tag>
              })}
            </Space>

            <Text type="secondary">
              导入模式为合并模式（merge），已存在的配置将更新，不存在的将新增。
            </Text>
          </Space>
        )}

        {currentStep === 2 && (
          <Table
            data={importResult}
            columns={columns}
            pagination={false}
            rowKey="module"
          />
        )}
      </Modal>
    </div>
  )
}

export default ConfigExportImportPage
