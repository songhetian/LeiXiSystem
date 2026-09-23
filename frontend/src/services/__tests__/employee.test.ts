import { employeeApi } from '@/services/employee';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockEmployee = {
  id: 1,
  employeeNo: 'E001',
  name: '张三',
  departmentId: 1,
  departmentName: '技术部',
  positionId: 1,
  positionName: '工程师',
  hireDate: '2024-01-15',
  phone: '13800138000',
  status: 'active',
  salary: '8000.00',
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockEmployee],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

describe('employeeApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常用例', () => {
    it('getList sends GET request with pagination params', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await employeeApi.getList({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/employees', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
      expect(result.data!.total).toBe(1);
    });

    it('getList sends search params when provided', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await employeeApi.getList({
        page: 1,
        pageSize: 20,
        name: '张三',
        departmentId: 1,
        status: 'active',
      });
      expect(mockedRequest.get).toHaveBeenCalledWith('/employees', {
        params: { page: 1, pageSize: 20, name: '张三', departmentId: 1, status: 'active' },
      });
    });

    it('getById sends GET request with id', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: mockEmployee,
      });
      const result = await employeeApi.getById(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/employees/1');
      expect(result.data!.id).toBe(1);
      expect(result.data!.employeeNo).toBe('E001');
    });

    it('create sends POST request with employee data', async () => {
      const newEmployee = {
        employeeNo: 'E002',
        name: '李四',
        departmentId: 2,
        positionId: 3,
        hireDate: '2024-06-01',
        phone: '13900139000',
        salary: 10000,
      };
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 2, ...newEmployee },
      });
      const result = await employeeApi.create(newEmployee);
      expect(mockedRequest.post).toHaveBeenCalledWith('/employees', newEmployee);
      expect(result.code).toBe(0);
    });

    it('update sends PATCH request with id and data', async () => {
      const updateData = { name: '张三丰', phone: '13700137000' };
      mockedRequest.patch.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { ...mockEmployee, ...updateData },
      });
      const result = await employeeApi.update(1, updateData);
      expect(mockedRequest.patch).toHaveBeenCalledWith('/employees/1', updateData);
      expect(result.data!.name).toBe('张三丰');
    });

    it('resign sends POST request to resign endpoint', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'inactive', resignDate: '2026-08-13' },
      });
      const result = await employeeApi.resign(1, { resignDate: '2026-08-13' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/employees/1/resign', { resignDate: '2026-08-13' });
      expect(result.data!.status).toBe('inactive');
    });
  });

  describe('异常用例', () => {
    it('handles duplicate employeeNo error (code 1001)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 1001,
        message: '工号已存在',
      });
      const result = await employeeApi.create({
        employeeNo: 'E001',
        name: '重复',
        departmentId: 1,
        positionId: 1,
        hireDate: '2024-01-01',
        phone: '13800138001',
        salary: 5000,
      });
      expect(result.code).toBe(1001);
      expect(result.message).toBe('工号已存在');
    });

    it('handles employee not found error (code 1002)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 1002,
        message: '员工不存在',
      });
      const result = await employeeApi.getById(999);
      expect(result.code).toBe(1002);
    });

    it('handles invalid phone error (code 1003)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 1003,
        message: '手机号格式错误',
      });
      const result = await employeeApi.create({
        employeeNo: 'E003',
        name: '测试',
        departmentId: 1,
        positionId: 1,
        hireDate: '2024-01-01',
        phone: 'invalid',
        salary: 5000,
      });
      expect(result.code).toBe(1003);
    });
  });

  describe('边界用例', () => {
    it('uses default pagination when not provided', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await employeeApi.getList({});
      expect(mockedRequest.get).toHaveBeenCalledWith('/employees', {
        params: {},
      });
    });

    it('handles empty list response', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await employeeApi.getList({ page: 1, pageSize: 20 });
      expect(result.data!.list).toHaveLength(0);
      expect(result.data!.total).toBe(0);
    });
  });

  describe('合同续签/终止/附件上传', () => {
    it('renewContract 走 POST /employees/contracts/:id/renew', async () => {
      mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { id: 2, contractNo: 'CT2' } });
      const res = await employeeApi.renewContract(1, { contractNo: 'CT2', startDate: '2026-09-01' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/employees/contracts/1/renew', { contractNo: 'CT2', startDate: '2026-09-01' });
      expect(res.data.id).toBe(2);
    });

    it('terminateContract 走 POST /employees/contracts/:id/terminate', async () => {
      mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { id: 1, status: 'terminated' } });
      await employeeApi.terminateContract(1, { terminationDate: '2026-08-27', remark: '协商解除' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/employees/contracts/1/terminate', { terminationDate: '2026-08-27', remark: '协商解除' });
    });

    it('uploadContractFile 以 multipart 上传并携带 bizType', async () => {
      const file = new File(['pdf'], 'a.pdf', { type: 'application/pdf' });
      mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { url: '/uploads/contract/1.pdf', fileName: 'a.pdf' } });
      const res = await employeeApi.uploadContractFile(file, 'contract');
      const [url, formData, opts] = mockedRequest.post.mock.calls[0];
      expect(url).toBe('/files/upload?bizType=contract');
      expect(formData).toBeInstanceOf(FormData);
      expect(opts?.headers?.['Content-Type']).toBe('multipart/form-data');
      expect(res.data?.url).toBe('/uploads/contract/1.pdf');
    });
  });
});
