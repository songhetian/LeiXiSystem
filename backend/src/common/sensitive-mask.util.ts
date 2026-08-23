type SensitiveFieldType =
  | 'password'
  | 'idCard'
  | 'bankCard'
  | 'phone'
  | 'email'
  | 'salary'
  | 'address';

const SENSITIVE_FIELD_RULES: Array<{ patterns: string[]; type: SensitiveFieldType }> = [
  {
    patterns: ['password', 'newpassword', 'oldpassword', 'confirmpassword'],
    type: 'password',
  },
  {
    patterns: ['idcard', 'idcardno', 'id_number'],
    type: 'idCard',
  },
  {
    patterns: ['bankaccount', 'bankcard', 'cardnumber'],
    type: 'bankCard',
  },
  {
    patterns: ['phone', 'mobile', 'telephone'],
    type: 'phone',
  },
  {
    patterns: ['email'],
    type: 'email',
  },
  {
    patterns: ['salary', 'basesalary', 'pay', 'amount', 'bonus', 'fine'],
    type: 'salary',
  },
  {
    patterns: ['address'],
    type: 'address',
  },
];

function maskPassword(value: string): string {
  return '******';
}

function maskIdCard(value: string): string {
  if (value.length <= 10) return '******';
  return value.slice(0, 6) + '*'.repeat(value.length - 10) + value.slice(-4);
}

function maskPhone(value: string): string {
  if (value.length <= 7) return '******';
  return value.slice(0, 3) + '*'.repeat(value.length - 7) + value.slice(-4);
}

function maskBankCard(value: string): string {
  if (value.length <= 4) return '******';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

function maskEmail(value: string): string {
  const atIndex = value.indexOf('@');
  if (atIndex <= 2) return '******';
  const prefix = value.slice(0, 2);
  const suffix = value.slice(atIndex);
  return prefix + '*'.repeat(atIndex - 2) + suffix;
}

function maskSalary(_value: string): string {
  return '***';
}

function maskAddress(value: string): string {
  if (value.length <= 6) return value;
  return value.slice(0, 6) + '*'.repeat(Math.min(value.length - 6, 10));
}

function getSensitiveType(fieldName: string): SensitiveFieldType | null {
  const lowerName = fieldName.toLowerCase();
  for (const rule of SENSITIVE_FIELD_RULES) {
    if (rule.patterns.some((p) => lowerName.includes(p))) {
      return rule.type;
    }
  }
  return null;
}

function maskValue(value: string, type: SensitiveFieldType): string {
  switch (type) {
    case 'password':
      return maskPassword(value);
    case 'idCard':
      return maskIdCard(value);
    case 'bankCard':
      return maskBankCard(value);
    case 'phone':
      return maskPhone(value);
    case 'email':
      return maskEmail(value);
    case 'salary':
      return maskSalary(value);
    case 'address':
      return maskAddress(value);
    default:
      return value;
  }
}

export function maskSensitiveFields(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveFields(item));
  }

  if (typeof data === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const sensitiveType = getSensitiveType(key);
      if (sensitiveType && value !== undefined && value !== null) {
        if (typeof value === 'string') {
          masked[key] = maskValue(value, sensitiveType);
        } else if (typeof value === 'number') {
          masked[key] = maskValue(String(value), sensitiveType);
        } else if (typeof value === 'object') {
          masked[key] = maskSensitiveFields(value);
        } else {
          masked[key] = value;
        }
      } else if (value && typeof value === 'object') {
        masked[key] = maskSensitiveFields(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return data;
}
