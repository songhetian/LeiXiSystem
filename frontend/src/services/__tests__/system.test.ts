import { systemApi } from '@/services/system';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockUser = {
  id: 1,
  username: 'admin',
  name: '管理员',
  status: 'active',
  createdAt: '2026-08-01T00:00:00+08:00',
  roles: [{ id: 1, code: 'admin', name: '管理员' }],
};

const mockRole = {
  id: 1,
  code: 'admin',
  name: '管理员',
  description: null,
  permissions: [
    { permission: { id: 1, code: 'attendance:view', name: '考勤查看', module: 'attendance' } },
  ],
};

const mockPermission = { id: 1, code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' };

const mockLog = {
  id: 1,
  userId: 1,
  username: 'admin',
  module: 'auth',
  action: 'login',
  method: 'POST',
  url: '/api/v1/auth/login',
  ip: '127.0.0.1',
  status: 'success',
  createdAt: '2026-08-14T09:00:00+08:00',
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: { list: [mockUser], total: 1, page: 1, pageSize: 20 },
};

describe('systemApi（T27：用户/角色/日志）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listUsers 发送 GET /system/users 带分页与关键词', async () => {
    mockedRequest.get.mockResolvedValueOnce(mockListResponse);
    const result = await systemApi.listUsers({ page: 1, pageSize: 20, keyword: 'admin' });
    expect(mockedRequest.get).toHaveBeenCalledWith('/system/users', {
      params: { page: 1, pageSize: 20, keyword: 'admin' },
    });
    expect(result.code).toBe(0);
    expect(result.data?.list).toHaveLength(1);
  });

  it('createUser 发送 POST /system/users（含角色）', async () => {
    mockedRequest.post.mockResolvedValueOnce({ code: 0, data: mockUser });
    await systemApi.createUser({ username: 'zhang', password: '123456', name: '张三', roleIds: [2] });
    expect(mockedRequest.post).toHaveBeenCalledWith('/system/users', {
      username: 'zhang',
      password: '123456',
      name: '张三',
      roleIds: [2],
    });
  });

  it('updateUser 发送 PUT /system/users/:id（支持重置密码）', async () => {
    mockedRequest.put.mockResolvedValueOnce({ code: 0, data: mockUser });
    await systemApi.updateUser(5, { password: 'new123456' });
    expect(mockedRequest.put).toHaveBeenCalledWith('/system/users/5', { password: 'new123456' });
  });

  it('assignUserRoles 发送 POST /system/users/:id/roles', async () => {
    mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { success: true } });
    await systemApi.assignUserRoles(5, [1, 2]);
    expect(mockedRequest.post).toHaveBeenCalledWith('/system/users/5/roles', { roleIds: [1, 2] });
  });

  it('listRoles 发送 GET /system/roles（含权限点）', async () => {
    mockedRequest.get.mockResolvedValueOnce({ code: 0, data: [mockRole] });
    const result = await systemApi.listRoles();
    expect(mockedRequest.get).toHaveBeenCalledWith('/system/roles');
    expect(result.data?.[0].permissions).toHaveLength(1);
  });

  it('listPermissions 发送 GET /system/permissions', async () => {
    mockedRequest.get.mockResolvedValueOnce({ code: 0, data: [mockPermission] });
    const result = await systemApi.listPermissions();
    expect(mockedRequest.get).toHaveBeenCalledWith('/system/permissions');
    expect(result.data?.[0].code).toBe('attendance:view');
  });

  it('createRole 发送 POST /system/roles', async () => {
    mockedRequest.post.mockResolvedValueOnce({ code: 0, data: mockRole });
    await systemApi.createRole({ code: 'hr', name: '人事', description: '人事专员' });
    expect(mockedRequest.post).toHaveBeenCalledWith('/system/roles', {
      code: 'hr',
      name: '人事',
      description: '人事专员',
    });
  });

  it('assignRolePermissions 发送 POST /system/roles/:id/permissions', async () => {
    mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { success: true } });
    await systemApi.assignRolePermissions(2, [3, 4]);
    expect(mockedRequest.post).toHaveBeenCalledWith('/system/roles/2/permissions', {
      permissionIds: [3, 4],
    });
  });

  it('listLogs 发送 GET /system/logs 带过滤条件', async () => {
    mockedRequest.get.mockResolvedValueOnce({
      code: 0,
      data: { list: [mockLog], total: 1, page: 1, pageSize: 20 },
    });
    const result = await systemApi.listLogs({ page: 1, pageSize: 20, module: 'auth' });
    expect(mockedRequest.get).toHaveBeenCalledWith('/system/logs', {
      params: { page: 1, pageSize: 20, module: 'auth' },
    });
    expect(result.data?.list[0].module).toBe('auth');
  });
});
