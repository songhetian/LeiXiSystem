import { approvalApi } from '@/services/approval';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockTodoItem = {
  id: 1,
  instanceId: 101,
  title: '请假申请-张三',
  module: 'leave',
  workflowName: '请假审批',
  submitterName: '张三',
  submitterDepartment: '技术部',
  submitTime: '2026-08-13T09:00:00+08:00',
  currentNodeName: '部门主管审批',
  status: 'pending',
};

const mockSubmissionItem = {
  id: 1,
  instanceId: 101,
  title: '请假申请',
  module: 'leave',
  workflowName: '请假审批',
  currentNodeName: '部门主管审批',
  status: 'pending',
  submitTime: '2026-08-13T09:00:00+08:00',
};

describe('approvalApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('待办列表', () => {
    it('listTodos sends GET request to /approval/todos', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: { list: [mockTodoItem], total: 1, page: 1, pageSize: 20 },
      });
      const result = await approvalApi.listTodos({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/approval/todos', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
    });

    it('handles empty todo list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await approvalApi.listTodos({ page: 1, pageSize: 20 });
      expect(result.data!.list).toHaveLength(0);
      expect(result.data!.total).toBe(0);
    });
  });

  describe('我的申请', () => {
    it('listMySubmissions sends GET request with status filter', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: { list: [mockSubmissionItem], total: 1, page: 1, pageSize: 20 },
      });
      const result = await approvalApi.listMySubmissions({
        page: 1,
        pageSize: 20,
        status: 'pending',
      });
      expect(mockedRequest.get).toHaveBeenCalledWith('/approval/my-submissions', {
        params: { page: 1, pageSize: 20, status: 'pending' },
      });
      expect(result.code).toBe(0);
    });

    it('listMySubmissions works without status filter', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: { list: [mockSubmissionItem], total: 1, page: 1, pageSize: 20 },
      });
      await approvalApi.listMySubmissions({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/approval/my-submissions', {
        params: { page: 1, pageSize: 20 },
      });
    });
  });

  describe('审批操作', () => {
    it('approve sends POST request with comment', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'approved' },
      });
      const result = await approvalApi.approve(1, { comment: '同意' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/approval/instances/1/approve', {
        comment: '同意',
      });
      expect(result.code).toBe(0);
    });

    it('approve works without comment', async () => {
      mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { id: 1 } });
      await approvalApi.approve(1, {});
      expect(mockedRequest.post).toHaveBeenCalledWith('/approval/instances/1/approve', {});
    });

    it('reject sends POST request with comment', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'rejected' },
      });
      const result = await approvalApi.reject(1, { comment: '不符合规定' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/approval/instances/1/reject', {
        comment: '不符合规定',
      });
      expect(result.code).toBe(0);
    });
  });

  describe('审批详情', () => {
    it('getInstance sends GET request with id', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: {
          id: 1,
          title: '请假申请',
          status: 'pending',
          records: [],
        },
      });
      const result = await approvalApi.getInstance(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/approval/instances/1');
      expect(result.code).toBe(0);
    });
  });

  describe('异常用例', () => {
    it('handles already approved error (code 3001)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 3001,
        message: '该审批已被处理',
      });
      const result = await approvalApi.approve(1, { comment: '同意' });
      expect(result.code).toBe(3001);
      expect(result.message).toBe('该审批已被处理');
    });

    it('handles not your turn error (code 3002)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 3002,
        message: '当前不是您的审批节点',
      });
      const result = await approvalApi.approve(1, { comment: '同意' });
      expect(result.code).toBe(3002);
    });

    it('handles instance not found error (code 3003)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 3003,
        message: '审批实例不存在',
      });
      const result = await approvalApi.getInstance(999);
      expect(result.code).toBe(3003);
    });
  });

  describe('职责授权 · 流程适用角色', () => {
    const mockBindings = {
      roles: [
        { id: 1, code: 'hr', name: '人事' },
        { id: 2, code: 'staff', name: '普通员工' },
      ],
      workflows: [
        {
          id: 10,
          code: 'leave',
          name: '请假审批',
          module: 'attendance',
          status: 'active',
          roles: [{ id: 1, code: 'hr', name: '人事' }],
        },
      ],
    };

    it('listWorkflowRoleBindings sends GET request to /approval/role-bindings', async () => {
      mockedRequest.get.mockResolvedValueOnce({ code: 0, data: mockBindings });
      const result = await approvalApi.listWorkflowRoleBindings();
      expect(mockedRequest.get).toHaveBeenCalledWith('/approval/role-bindings');
      expect(result.code).toBe(0);
      // 方向是流程 → 角色：一条流程带着它的适用角色一起返回
      expect(result.data!.workflows[0].roles[0].name).toBe('人事');
      expect(result.data!.roles).toHaveLength(2);
    });

    it('setWorkflowRoles sends PUT request with the full role set', async () => {
      mockedRequest.put.mockResolvedValueOnce({ code: 0, data: { success: true } });
      const result = await approvalApi.setWorkflowRoles(10, [1, 2]);
      expect(mockedRequest.put).toHaveBeenCalledWith('/approval/role-bindings/10', {
        roleIds: [1, 2],
      });
      expect(result.code).toBe(0);
    });

    it('setWorkflowRoles sends an empty array to clear all bindings', async () => {
      mockedRequest.put.mockResolvedValueOnce({ code: 0, data: { success: true } });
      await approvalApi.setWorkflowRoles(10, []);
      expect(mockedRequest.put).toHaveBeenCalledWith('/approval/role-bindings/10', {
        roleIds: [],
      });
    });

    it('listRoleOptions sends GET request to /approval/role-options', async () => {
      mockedRequest.get.mockResolvedValueOnce({ code: 0, data: mockBindings.roles });
      const result = await approvalApi.listRoleOptions();
      expect(mockedRequest.get).toHaveBeenCalledWith('/approval/role-options');
      expect(result.data).toHaveLength(2);
    });

    it('setWorkflowRolesBatch sends one PUT for many workflows (single transaction)', async () => {
      mockedRequest.put.mockResolvedValueOnce({
        code: 0,
        data: { success: true, workflowCount: 3, roleCount: 2 },
      });
      await approvalApi.setWorkflowRolesBatch({
        workflowIds: [10, 11, 12],
        roleIds: [1, 2],
        mode: 'replace',
      });
      // 一次请求写完，而不是循环打三次单条接口
      expect(mockedRequest.put).toHaveBeenCalledTimes(1);
      expect(mockedRequest.put).toHaveBeenCalledWith('/approval/role-bindings/batch', {
        workflowIds: [10, 11, 12],
        roleIds: [1, 2],
        mode: 'replace',
      });
    });
  });
});
