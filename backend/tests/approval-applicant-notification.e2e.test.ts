import {
  createTestApp,
  loginAs,
  authInject,
  cleanup,
  teardown,
  prisma,
} from './test-helpers';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

describe('Approval Applicant Notification (e2e)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let hrCookie: string;
  let employeeCookie: string;
  let employeeUserId: number;
  let workflowId: number;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = await loginAs(app, 'admin', 'admin123');
    hrCookie = await loginAs(app, 'hr', 'hr123');

    const employeeRes = await authInject(app, adminCookie, {
      method: 'POST',
      url: '/api/v1/employees',
      payload: {
        name: '测试员工',
        employeeNo: 'TEST_NOTIFY_001',
        departmentId: 1,
        userId: 3,
      },
    });
    const employeeData = JSON.parse(employeeRes.payload);
    employeeUserId = 3;
    employeeCookie = await loginAs(app, 'employee1', 'employee123');
  });

  afterAll(async () => {
    await cleanup('approvalRecord', 'approvalInstance', 'approvalWorkflowNode', 'approvalWorkflow', 'notification');
    await teardown(app);
  });

  beforeEach(async () => {
    await cleanup('approvalRecord', 'approvalInstance', 'approvalWorkflowNode', 'approvalWorkflow', 'notification');

    const workflowRes = await authInject(app, adminCookie, {
      method: 'POST',
      url: '/api/v1/approval/workflows',
      payload: {
        code: 'test_notify_workflow',
        name: '测试通知审批流',
        module: 'test',
        status: 'active',
        nodes: [
          {
            nodeKey: 'node1',
            name: 'HR审批',
            type: 'role',
            roleCode: 'hr',
            order: 1,
          },
        ],
      },
    });
    const workflow = JSON.parse(workflowRes.payload);
    workflowId = workflow.id;
  });

  describe('审批通过后通知申请人', () => {
    it('应该在审批全部通过后给申请人发送通知', async () => {
      const startRes = await authInject(app, employeeCookie, {
        method: 'POST',
        url: '/api/v1/approval/start',
        payload: {
          workflowCode: 'test_notify_workflow',
          title: '入职申请',
          formData: {},
        },
      });
      const instance = JSON.parse(startRes.payload);
      const instanceId = instance.id;

      const beforeNotifications = await prisma.notification.count({
        where: { userId: employeeUserId, type: 'approval' },
      });

      const approveRes = await authInject(app, hrCookie, {
        method: 'POST',
        url: `/api/v1/approval/${instanceId}/approve`,
        payload: { comment: '同意申请' },
      });
      expect(approveRes.statusCode).toBe(201);

      const notifications = await prisma.notification.findMany({
        where: { userId: employeeUserId, type: 'approval' },
        orderBy: { createdAt: 'desc' },
      });

      const approvalNotification = notifications.find(
        (n) => n.relatedId === instanceId && n.relatedType === 'approval_instance'
      );
      expect(approvalNotification).toBeDefined();
      expect(approvalNotification!.title).toContain('入职申请');
      expect(approvalNotification!.title).toContain('通过');
      expect(approvalNotification!.content).toContain('同意申请');
    });

    it('中间节点通过时不应该通知申请人', async () => {
      await authInject(app, adminCookie, {
        method: 'PUT',
        url: `/api/v1/approval/workflows/${workflowId}`,
        payload: {
          nodes: [
            { nodeKey: 'node1', name: 'HR审批', type: 'role', roleCode: 'hr', order: 1 },
            { nodeKey: 'node2', name: '主管审批', type: 'role', roleCode: 'admin', order: 2 },
          ],
        },
      });

      const startRes = await authInject(app, employeeCookie, {
        method: 'POST',
        url: '/api/v1/approval/start',
        payload: {
          workflowCode: 'test_notify_workflow',
          title: '请假申请',
          formData: {},
        },
      });
      const instance = JSON.parse(startRes.payload);
      const instanceId = instance.id;

      const beforeNotifications = await prisma.notification.count({
        where: { userId: employeeUserId, type: 'approval', relatedId: instanceId },
      });

      const approveRes = await authInject(app, hrCookie, {
        method: 'POST',
        url: `/api/v1/approval/${instanceId}/approve`,
        payload: { comment: 'HR同意' },
      });
      expect(approveRes.statusCode).toBe(201);

      const afterFirstApprove = await prisma.notification.count({
        where: { userId: employeeUserId, type: 'approval', relatedId: instanceId },
      });
      expect(afterFirstApprove).toBe(beforeNotifications);

      const secondApproveRes = await authInject(app, adminCookie, {
        method: 'POST',
        url: `/api/v1/approval/${instanceId}/approve`,
        payload: { comment: '主管同意' },
      });
      expect(secondApproveRes.statusCode).toBe(201);

      const afterFinalApprove = await prisma.notification.findMany({
        where: { userId: employeeUserId, type: 'approval', relatedId: instanceId },
      });
      expect(afterFinalApprove.length).toBeGreaterThan(0);
      const approvalNotification = afterFinalApprove[0];
      expect(approvalNotification.title).toContain('请假申请');
      expect(approvalNotification.title).toContain('通过');
    });
  });

  describe('审批驳回后通知申请人', () => {
    it('应该在审批驳回后给申请人发送通知', async () => {
      const startRes = await authInject(app, employeeCookie, {
        method: 'POST',
        url: '/api/v1/approval/start',
        payload: {
          workflowCode: 'test_notify_workflow',
          title: '报销申请',
          formData: {},
        },
      });
      const instance = JSON.parse(startRes.payload);
      const instanceId = instance.id;

      const rejectRes = await authInject(app, hrCookie, {
        method: 'POST',
        url: `/api/v1/approval/${instanceId}/reject`,
        payload: { comment: '材料不齐全' },
      });
      expect(rejectRes.statusCode).toBe(201);

      const notifications = await prisma.notification.findMany({
        where: { userId: employeeUserId, type: 'approval', relatedId: instanceId },
        orderBy: { createdAt: 'desc' },
      });

      expect(notifications.length).toBeGreaterThan(0);
      const rejectNotification = notifications[0];
      expect(rejectNotification.title).toContain('报销申请');
      expect(rejectNotification.title).toContain('驳回');
      expect(rejectNotification.content).toContain('材料不齐全');
      expect(rejectNotification.relatedType).toBe('approval_instance');
    });
  });
});
