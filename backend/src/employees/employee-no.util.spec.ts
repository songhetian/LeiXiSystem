import { allocateEmployeeNo, formatEmployeeNo } from './employee-no.util';

/**
 * 用一个可编程的假 db 覆盖 allocateEmployeeNo 的分配流程，
 * 重点验证「序列初始化取值」与「跳过已占用号」两条修复逻辑。
 */
function createFakeDb(options: {
  existing?: { currentValue: number; step: number } | null;
  empNos?: string[];
  /** 依次吐出的序号（模拟每次 UPDATE+SELECT 的结果） */
  allocated: number[];
  /** 已被占用的工号集合 */
  taken?: string[];
}) {
  const createCalls: any[] = [];
  const findUniqueCalls: any[] = [];
  let cursor = 0;

  const db: any = {
    sequence: {
      findUnique: jest.fn().mockResolvedValue(options.existing ?? null),
      create: jest.fn(async (args: any) => {
        createCalls.push(args);
        return args.data;
      }),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue((options.empNos ?? []).map((no) => ({ employeeNo: no }))),
      findUnique: jest.fn(async (args: any) => {
        findUniqueCalls.push(args);
        return (options.taken ?? []).includes(args.where.employeeNo) ? { id: 1 } : null;
      }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn(async () => [{ next_val: options.allocated[cursor++] }]),
  };

  return { db, createCalls, findUniqueCalls };
}

describe('allocateEmployeeNo - 员工工号分配', () => {
  it('序列不存在时，以现有 EMP 工号的最大值初始化（而非最后一条记录）', async () => {
    const { db, createCalls } = createFakeDb({
      existing: null,
      // 故意让「最后一条记录」的工号小于最大值，模拟人工工号已跑到前面
      empNos: ['EMP0009', 'E001', 'EMP0003'],
      allocated: [10],
    });

    const no = await allocateEmployeeNo(db);

    expect(createCalls[0].data.currentValue).toBe(9);
    expect(no).toBe('EMP0010');
  });

  it('分配出的号已被占用时，继续向后取，直到取到空闲号', async () => {
    const { db, findUniqueCalls } = createFakeDb({
      existing: { currentValue: 10, step: 1 },
      allocated: [11, 12, 13],
      taken: ['EMP0011', 'EMP0012'],
    });

    const no = await allocateEmployeeNo(db);

    expect(no).toBe('EMP0013');
    expect(findUniqueCalls.map((c) => c.where.employeeNo)).toEqual([
      'EMP0011',
      'EMP0012',
      'EMP0013',
    ]);
  });

  it('正常路径：号段空闲时直接返回本次分配的工号', async () => {
    const { db } = createFakeDb({
      existing: { currentValue: 5, step: 1 },
      allocated: [6],
    });

    await expect(allocateEmployeeNo(db)).resolves.toBe('EMP0006');
  });

  it('formatEmployeeNo 补足 4 位', () => {
    expect(formatEmployeeNo(7)).toBe('EMP0007');
    expect(formatEmployeeNo(1234)).toBe('EMP1234');
  });
});