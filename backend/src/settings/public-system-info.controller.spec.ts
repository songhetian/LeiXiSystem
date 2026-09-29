import { PublicSystemInfoController } from './public-system-info.controller';
import { SettingsService } from './settings.service';
import { FilesService } from '../files/files.service';

describe('PublicSystemInfoController', () => {
  let controller: PublicSystemInfoController;

  const settingsMock = {
    list: jest.fn(),
  };

  const filesMock = {
    openStream: jest.fn(),
  };

  // 直接构造 controller（项目约定风格，不依赖 @nestjs/testing）
  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PublicSystemInfoController(
      settingsMock as unknown as SettingsService,
      filesMock as unknown as FilesService,
    );
  });

  const settingRow = (key: string, value: string, group = 'general') => ({
    id: 1,
    group,
    key,
    value,
    label: null,
    description: null,
    isPublic: false,
    updatedAt: '',
    updatedBy: null,
  });

  describe('info', () => {
    it('返回系统名称与 Logo', async () => {
      settingsMock.list.mockResolvedValue([
        settingRow('system.name', '我的系统'),
        settingRow('system.logo', '/uploads/system/logo.png'),
      ]);

      const res = await controller.info();

      expect(res.code).toBe(0);
      expect(res.data!.name).toBe('我的系统');
      expect(res.data!.logo).toBe('/uploads/system/logo.png');
    });

    it('未配置时回退默认名称与空 Logo', async () => {
      settingsMock.list.mockResolvedValue([
        settingRow('company_name', '雷犀科技'),
      ]);

      const res = await controller.info();

      expect(res.data!.name).toBe('雷犀管理系统');
      expect(res.data!.logo).toBe('');
    });

    it('只读取 general 分组', async () => {
      settingsMock.list.mockResolvedValue([]);

      await controller.info();

      expect(settingsMock.list).toHaveBeenCalledWith('general');
    });
  });

  describe('logo', () => {
    it('返回本地 Logo 图片流', async () => {
      settingsMock.list.mockResolvedValue([
        settingRow('system.logo', '/uploads/system/logo.png'),
      ]);
      filesMock.openStream.mockResolvedValue({ stream: {} as any });

      const res = {} as any;
      res.header = jest.fn();
      res.send = jest.fn();

      await controller.logo(res);

      expect(filesMock.openStream).toHaveBeenCalledWith('/uploads/system/logo.png');
      expect(res.header).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.send).toHaveBeenCalled();
    });

    it('未配置 Logo 时抛出 NotFound（系统设置域 7201，非权限码 5003）', async () => {
      settingsMock.list.mockResolvedValue([]);

      const res = {} as any;
      res.header = jest.fn();
      res.send = jest.fn();

      await expect(controller.logo(res)).rejects.toMatchObject({
        response: { code: 7201 },
      });
      expect(filesMock.openStream).not.toHaveBeenCalled();
    });
  });
});