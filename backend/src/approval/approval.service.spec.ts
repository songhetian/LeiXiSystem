import { ApprovalService } from './approval.service';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';

/**
 * 待办中心（listTodos）测试。
 *
 * 背景：审批组（type=group）节点同样允许审批（见 canUserApprove），
 * 因此待办列表也必须把用户所属审批组挂载的节点纳入查询。
 */
describe('ApprovalService', () => {
  let service: ApprovalService;
  let prisma: any;

  // 简化版「节点表」，按传入的 where 条件筛选，模拟数据库行为
  const allNodes = [
    { id: 50, type: 'group', approvalGroupId: 7, roleCode: null, userId: null },
    { id: 60, type: 'role', roleCode: 'manager', approvalGroupId: null, userId: null },
    // 指定人员节点：审批人写在节点上，与角色/审批组无关
    { id: 70, type: 'user', approvalGroupId: null, roleCode: null, userId: 8 },
  ];

  function nodeMatches(node: any, cond: any): boolean {
    if (cond.type && node.type !== cond.type) return false;
    if (cond.roleCode && !cond.roleCode.in.includes(node.roleCode)) return false;
    if (cond.approvalGroupId && !cond.approvalGroupId.in.includes(node.approvalGroupId)) return false;
    if (cond.userId !== undefined && node.userId !== cond.userId) return false;
    return true;
  }

  beforeEach(() => {
    prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      approvalGroupMember: { findMany: jest.fn().mockResolvedValue([]) },
      approvalWorkflowNode: {
        findMany: jest.fn().mockImplementation(async (args: any) => {
          const where = args?.where ?? {};
          if (Array.isArray(where.OR)) {
            return allNodes.filter((n) => where.OR.some((c: any) => nodeMatches(n, c)));
          }
          return allNodes.filter((n) => nodeMatches(n, where));
        }),
      },
      approvalRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      department: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    service = new ApprovalService(prisma, {} as any, {} as any, { isEnabled: false } as any);
    jest.clearAllMocks();
  });

  /**
   * 取「待办查询」这一次 approvalRecord.findMany 的 where。
   * listTodos 前置还有一次「取本人被显式指派的待办节点」查询（无 nodeId/OR 条件），
   * 不能再用 calls[0] 取待办查询。
   */
  function todoQueryWhere(): any {
    const call = prisma.approvalRecord.findMany.mock.calls.find(
      (c: any[]) => c[0]?.where?.nodeId || c[0]?.where?.OR,
    );
    return call[0].where;
  }

  describe('listTodos - 待办中心', () => {
    it('用户角色为空但属于审批组时，应收集该组挂载的 group 节点', async () => {
      // 没有任何角色
      prisma.userRole.findMany.mockResolvedValue([]);
      // 属于审批组 7
      prisma.approvalGroupMember.findMany.mockResolvedValue([{ groupId: 7 }]);

      await service.listTodos(5, { page: 1, pageSize: 10 });

      const where = todoQueryWhere();
      expect(where.nodeId.in).toContain(50);
    });

    it('role 节点照旧能被取出（回归）', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ role: { code: 'manager' } }]);
      prisma.approvalGroupMember.findMany.mockResolvedValue([]);

      await service.listTodos(5, { page: 1, pageSize: 10 });

      const where = todoQueryWhere();
      expect(where.nodeId.in).toContain(60);
    });

    it('指定人员节点只出现在被指定人的待办里', async () => {
      const nodeIdsInWhere = (where: any): number[] =>
        where.nodeId?.in ?? (where.OR ?? []).flatMap((c: any) => c.nodeId?.in ?? []);

      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.approvalGroupMember.findMany.mockResolvedValue([]);

      // userId=8 是节点上指定的人
      await service.listTodos(8, { page: 1, pageSize: 10 });
      expect(nodeIdsInWhere(todoQueryWhere())).toContain(70);

      jest.clearAllMocks();
      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.approvalGroupMember.findMany.mockResolvedValue([]);

      // 其他人即使有角色 / 在审批组里，也不能看到该节点的待办
      await service.listTodos(5, { page: 1, pageSize: 10 });
      expect(nodeIdsInWhere(todoQueryWhere())).not.toContain(70);
    });
  });

  describe('canUserApprove - 指定人员节点', () => {
    it('只有节点上指定的 userId 本人可审批', async () => {
      prisma.approvalWorkflowNode.findUnique = jest.fn().mockResolvedValue({
        type: 'user',
        userId: 8,
        roleCode: null,
        approvalGroupId: null,
      });
      const canApprove = (userId: number) =>
        (service as any).canUserApprove(userId, 'n1', 3, {});

      await expect(canApprove(8)).resolves.toBe(true);
      await expect(canApprove(9)).resolves.toBe(false);
    });

    it('节点未配置 userId 时一律拒绝（fail-closed）', async () => {
      prisma.approvalWorkflowNode.findUnique = jest.fn().mockResolvedValue({
        type: 'user',
        userId: null,
        roleCode: null,
        approvalGroupId: null,
      });
      await expect((service as any).canUserApprove(8, 'n1', 3, {})).resolves.toBe(false);
    });
  });

  /**
   * 建实例时会把审批链上每个节点的 record 一次性写成 pending，因此
   * 「节点审批人」与「当前待办人」并不等价：后置节点（如主管未审时的 HR）
   * 若也按 nodeId 命中，就会在别人的轮次里提前看到待办，点「同意」又被
   * handleApproval 的 currentNodeKey 校验挡回 403。
   */
  describe('listTodos - 只返回实例当前节点的待办', () => {
    it('每个待办分支都必须把实例当前节点收敛到本分支的节点集合', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ role: { code: 'manager' } }]);
      prisma.approvalGroupMember.findMany.mockResolvedValue([]);

      await service.listTodos(5, { page: 1, pageSize: 10 });

      const where = todoQueryWhere();
      const clauses: any[] = where.OR ?? [where];
      for (const c of clauses) {
        expect(c.instance?.currentNodeKey?.in).toBeDefined();
      }
      // role 分支：节点 60 无 nodeKey，回落为 String(id)
      const roleClause = clauses.find((c) => c.nodeId.in.includes(60));
      expect(roleClause.instance.currentNodeKey.in).toEqual(['60']);
    });
  });

  /**
   * 「待审批：xxx」通知指向审批实例；实例被处理/撤回后若不清理，
   * 审批人点开通知会落到一个已取消或已处理的单据上。
   */
  describe('待审批通知的生命周期', () => {
    let notification: { create: jest.Mock; removeByRelated: jest.Mock };

    beforeEach(() => {
      notification = {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        removeByRelated: jest.fn().mockResolvedValue({ count: 1 }),
      };
    });

    it('撤回后清理该实例的待审批通知', async () => {
      prisma.approvalInstance = {
        // 第 1 次读取是 CAS 前的快照（pending），第 2 次是 CAS 写回后的重查
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 9, status: 'pending', applicantId: 5, workflowId: 3 })
          .mockResolvedValue({ id: 9, status: 'cancelled', applicantId: 5, workflowId: 3 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      };
      prisma.approvalWorkflow = { findUnique: jest.fn().mockResolvedValue({ code: 'leave', module: 'attendance' }) };
      service = new ApprovalService(
        prisma,
        notification as any,
        { emit: jest.fn() } as any,
        { isEnabled: false } as any,
      );

      await service.withdraw({ instanceId: 9, userId: 5 });

      expect(notification.removeByRelated).toHaveBeenCalledWith('approval_instance', 9);
    });

    it('驳回后清理该实例的待审批通知，并继续通知申请人', async () => {
      const instance = {
        id: 9,
        status: 'pending',
        title: '请假申请',
        applicantId: 5,
        workflowId: 3,
        ccEmployeeIds: null,
        currentNodeKey: 'n1',
        records: [{ id: 101, order: 1, nodeKey: 'n1', status: 'pending', approverId: 5 }],
      };
      const tx = {
        approvalInstance: {
          // 第 1 次读取是事务内的 pending 快照，第 2 次是 CAS 写回后的重查
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(instance)
            .mockResolvedValue({
              ...instance,
              status: 'rejected',
              currentNodeKey: null,
              currentNodeName: null,
            }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        approvalRecord: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn() },
      };
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 5, realName: '张三' }) };
      // 当前记录 approverId 即本人，节点查询返回 null 也不影响审批权限判定
      prisma.approvalWorkflowNode.findUnique = jest.fn().mockResolvedValue(null);
      prisma.$transaction = jest.fn().mockImplementation(async (cb: any) => cb(tx));
      prisma.approvalWorkflow = { findUnique: jest.fn().mockResolvedValue({ code: 'leave', module: 'attendance' }) };
      service = new ApprovalService(
        prisma,
        notification as any,
        { emit: jest.fn() } as any,
        { isEnabled: false } as any,
      );

      await service.reject({ instanceId: 9, userId: 5, userName: '张三', comment: '材料不全' });

      expect(notification.removeByRelated).toHaveBeenCalledWith('approval_instance', 9);
      expect(notification.create).toHaveBeenCalled();
    });
  });

  /**
   * 转交（transfer）：把当前待审批节点改派给别人。
   * 原实现只改了 approval_record.approverId，既不清掉原审批人的「待审批」通知，
   * 也不给被转交人发通知 —— 被转交人完全无感，事项被静默搁置。
   */
  describe('审批转交（transfer）', () => {
    it('转交后清理原待审批通知，并给被转交人发新通知', async () => {
      const notification = {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        removeByRelated: jest.fn().mockResolvedValue({ count: 1 }),
      };
      prisma.approvalInstance = {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          status: 'pending',
          title: '请假申请',
          workflowId: 3,
          departmentId: 42,
          applicantId: 5,
          currentNodeKey: 'n1',
          records: [{ id: 101, order: 1, nodeKey: 'n1', status: 'pending', approverId: 5 }],
        }),
      };
      prisma.approvalWorkflowNode = { findUnique: jest.fn().mockResolvedValue(null) };
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 8, realName: '李四' }) };
      prisma.approvalRecord = { update: jest.fn().mockResolvedValue({ id: 101, approverId: 8 }) };
      service = new ApprovalService(
        prisma,
        notification as any,
        { emit: jest.fn() } as any,
        { isEnabled: false } as any,
      );

      await service.transfer({ instanceId: 9, userId: 5, targetUserId: 8, comment: '请代审' });

      expect(notification.removeByRelated).toHaveBeenCalledWith('approval_instance', 9);
      expect(notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 8,
          relatedId: 9,
          relatedType: 'approval_instance',
        }),
      );
    });
  });

  /**
   * 审批节点类型「部门主管」（department_manager）与「申请人」（initiator）必须真正生效。
   *
   * 前端流程配置页（features/approval/pages/settings.tsx）同时提供这两种节点类型，
   * 但后端仅把类型存进 approval_workflow_nodes 表，鉴权（canUserApprove）、
   * 待审批通知（notifyApproversForNode）、待办列表（listTodos）三处只认 role/group：
   *   - department_manager：节点被写入审批链，但无人能审批（approverId 始终为 null），
   *     负责人也收不到任何通知与待办 → 审批实例永久卡在 pending；
   *   - initiator：routing-engine 无此类型分支，节点在 buildApprovalChain 中被静默丢弃，
   *     申请人确认环节直接消失。
   */
  describe('节点类型 department_manager / initiator 应真正生效', () => {
    function buildService(notification: any) {
      return new ApprovalService(
        prisma,
        notification as any,
        { emit: jest.fn() } as any,
        { isEnabled: false } as any,
      );
    }

    function mockTransaction(instance: any, nextStatus: string) {
      const tx = {
        approvalInstance: {
          // 第 1 次读取是事务内的 pending 快照，第 2 次是 CAS 写回后的重查
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(instance)
            .mockResolvedValue({
              ...instance,
              status: nextStatus,
              currentNodeKey: null,
              currentNodeName: null,
            }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        approvalRecord: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn(),
        },
      };
      prisma.$transaction = jest.fn().mockImplementation(async (cb: any) => cb(tx));
    }

    it('部门主管节点：申请部门的负责人应能审批', async () => {
      const instance = {
        id: 9,
        status: 'pending',
        title: '请假申请',
        applicantId: 5,
        workflowId: 3,
        departmentId: 42,
        ccEmployeeIds: null,
        currentNodeKey: 'dm',
        records: [{ id: 101, order: 1, nodeKey: 'dm', status: 'pending', approverId: null }],
      };
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 7, realName: '主管' }) };
      prisma.approvalWorkflowNode.findUnique = jest.fn().mockResolvedValue({
        id: 11,
        type: 'department_manager',
        roleCode: null,
        approvalGroupId: null,
      });
      prisma.department = { findUnique: jest.fn().mockResolvedValue({ manager: { userId: 7 } }) };
      prisma.approvalWorkflow = {
        findUnique: jest.fn().mockResolvedValue({ code: 'leave', module: 'attendance' }),
      };
      mockTransaction(instance, 'approved');
      service = buildService({
        create: jest.fn().mockResolvedValue({ id: 1 }),
        removeByRelated: jest.fn().mockResolvedValue({ count: 1 }),
      });

      await expect(
        service.approve({ instanceId: 9, userId: 7, userName: '主管' }),
      ).resolves.toMatchObject({ status: 'approved' });
    });

    it('部门主管节点：用户是申请部门负责人时应出现在待办列表', async () => {
      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.approvalGroupMember.findMany.mockResolvedValue([]);
      prisma.department = { findMany: jest.fn().mockResolvedValue([{ id: 42 }]) };
      prisma.approvalWorkflowNode.findMany = jest.fn().mockResolvedValue([
        { id: 77, type: 'department_manager', roleCode: null, approvalGroupId: null },
      ]);
      service = buildService({ create: jest.fn(), removeByRelated: jest.fn() });

      await service.listTodos(7, { page: 1, pageSize: 10 });

      const where = todoQueryWhere();
      const clauses: any[] = where.OR ?? [where];
      const dmClause = clauses.find((c) => c.nodeId?.in?.includes(77));
      expect(dmClause).toBeDefined();
      expect(dmClause.instance.departmentId.in).toContain(42);
    });

    it('部门主管节点：实例创建后应给部门负责人发待审批通知', async () => {
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 5, realName: '申请人' }) };
      prisma.approvalWorkflowNode.findUnique = jest.fn().mockResolvedValue({
        id: 11,
        type: 'department_manager',
        roleCode: null,
        approvalGroupId: null,
      });
      prisma.department = {
        findMany: jest.fn().mockResolvedValue([{ id: 42, manager: { userId: 7 } }]),
        findUnique: jest.fn().mockResolvedValue({ manager: { userId: 7 } }),
      };
      prisma.approvalWorkflow = {
        findUnique: jest.fn().mockResolvedValue({
          id: 3,
          code: 'leave',
          status: 'active',
          nodes: [
            {
              id: 11,
              nodeKey: 'dm',
              name: '主管审批',
              type: 'department_manager',
              roleCode: null,
              approvalGroupId: null,
              order: 1,
            },
          ],
        }),
      };
      prisma.$transaction = jest.fn().mockImplementation(async (cb: any) =>
        cb({
          approvalInstance: {
            create: jest.fn().mockResolvedValue({
              id: 9,
              title: '请假申请',
              applicantId: 5,
              workflowId: 3,
              status: 'pending',
              records: [{ id: 101, order: 1, nodeKey: 'dm', status: 'pending' }],
            }),
          },
        }),
      );
      const notification = {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        removeByRelated: jest.fn(),
      };
      service = buildService(notification);

      await service.startInstance({
        workflowCode: 'leave',
        title: '请假申请',
        userId: 5,
        userName: '申请人',
        departmentId: 42,
      });

      expect(notification.createMany).toHaveBeenCalledWith([7], expect.any(Object));
    });

    it('申请人节点：申请人本人应能审批该确认节点', async () => {
      const instance = {
        id: 9,
        status: 'pending',
        title: '请假申请',
        applicantId: 5,
        workflowId: 3,
        departmentId: 42,
        ccEmployeeIds: null,
        currentNodeKey: 'me',
        records: [{ id: 102, order: 1, nodeKey: 'me', status: 'pending', approverId: null }],
      };
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 5, realName: '张三' }) };
      prisma.approvalWorkflowNode.findUnique = jest.fn().mockResolvedValue({
        id: 12,
        type: 'initiator',
        roleCode: null,
        approvalGroupId: null,
      });
      prisma.approvalWorkflow = {
        findUnique: jest.fn().mockResolvedValue({ code: 'leave', module: 'attendance' }),
      };
      mockTransaction(instance, 'approved');
      service = buildService({
        create: jest.fn().mockResolvedValue({ id: 1 }),
        removeByRelated: jest.fn().mockResolvedValue({ count: 1 }),
      });

      await expect(
        service.approve({ instanceId: 9, userId: 5, userName: '张三' }),
      ).resolves.toMatchObject({ status: 'approved' });
    });
  });

  /**
   * 错误码语义归位。
   *
   * 全局异常过滤器 all-exceptions.filter.ts L52-58 会用 error-messages.ts 的中央文案
   * **覆盖**抛出时的 message，因此错误码一旦语义错配，用户看到的就是张冠李戴的提示：
   *   - 「审批实例不存在」写成 6301（=审批流编码已存在）→ 提示「审批流编码已存在」；
   *   - 「审批流有关联实例不可删」写成 6311（=审批实例不存在）→ 提示「审批实例不存在」；
   *   - 「重提次数超限」写成 6312（=审批实例状态无效）→ 提示「审批实例状态无效」。
   */
  describe('错误码语义归位（中央文案覆盖后仍提示正确语义）', () => {
    function buildService() {
      return new ApprovalService(
        prisma,
        { create: jest.fn(), removeByRelated: jest.fn() } as any,
        { emit: jest.fn() } as any,
        { isEnabled: false } as any,
      );
    }

    function payloadOf(e: any) {
      return e?.getResponse?.() ?? e?.response ?? e;
    }

    it('resubmit：实例不存在应返回 6311「审批实例不存在」，而非 6301「审批流编码已存在」', async () => {
      prisma.approvalInstance = { findUnique: jest.fn().mockResolvedValue(null) };

      const err = await buildService().resubmit({ instanceId: 9, userId: 5 }).catch((e) => e);
      const payload = payloadOf(err);

      expect(payload.code).toBe(ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND);
      expect(messageOf(payload.code)).toBe('审批实例不存在');
    });

    it('transfer：实例不存在应返回 6311，而非 6301', async () => {
      prisma.approvalInstance = { findUnique: jest.fn().mockResolvedValue(null) };

      const err = await buildService()
        .transfer({ instanceId: 9, userId: 5, targetUserId: 8 })
        .catch((e) => e);

      expect(payloadOf(err).code).toBe(ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND);
      expect(messageOf(payloadOf(err).code)).toBe('审批实例不存在');
    });

    it('addSign：实例不存在应返回 6311，而非 6301', async () => {
      prisma.approvalInstance = { findUnique: jest.fn().mockResolvedValue(null) };

      const err = await buildService()
        .addSign({ instanceId: 9, userId: 5, targetUserId: 8, position: 'after' })
        .catch((e) => e);

      expect(payloadOf(err).code).toBe(ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND);
      expect(messageOf(payloadOf(err).code)).toBe('审批实例不存在');
    });

    it('withdraw：实例不存在应返回 6311，而非未注册的 6305', async () => {
      prisma.approvalInstance = { findUnique: jest.fn().mockResolvedValue(null) };

      const err = await buildService().withdraw({ instanceId: 9, userId: 5 }).catch((e) => e);

      expect(payloadOf(err).code).toBe(ERROR_CODES.APPROVAL_INSTANCE_NOT_FOUND);
      expect(messageOf(payloadOf(err).code)).toBe('审批实例不存在');
    });

    it('deleteWorkflow：审批流有关联实例时应返回 6302，而非 6311「审批实例不存在」', async () => {
      prisma.approvalWorkflow = {
        findUnique: jest.fn().mockResolvedValue({ id: 3, code: 'WF1', deletedAt: null }),
      };
      prisma.approvalInstance = { count: jest.fn().mockResolvedValue(2) };

      const err = await buildService().deleteWorkflow(3).catch((e) => e);
      const payload = payloadOf(err);

      expect(payload.code).toBe(ERROR_CODES.APPROVAL_WORKFLOW_IN_USE);
      expect(messageOf(payload.code)).toBe('该审批流已有关联的审批实例，无法删除');
    });

    it('resubmit：重提次数达上限应返回 6305，而非 6312「审批实例状态无效」', async () => {
      prisma.approvalInstance = {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          status: 'rejected',
          applicantId: 5,
          resubmitCount: 3,
          workflow: { maxResubmits: 3, nodes: [] },
        }),
      };

      const err = await buildService().resubmit({ instanceId: 9, userId: 5 }).catch((e) => e);
      const payload = payloadOf(err);

      expect(payload.code).toBe(ERROR_CODES.APPROVAL_RESUBMIT_LIMIT);
      expect(messageOf(payload.code)).toBe('重新提交次数已达上限');
    });
  });

  /**
   * 审批详情鉴权：建实例时 approval_record 不带 approverId
   * （approverId 只在「加签 / 转交 / 实际处理」时写入，是审计字段而非路由字段），
   * 因此 `records.some(r => r.approverId === userId)` 会把角色型 / 审批组型审批人
   * 一律判成「非审批人」：审批人点开自己的待办详情直接 403。
   */
  describe('getInstanceDetail - 审批人鉴权按节点语义判定', () => {
    const instance = {
      id: 9,
      status: 'pending',
      title: '请假申请',
      applicantId: 5,
      applicantName: '张三',
      workflowId: 3,
      departmentId: 42,
      currentNodeKey: 'n1',
      ccEmployeeIds: null,
      // 建实例时写入的 pending 记录不带 approverId
      records: [{ id: 101, order: 1, nodeKey: 'n1', status: 'pending', approverId: null }],
    };

    it('角色型审批人（记录无 approverId）应能查看详情', async () => {
      prisma.approvalInstance = { findUnique: jest.fn().mockResolvedValue(instance) };
      prisma.userRole = { findMany: jest.fn().mockResolvedValue([{ role: { code: 'manager' } }]) };
      prisma.approvalWorkflowNode = {
        findUnique: jest.fn().mockResolvedValue({ id: 60, type: 'role', roleCode: 'manager' }),
      };

      await expect(service.getInstanceDetail(9, 7)).resolves.toMatchObject({ id: 9 });
    });

    it('审批组成员（记录无 approverId）应能查看详情', async () => {
      prisma.approvalInstance = { findUnique: jest.fn().mockResolvedValue(instance) };
      prisma.userRole = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.approvalWorkflowNode = {
        findUnique: jest.fn().mockResolvedValue({ id: 61, type: 'group', approvalGroupId: 7 }),
      };
      prisma.approvalGroupMember = {
        findUnique: jest.fn().mockResolvedValue({ groupId: 7, userId: 8 }),
      };

      await expect(service.getInstanceDetail(9, 8)).resolves.toMatchObject({ id: 9 });
    });

    it('与审批无关的普通用户仍被拒绝（回归保护）', async () => {
      prisma.approvalInstance = { findUnique: jest.fn().mockResolvedValue(instance) };
      prisma.userRole = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.approvalWorkflowNode = { findUnique: jest.fn().mockResolvedValue(null) };
      prisma.approvalGroupMember = { findUnique: jest.fn().mockResolvedValue(null) };

      const err = await service.getInstanceDetail(9, 99).catch((e) => e);
      const payload = err?.getResponse?.() ?? err?.response ?? err;

      expect(payload.code).toBe(ERROR_CODES.DATA_NO_PERMISSION);
    });
  });

  /**
   * 首页「待审批」徽标必须与待办列表同口径：旧实现用
   * count(approverId = userId)，而建实例写入的记录 approverId 恒为 null
   * → 角色型/审批组型/部门主管型节点的审批人计数恒为 0，徽标长期不显示。
   */
  describe('countPendingTodos - 与待办列表同口径', () => {
    it('角色型审批人应有非零待办计数', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ role: { code: 'manager' } }]);
      prisma.approvalGroupMember.findMany.mockResolvedValue([]);
      prisma.department.findMany.mockResolvedValue([]);
      prisma.approvalRecord.count.mockResolvedValue(3);

      await expect(service.countPendingTodos(5)).resolves.toBe(3);

      const where = prisma.approvalRecord.count.mock.calls[0][0].where;
      expect(where.instance.status).toBe('pending');
      const clauses: any[] = where.OR ?? [where];
      const roleClause = clauses.find((c) => c.nodeId?.in?.includes(60));
      expect(roleClause).toBeDefined();
      expect(roleClause.instance.currentNodeKey.in).toEqual(['60']);
    });
  });

  /**
   * 加签（addSign）：新记录带显式 approverId，但既不发通知，也不在 listTodos
   * 的 nodeId/nodeKey 分支里（加签 nodeKey 不在审批流节点表中）→ 被加签人
   * 待办列表里看不到、通知里收不到，事项永久搁置。
   */
  describe('加签（addSign）- 被加签人必须收到通知并出现在待办中', () => {
    function buildAddSignMocks() {
      prisma.approvalInstance = {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          status: 'pending',
          title: '请假申请',
          workflowId: 3,
          departmentId: 42,
          applicantId: 5,
          currentNodeKey: 'n1',
          currentNodeName: '主管审批',
          records: [
            {
              id: 101,
              nodeId: 60,
              order: 1,
              nodeKey: 'n1',
              nodeName: '主管审批',
              status: 'pending',
              approverId: null,
            },
          ],
        }),
      };
      prisma.userRole = { findMany: jest.fn().mockResolvedValue([{ role: { code: 'manager' } }]) };
      prisma.approvalWorkflowNode = {
        findUnique: jest.fn().mockResolvedValue({ id: 60, type: 'role', roleCode: 'manager' }),
      };
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 8, realName: '李四' }) };
      const created = {
        id: 102,
        nodeId: 60,
        nodeKey: 'n1_addsign_1700000000000',
        nodeName: '主管审批（加签）',
        order: 0.5,
        status: 'pending',
        approverId: 8,
      };
      prisma.$transaction = jest.fn().mockImplementation(async (cb: any) =>
        cb({
          approvalRecord: { create: jest.fn().mockResolvedValue(created) },
          approvalInstance: {
            update: jest.fn().mockResolvedValue({ id: 9, status: 'pending', currentNodeKey: created.nodeKey }),
          },
        }),
      );
      return created;
    }

    it('前加签后必须给被加签人发待审批通知', async () => {
      buildAddSignMocks();
      const notification = {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        removeByRelated: jest.fn().mockResolvedValue({ count: 1 }),
      };
      service = new ApprovalService(
        prisma,
        notification as any,
        { emit: jest.fn() } as any,
        { isEnabled: false } as any,
      );

      await service.addSign({ instanceId: 9, userId: 5, targetUserId: 8, position: 'before' });

      expect(notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 8, relatedId: 9, relatedType: 'approval_instance' }),
      );
    });

    it('被加签人（nodeKey 不在审批流节点表中）必须出现在待办查询里', async () => {
      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.approvalGroupMember.findMany.mockResolvedValue([]);
      prisma.department.findMany.mockResolvedValue([]);
      // 第一次 findMany：取本人被显式指派的待办节点；后续（待办列表）返回空
      prisma.approvalRecord.findMany.mockResolvedValueOnce([
        { nodeKey: 'n1_addsign_1700000000000' },
      ]);

      await service.listTodos(8, { page: 1, pageSize: 10 });

      const where = todoQueryWhere();
      const clauses: any[] = where.OR ?? [where];
      const assignedClause = clauses.find((c) =>
        c.nodeKey?.in?.includes('n1_addsign_1700000000000'),
      );
      expect(assignedClause).toBeDefined();
      expect(assignedClause.instance.currentNodeKey.in).toEqual(['n1_addsign_1700000000000']);
    });

    it('后加签轮到被加签人时必须补发待审批通知（节点表无此 nodeKey）', async () => {
      const instance = {
        id: 9,
        status: 'pending',
        title: '请假申请',
        applicantId: 5,
        workflowId: 3,
        departmentId: 42,
        ccEmployeeIds: null,
        currentNodeKey: 'n1',
        records: [
          { id: 101, nodeId: 60, order: 1, nodeKey: 'n1', status: 'pending', approverId: 5 },
          {
            id: 102,
            nodeId: 60,
            order: 1.5,
            nodeKey: 'n1_addsign_1700000000000',
            nodeName: '主管审批（加签）',
            status: 'pending',
            approverId: 8,
          },
        ],
      };
      prisma.user = { findUnique: jest.fn().mockResolvedValue({ id: 5, realName: '张三' }) };
      // 加签节点的 nodeKey 不在审批流节点表中
      prisma.approvalWorkflowNode = { findUnique: jest.fn().mockResolvedValue(null) };
      prisma.approvalRecord = {
        findFirst: jest.fn().mockResolvedValue({ id: 102, approverId: 8, status: 'pending' }),
      };
      const advanced = {
        ...instance,
        currentNodeKey: 'n1_addsign_1700000000000',
        currentNodeName: '主管审批（加签）',
      };
      prisma.$transaction = jest.fn().mockImplementation(async (cb: any) =>
        cb({
          approvalInstance: {
            // 第 1 次读取是事务内的 pending 快照（currentNodeKey=n1），第 2 次是 CAS 写回后的重查
            findUnique: jest
              .fn()
              .mockResolvedValueOnce(instance)
              .mockResolvedValue(advanced),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          approvalRecord: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        }),
      );
      const notification = {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        removeByRelated: jest.fn().mockResolvedValue({ count: 1 }),
      };
      service = new ApprovalService(
        prisma,
        notification as any,
        { emit: jest.fn() } as any,
        { isEnabled: false } as any,
      );

      await service.approve({ instanceId: 9, userId: 5, userName: '张三' });

      expect(notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 8, relatedId: 9, relatedType: 'approval_instance' }),
      );
    });
  });
});

/**
 * 撤回与审批的并发竞态。
 *
 * withdraw 与 handleApproval 都在读取实例时判定 status==='pending'，随后各自**无条件**
 * 写回实例状态。两者交错时，在途的审批会把已撤回（cancelled）的实例覆盖成
 * approved / 下一节点：申请人点了撤回、业务单据也已置为已撤销，审批却显示「已通过」，
 * 且待审批通知被清掉后又被重新发出。
 * 修复：实例状态流转一律带 status='pending' 条件做 CAS，抢占失败方抛 6307 并回滚整单。
 */
describe('ApprovalService · 撤回/审批并发竞态（状态 CAS）', () => {
  let prisma: any;
  let notification: any;
  let service: ApprovalService;

  beforeEach(() => {
    prisma = {
      approvalInstance: {},
      approvalWorkflowNode: { findUnique: jest.fn().mockResolvedValue(null) },
      approvalWorkflow: {
        findUnique: jest.fn().mockResolvedValue({ code: 'leave', module: 'attendance' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 5, realName: '张三' }) },
    };
    notification = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      removeByRelated: jest.fn().mockResolvedValue({ count: 1 }),
    };
    service = new ApprovalService(
      prisma,
      notification as any,
      { emit: jest.fn() } as any,
      { isEnabled: false } as any,
    );
  });

  it('撤回必须以 status=pending 为条件做 CAS，不得无条件覆盖实例状态', async () => {
    prisma.approvalInstance = {
      findUnique: jest.fn().mockResolvedValue({ id: 9, status: 'pending', applicantId: 5, workflowId: 3 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    };

    await service.withdraw({ instanceId: 9, userId: 5 });

    expect(prisma.approvalInstance.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: 'pending' },
      data: expect.objectContaining({ status: 'cancelled', currentNodeKey: null }),
    });
    expect(prisma.approvalInstance.update).not.toHaveBeenCalled();
  });

  it('撤回抢占失败（实例已被并发处理）时抛 6312，且不得清理待审批通知', async () => {
    prisma.approvalInstance = {
      findUnique: jest.fn().mockResolvedValue({ id: 9, status: 'pending', applicantId: 5, workflowId: 3 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn(),
    };

    const err = await service.withdraw({ instanceId: 9, userId: 5 }).catch((e) => e);
    const payload = err.getResponse?.() ?? err.response ?? err;

    expect(payload.code).toBe(ERROR_CODES.APPROVAL_INSTANCE_STATUS_INVALID);
    expect(messageOf(payload.code)).toBe('审批实例状态无效');
    expect(notification.removeByRelated).not.toHaveBeenCalled();
  });

  it('审批落库时实例已被并发撤回（CAS 失败）必须抛 6307 且不落任何状态', async () => {
    const instance = {
      id: 9,
      status: 'pending',
      title: '请假申请',
      applicantId: 5,
      workflowId: 3,
      departmentId: 42,
      ccEmployeeIds: null,
      currentNodeKey: 'n1',
      records: [{ id: 101, order: 1, nodeKey: 'n1', status: 'pending', approverId: 5 }],
    };
    const tx = {
      approvalInstance: {
        findUnique: jest.fn().mockResolvedValue(instance),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({ ...instance, status: 'approved' }),
      },
      approvalRecord: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn() },
    };
    prisma.$transaction = jest.fn().mockImplementation(async (cb: any) => cb(tx));

    const err = await service.approve({ instanceId: 9, userId: 5, userName: '张三' }).catch((e) => e);
    const payload = err.getResponse?.() ?? err.response ?? err;

    expect(payload.code).toBe(ERROR_CODES.APPROVAL_INSTANCE_CONFLICT);
    expect(messageOf(payload.code)).toBe('审批状态已变更，请刷新后重试');
    expect(tx.approvalInstance.update).not.toHaveBeenCalled();
    expect(notification.removeByRelated).not.toHaveBeenCalled();
  });
});