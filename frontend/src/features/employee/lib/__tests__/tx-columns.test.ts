import { buildTxColumns, TX_TYPE_TEXT, type TxKey, type TxColCtx } from '../tx-columns';

const ctx: TxColCtx = {
  empName: (id) => (id ? `员工${id}` : '-'),
  deptName: (id) => (id ? `部门${id}` : '-'),
  posName: (id) => (id ? `职位${id}` : '-'),
  fmtDate: (v) => (v ? `D:${v}` : '-'),
};

function cols(type: TxKey) {
  return buildTxColumns(type, ctx);
}

function renderAt(colsOut: ReturnType<typeof cols>, title: string, value: unknown) {
  const col = colsOut.find((c) => c.title === title);
  return col ? col.render!(value as any, {} as any, 0) : undefined;
}

describe('buildTxColumns - 各事务表格列定义（字段名与真实模型一致，杜绝空列）', () => {
  it('入职办理：不出现「员工」列（入职无员工关联），以「姓名」+ 部门/职位/入职日期呈现', () => {
    const c = cols('onboardings');
    const titles = c.map((x) => x.title);
    expect(titles).toEqual(['姓名', '部门', '职位', '入职日期']);
    expect(titles).not.toContain('员工');
    // 部门/职位按 ID 解析名称，而非不存在的 departmentName
    expect(c.find((x) => x.title === '部门')!.dataIndex).toBe('departmentId');
    expect(c.find((x) => x.title === '职位')!.dataIndex).toBe('positionId');
    expect(renderAt(c, '部门', 3)).toBe('部门3');
    expect(renderAt(c, '职位', 5)).toBe('职位5');
  });

  it('离职申请：员工 + 离职日期 + 原因（字段本正确）', () => {
    expect(cols('resignations').map((x) => x.title)).toEqual(['员工', '离职日期', '原因']);
    expect(cols('resignations').find((x) => x.title === '员工')!.dataIndex).toBe('employeeId');
  });

  it('转正申请：使用 probationStartDate/EndDate + performance，杜绝 regularDate/evaluation', () => {
    const c = cols('probations');
    expect(c.map((x) => x.title)).toEqual(['员工', '开始日期', '结束日期', '试用期评价']);
    expect(c.find((x) => x.title === '开始日期')!.dataIndex).toBe('probationStartDate');
    expect(c.find((x) => x.title === '结束日期')!.dataIndex).toBe('probationEndDate');
    expect(c.find((x) => x.title === '试用期评价')!.dataIndex).toBe('performance');
    expect(c.some((x) => x.dataIndex === 'regularDate')).toBe(false);
    expect(c.some((x) => x.dataIndex === 'evaluation')).toBe(false);
  });

  it('合同管理：类型字段为 type，映射英文枚举为中文；含合同编号与到期预警列', () => {
    const c = cols('contracts');
    expect(c.map((x) => x.title)).toEqual(['员工', '合同类型', '合同编号', '开始日期', '结束日期', '到期预警']);
    expect(c.find((x) => x.title === '合同类型')!.dataIndex).toBe('type');
    expect(renderAt(c, '合同类型', 'fixed_term')).toBe('固定期限');
    expect(renderAt(c, '合同类型', 'open_ended')).toBe('无固定期限');
    expect(renderAt(c, '合同类型', 'internship')).toBe('实习');
    expect(c.find((x) => x.title === '合同编号')!.dataIndex).toBe('contractNo');
    expect(c.find((x) => x.title === '到期预警')!.dataIndex).toBe('daysToExpire');
  });

  it('合同到期预警列：30 天内（expiringSoon）渲染红色 Tag，未到期返回「N 天后到期」文本', () => {
    const c = cols('contracts');
    const due = c.find((x) => x.title === '到期预警')!;
    const nodeText = (el: any): string => {
      if (el == null) return '';
      if (typeof el === 'string' || typeof el === 'number') return String(el);
      if (Array.isArray(el)) return el.map(nodeText).join('');
      return nodeText(el?.props?.children);
    };
    const soon = due.render!(null, { daysToExpire: 5, expiringSoon: true, status: 'active' }, 0) as any;
    // 红色预警渲染为 Tag 组件并携带到期文案
    expect(soon?.props?.color).toBe('red');
    expect(nodeText(soon?.props?.children)).toContain('5 天后到期');
    // 未到期（超过 30 天）返回普通文本节点
    const normal = due.render!(null, { daysToExpire: 120, expiringSoon: false, status: 'active' }, 0) as any;
    expect(nodeText(normal)).toContain('120 天后到期');
    // 无结束日期/已终止不预警
    const none = due.render!(null, { daysToExpire: null, status: 'terminated' }, 0) as any;
    expect(nodeText(none)).toContain('-');
  });

  it('考勤申诉：员工 + 申诉日期 + 类型(中文) + 原因', () => {
    const c = cols('attendance-appeals');
    expect(c.map((x) => x.title)).toEqual(['员工', '申诉日期', '类型', '原因']);
    expect(renderAt(c, '类型', 'late')).toBe('迟到');
    expect(renderAt(c, '类型', 'absent')).toBe('旷工');
  });

  it('员工证书：展示证书名称/发证机构/证书编号/签发/到期，而非证明申请的 certificateType/purpose', () => {
    const c = cols('certificates');
    expect(c.map((x) => x.title)).toEqual(['员工', '证书名称', '发证机构', '证书编号', '签发日期', '到期日期']);
    expect(c.find((x) => x.title === '证书名称')!.dataIndex).toBe('name');
    expect(c.find((x) => x.title === '发证机构')!.dataIndex).toBe('issuer');
    expect(c.find((x) => x.title === '证书编号')!.dataIndex).toBe('certNo');
    expect(c.some((x) => x.dataIndex === 'certificateType')).toBe(false);
    expect(c.some((x) => x.dataIndex === 'purpose')).toBe(false);
  });

  it('奖惩记录：类型为 type 枚举，reward/punishment 映射中文；含金额', () => {
    const c = cols('rewards');
    expect(renderAt(c, '类型', 'reward')).toBe('奖励');
    expect(renderAt(c, '类型', 'punishment')).toBe('惩罚');
    expect(c.find((x) => x.title === '类型')!.dataIndex).toBe('type');
    expect(c.some((x) => x.title === '金额')).toBe(true);
  });

  it('培训记录：培训名称为 title，杜绝 trainingName', () => {
    const c = cols('trainings');
    expect(c.find((x) => x.title === '培训名称')!.dataIndex).toBe('title');
    expect(c.some((x) => x.dataIndex === 'trainingName')).toBe(false);
  });

  it('调动记录：调动类型为 type 枚举，transfer/promotion 映射中文', () => {
    const c = cols('transfers');
    expect(c.find((x) => x.title === '调动类型')!.dataIndex).toBe('type');
    expect(renderAt(c, '调动类型', 'transfer')).toBe('部门调动');
    expect(renderAt(c, '调动类型', 'promotion')).toBe('晋升');
    expect(c.some((x) => x.dataIndex === 'transferType')).toBe(false);
  });

  it('TX_TYPE_TEXT 导出奖惩罚的中文标签，供类型列渲染', () => {
    expect(TX_TYPE_TEXT.rewardType).toMatchObject({ reward: '奖励', penalty: '惩罚', punishment: '惩罚' });
    expect(TX_TYPE_TEXT.transferType).toMatchObject({ transfer: '部门调动', promotion: '晋升', demotion: '降职' });
  });

  it('所有列的 dataIndex 不包含臆造字段名（避免再次出现空列）', () => {
    const banned = ['departmentName', 'positionName', 'regularDate', 'evaluation', 'contractType', 'rewardType', 'trainingName', 'transferType', 'certificateType', 'purpose'];
    for (const key of ['onboardings', 'probations', 'contracts', 'certificates', 'rewards', 'trainings', 'transfers'] as TxKey[]) {
      for (const col of cols(key)) {
        expect(banned).not.toContain(col.dataIndex);
      }
    }
  });
});