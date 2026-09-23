import type { ProTableColumn } from '@/components/ProTable';
import { Tag } from '@arco-design/web-react';

/** 员工事务页签 key */
export type TxKey =
  | 'onboardings'
  | 'resignations'
  | 'probations'
  | 'contracts'
  | 'attendance-appeals'
  | 'certificates'
  | 'rewards'
  | 'trainings'
  | 'transfers';

/** 各事务「类型」字段英文枚举 → 中文标签 */
export const TX_TYPE_TEXT: {
  contractType: Record<string, string>;
  rewardType: Record<string, string>;
  transferType: Record<string, string>;
  appealType: Record<string, string>;
} = {
  contractType: {
    fixed_term: '固定期限',
    open_ended: '无固定期限',
    probation: '试用期',
    internship: '实习',
  },
  rewardType: {
    reward: '奖励',
    punishment: '惩罚',
    penalty: '惩罚',
  },
  transferType: {
    transfer: '部门调动',
    promotion: '晋升',
    demotion: '降职',
    salary_adjust: '调薪',
    department: '部门调动',
    position: '岗位调动',
    other: '其他',
  },
  appealType: {
    miss_punch: '漏打卡',
    late: '迟到',
    early_leave: '早退',
    absent: '旷工',
    other: '其他',
  },
};

/** 列渲染依赖的名称解析上下文（由页面通过部门/岗位/员工引用数据构建） */
export interface TxColCtx {
  empName: (id: unknown) => string;
  deptName: (id: unknown) => string;
  posName: (id: unknown) => string;
  fmtDate: (v: unknown) => string;
}

/**
 * 按事务类型构建数据列。字段名对齐后端模型，避免臆造字段导致空列；
 * 类型字段统一映射为中文标签。状态/操作列由页面统一追加。
 */
export function buildTxColumns(type: TxKey, ctx: TxColCtx): ProTableColumn[] {
  const emp: ProTableColumn = {
    title: '员工',
    dataIndex: 'employeeId',
    width: 160,
    ellipsis: true,
    render: (v) => ctx.empName(v),
  };
  const date = (title: string, dataIndex: string): ProTableColumn => ({
    title,
    dataIndex,
    width: 120,
    render: (v) => ctx.fmtDate(v),
  });
  const text = (title: string, dataIndex: string, map?: Record<string, string>, width = 140): ProTableColumn => ({
    title,
    dataIndex,
    width,
    ellipsis: true,
    render: (v) => (map ? (map[v] ?? v ?? '-') : (v ?? '-')),
  });

  switch (type) {
    case 'onboardings':
      // 入职登记无员工关联，用姓名而非「员工」列
      return [
        { title: '姓名', dataIndex: 'name', width: 120 },
        { title: '部门', dataIndex: 'departmentId', width: 120, render: (v) => ctx.deptName(v) },
        { title: '职位', dataIndex: 'positionId', width: 120, render: (v) => ctx.posName(v) },
        date('入职日期', 'hireDate'),
      ];
    case 'resignations':
      return [emp, date('离职日期', 'resignDate'), text('原因', 'reason', undefined, 220)];
    case 'probations':
      return [
        emp,
        date('开始日期', 'probationStartDate'),
        date('结束日期', 'probationEndDate'),
        text('试用期评价', 'performance', undefined, 220),
      ];
    case 'contracts':
      return [
        emp,
        text('合同类型', 'type', TX_TYPE_TEXT.contractType),
        text('合同编号', 'contractNo', undefined, 140),
        date('开始日期', 'startDate'),
        date('结束日期', 'endDate'),
        {
          title: '到期预警',
          dataIndex: 'daysToExpire',
          width: 110,
          render: (_: any, row: any) => {
            const d = Number(row.daysToExpire);
            if (row.daysToExpire == null) return <span>-</span>;
            if (row.expiringSoon) {
              return (
                <Tag color="red" bordered>
                  {d} 天后到期
                </Tag>
              );
            }
            return <span>{d} 天后到期</span>;
          },
        },
      ];
    case 'attendance-appeals':
      return [
        emp,
        date('申诉日期', 'appealDate'),
        text('类型', 'appealType', TX_TYPE_TEXT.appealType),
        text('原因', 'reason', undefined, 220),
      ];
    case 'certificates':
      // 员工证书档案（EmployeeCertificate）：证书名称/发证机构/编号/日期
      return [
        emp,
        text('证书名称', 'name', undefined, 160),
        text('发证机构', 'issuer', undefined, 140),
        text('证书编号', 'certNo', undefined, 140),
        date('签发日期', 'issueDate'),
        date('到期日期', 'expireDate'),
      ];
    case 'rewards':
      return [
        emp,
        text('类型', 'type', TX_TYPE_TEXT.rewardType, 100),
        text('原因', 'reason', undefined, 200),
        text('金额', 'amount', undefined, 120),
      ];
    case 'trainings':
      return [
        emp,
        text('培训名称', 'title', undefined, 160),
        date('开始日期', 'startDate'),
        date('结束日期', 'endDate'),
      ];
    case 'transfers':
      return [
        emp,
        text('调动类型', 'type', TX_TYPE_TEXT.transferType),
        date('生效日期', 'effectiveDate'),
        text('原因', 'reason', undefined, 200),
      ];
    default:
      return [];
  }
}