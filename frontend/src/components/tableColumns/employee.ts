import type { ColumnProps } from '@arco-design/web-react/es/Table/interface'
import { RecordWithEmployee } from '@/types/common'

/**
 * 员工姓名列
 */
export function employeeColumn(): ColumnProps<RecordWithEmployee> {
  return {
    title: '员工',
    render: (_: unknown, record: RecordWithEmployee) => record.employee?.user?.realName || '-',
  }
}

/**
 * 部门列
 */
export function departmentColumn(): ColumnProps<RecordWithEmployee> {
  return {
    title: '部门',
    render: (_: unknown, record: RecordWithEmployee) => record.employee?.user?.department?.name || '-',
  }
}

/**
 * 员工姓名列（带工号）
 */
export function employeeWithNoColumn(): ColumnProps<RecordWithEmployee & { employee?: { employeeNo?: string } }> {
  return {
    title: '员工',
    render: (_: unknown, record: any) => {
      const name = record.employee?.user?.realName || '-'
      const no = record.employee?.employeeNo
      return no ? `${name}（${no}）` : name
    },
  }
}

/**
 * 扁平数据结构 - 员工姓名列
 */
export function flatEmployeeNameColumn(): ColumnProps<{ employeeName?: string }> {
  return {
    title: '申请人',
    dataIndex: 'employeeName',
    width: 100,
  }
}

/**
 * 扁平数据结构 - 工号列
 */
export function flatEmployeeNoColumn(): ColumnProps<{ employeeNo?: string }> {
  return {
    title: '工号',
    dataIndex: 'employeeNo',
    width: 100,
  }
}

/**
 * 扁平数据结构 - 部门列
 */
export function flatDepartmentNameColumn(): ColumnProps<{ departmentName?: string }> {
  return {
    title: '部门',
    dataIndex: 'departmentName',
    width: 100,
  }
}
