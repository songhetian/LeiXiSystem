import { maskSensitiveFields } from './sensitive-mask.util';

describe('SensitiveMaskUtil', () => {
  describe('密码类字段脱敏', () => {
    it('应该将 password 字段替换为 ******', () => {
      const input = { password: 'mypassword123' };
      const result = maskSensitiveFields(input) as { password: string };
      expect(result.password).toBe('******');
    });

    it('应该将 newPassword 字段替换为 ******', () => {
      const input = { newPassword: 'newpass456' };
      const result = maskSensitiveFields(input) as { newPassword: string };
      expect(result.newPassword).toBe('******');
    });

    it('应该将 oldPassword 字段替换为 ******', () => {
      const input = { oldPassword: 'oldpass789' };
      const result = maskSensitiveFields(input) as { oldPassword: string };
      expect(result.oldPassword).toBe('******');
    });

    it('应该将 confirmPassword 字段替换为 ******', () => {
      const input = { confirmPassword: 'confirmpass' };
      const result = maskSensitiveFields(input) as { confirmPassword: string };
      expect(result.confirmPassword).toBe('******');
    });

    it('应该不区分大小写匹配 password 字段', () => {
      const input = { PASSWORD: 'testpass' };
      const result = maskSensitiveFields(input) as { PASSWORD: string };
      expect(result.PASSWORD).toBe('******');
    });
  });

  describe('身份证号脱敏', () => {
    it('应该保留身份证号前6后4位', () => {
      const input = { idCard: '110101199001011234' };
      const result = maskSensitiveFields(input) as { idCard: string };
      expect(result.idCard).toBe('110101********1234');
    });

    it('应该处理 idCardNo 字段', () => {
      const input = { idCardNo: '310101198505055678' };
      const result = maskSensitiveFields(input) as { idCardNo: string };
      expect(result.idCardNo).toBe('310101********5678');
    });

    it('应该处理 id_number 字段', () => {
      const input = { id_number: '440101199212129876' };
      const result = maskSensitiveFields(input) as { id_number: string };
      expect(result.id_number).toBe('440101********9876');
    });

    it('短身份证号应该全部替换为 ******', () => {
      const input = { idCard: '12345' };
      const result = maskSensitiveFields(input) as { idCard: string };
      expect(result.idCard).toBe('******');
    });
  });

  describe('手机号脱敏', () => {
    it('应该保留手机号前3后4位', () => {
      const input = { phone: '13812345678' };
      const result = maskSensitiveFields(input) as { phone: string };
      expect(result.phone).toBe('138****5678');
    });

    it('应该处理 mobile 字段', () => {
      const input = { mobile: '13987654321' };
      const result = maskSensitiveFields(input) as { mobile: string };
      expect(result.mobile).toBe('139****4321');
    });

    it('应该处理 telephone 字段', () => {
      const input = { telephone: '13711112222' };
      const result = maskSensitiveFields(input) as { telephone: string };
      expect(result.telephone).toBe('137****2222');
    });

    it('短手机号应该全部替换为 ******', () => {
      const input = { phone: '12345' };
      const result = maskSensitiveFields(input) as { phone: string };
      expect(result.phone).toBe('******');
    });
  });

  describe('银行卡号脱敏', () => {
    it('应该只保留银行卡号后4位', () => {
      const input = { bankCard: '6222021234567890123' };
      const result = maskSensitiveFields(input) as { bankCard: string };
      expect(result.bankCard).toBe('***************0123');
    });

    it('应该处理 bankAccount 字段', () => {
      const input = { bankAccount: '6222020000000000123' };
      const result = maskSensitiveFields(input) as { bankAccount: string };
      expect(result.bankAccount).toBe('***************0123');
    });

    it('应该处理 cardNumber 字段', () => {
      const input = { cardNumber: '4367420000000000999' };
      const result = maskSensitiveFields(input) as { cardNumber: string };
      expect(result.cardNumber).toBe('***************0999');
    });

    it('短银行卡号应该全部替换为 ******', () => {
      const input = { bankCard: '123' };
      const result = maskSensitiveFields(input) as { bankCard: string };
      expect(result.bankCard).toBe('******');
    });
  });

  describe('邮箱脱敏', () => {
    it('应该保留邮箱前缀前2位', () => {
      const input = { email: 'zhangsan@example.com' };
      const result = maskSensitiveFields(input) as { email: string };
      expect(result.email).toBe('zh******@example.com');
    });

    it('应该正确处理短前缀邮箱', () => {
      const input = { email: 'ab@test.com' };
      const result = maskSensitiveFields(input) as { email: string };
      expect(result.email).toBe('******');
    });

    it('应该正确处理单字符前缀邮箱', () => {
      const input = { email: 'a@test.com' };
      const result = maskSensitiveFields(input) as { email: string };
      expect(result.email).toBe('******');
    });
  });

  describe('薪资类字段脱敏', () => {
    it('应该将 salary 替换为 ***', () => {
      const input = { salary: 15000 };
      const result = maskSensitiveFields(input) as { salary: string };
      expect(result.salary).toBe('***');
    });

    it('应该将 baseSalary 替换为 ***', () => {
      const input = { baseSalary: 12000 };
      const result = maskSensitiveFields(input) as { baseSalary: string };
      expect(result.baseSalary).toBe('***');
    });

    it('应该将 amount 替换为 ***', () => {
      const input = { amount: 5000.5 };
      const result = maskSensitiveFields(input) as { amount: string };
      expect(result.amount).toBe('***');
    });

    it('应该将 bonus 替换为 ***', () => {
      const input = { bonus: 3000 };
      const result = maskSensitiveFields(input) as { bonus: string };
      expect(result.bonus).toBe('***');
    });

    it('应该将 fine 替换为 ***', () => {
      const input = { fine: 200 };
      const result = maskSensitiveFields(input) as { fine: string };
      expect(result.fine).toBe('***');
    });
  });

  describe('地址脱敏', () => {
    it('应该保留地址前6个字符', () => {
      const input = { address: '北京市朝阳区建国路88号SOHO现代城' };
      const result = maskSensitiveFields(input) as { address: string };
      expect(result.address).toMatch(/^北京市朝阳区/);
      expect(result.address.length).toBeLessThan('北京市朝阳区建国路88号SOHO现代城'.length);
    });

    it('短地址应该保持原样', () => {
      const input = { address: '北京市' };
      const result = maskSensitiveFields(input) as { address: string };
      expect(result.address).toBe('北京市');
    });
  });

  describe('嵌套对象和数组处理', () => {
    it('应该递归处理嵌套对象', () => {
      const input = {
        user: {
          name: '张三',
          password: 'secret123',
          phone: '13812345678',
          profile: {
            idCard: '110101199001011234',
            email: 'zhangsan@test.com',
          },
        },
      };
      const result = maskSensitiveFields(input) as any;
      expect(result.user.name).toBe('张三');
      expect(result.user.password).toBe('******');
      expect(result.user.phone).toBe('138****5678');
      expect(result.user.profile.idCard).toBe('110101********1234');
      expect(result.user.profile.email).toBe('zh******@test.com');
    });

    it('应该处理数组中的对象', () => {
      const input = {
        employees: [
          { name: '张三', phone: '13812345678', salary: 15000 },
          { name: '李四', phone: '13987654321', salary: 20000 },
        ],
      };
      const result = maskSensitiveFields(input) as any;
      expect(result.employees[0].name).toBe('张三');
      expect(result.employees[0].phone).toBe('138****5678');
      expect(result.employees[0].salary).toBe('***');
      expect(result.employees[1].name).toBe('李四');
      expect(result.employees[1].phone).toBe('139****4321');
      expect(result.employees[1].salary).toBe('***');
    });

    it('应该处理纯数组', () => {
      const input = [
        { password: 'pass1' },
        { password: 'pass2' },
      ];
      const result = maskSensitiveFields(input) as Array<{ password: string }>;
      expect(result[0].password).toBe('******');
      expect(result[1].password).toBe('******');
    });
  });

  describe('边界情况处理', () => {
    it('应该处理 null 值', () => {
      const result = maskSensitiveFields(null);
      expect(result).toBeNull();
    });

    it('应该处理 undefined 值', () => {
      const result = maskSensitiveFields(undefined);
      expect(result).toBeUndefined();
    });

    it('应该处理数字类型', () => {
      const result = maskSensitiveFields(123);
      expect(result).toBe(123);
    });

    it('应该处理布尔类型', () => {
      const result = maskSensitiveFields(true);
      expect(result).toBe(true);
    });

    it('应该处理字符串类型（非对象）', () => {
      const result = maskSensitiveFields('hello');
      expect(result).toBe('hello');
    });

    it('应该处理空对象', () => {
      const input = {};
      const result = maskSensitiveFields(input);
      expect(result).toEqual({});
    });

    it('应该处理空数组', () => {
      const input: any[] = [];
      const result = maskSensitiveFields(input);
      expect(result).toEqual([]);
    });

    it('应该保留非敏感字段不变', () => {
      const input = { id: 1, name: '张三', department: '技术部', status: 'active' };
      const result = maskSensitiveFields(input) as typeof input;
      expect(result.id).toBe(1);
      expect(result.name).toBe('张三');
      expect(result.department).toBe('技术部');
      expect(result.status).toBe('active');
    });
  });
});
