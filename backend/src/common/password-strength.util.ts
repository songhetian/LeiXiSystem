export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

export interface PasswordValidationOptions {
  level?: PasswordStrengthLevel;
  username?: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const WEAK_PASSWORDS = [
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'abc12345',
  '11111111',
  '00000000',
  'admin123',
  'letmein1',
  'welcome1',
  'monkey123',
  'dragon123',
  'master123',
  '1234qwer',
  '12345678a',
  'a12345678',
  'iloveyou1',
  'trustno1',
  'sunshine1',
  'princess1',
  'football1',
  'baseball1',
];

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()\-_=+\[\]{}|;:',.<>?\/]/;

export function validatePasswordStrength(
  password: string,
  options: PasswordValidationOptions = {},
): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['密码不能为空'] };
  }

  let level: PasswordStrengthLevel = options.level || 'medium';
  if (!['weak', 'medium', 'strong'].includes(level)) {
    level = 'medium';
  }

  const username = options.username;

  switch (level) {
    case 'weak':
      validateWeak(password, errors);
      break;
    case 'medium':
      validateMedium(password, errors);
      validateUsernameDiff(password, username, errors);
      validateCommonWeakPassword(password, errors);
      break;
    case 'strong':
      validateStrong(password, errors);
      validateUsernameDiff(password, username, errors);
      validateCommonWeakPassword(password, errors);
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateWeak(password: string, errors: string[]): void {
  if (password.length < 6) {
    errors.push('密码长度至少为 6 位');
  }
}

function validateMedium(password: string, errors: string[]): void {
  if (password.length < 8) {
    errors.push('密码长度至少为 8 位');
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  if (!hasLetter || !hasDigit) {
    errors.push('密码必须包含字母和数字');
  }
}

function validateStrong(password: string, errors: string[]): void {
  if (password.length < 10) {
    errors.push('密码长度至少为 10 位');
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = SPECIAL_CHAR_REGEX.test(password);

  if (!hasUpper) {
    errors.push('密码必须包含大写字母');
  }
  if (!hasLower) {
    errors.push('密码必须包含小写字母');
  }
  if (!hasDigit) {
    errors.push('密码必须包含数字');
  }
  if (!hasSpecial) {
    errors.push('密码必须包含特殊字符');
  }
}

function validateUsernameDiff(password: string, username: string | undefined, errors: string[]): void {
  if (username && password.toLowerCase() === username.toLowerCase()) {
    errors.push('密码不能与用户名相同');
  }
}

function validateCommonWeakPassword(password: string, errors: string[]): void {
  const lowerPassword = password.toLowerCase();
  if (WEAK_PASSWORDS.some((weak) => lowerPassword === weak.toLowerCase())) {
    errors.push('密码过于简单，请使用更复杂的密码');
  }
}
