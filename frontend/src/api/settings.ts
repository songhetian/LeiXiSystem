const STORAGE_KEY = 'leixi_system_settings'

export interface SystemSettings {
  // 企业信息
  company: {
    name: string
    logo: string
    timezone: string
    contactEmail: string
    contactPhone: string
    address: string
  }
  // 账号安全
  security: {
    passwordMinLength: number
    passwordComplexity: string[]
    passwordExpiryDays: number
    loginFailureLockoutThreshold: number
    lockoutDurationMinutes: number
    sessionTimeoutMinutes: number
  }
  // 通知设置
  notification: {
    siteEnabled: boolean
    emailEnabled: boolean
    smsEnabled: boolean
    dndEnabled: boolean
    dndStart: string
    dndEnd: string
    approvalEnabled: boolean
    attendanceEnabled: boolean
    systemEnabled: boolean
    announcementEnabled: boolean
  }
  // 系统参数
  parameters: {
    dataRetentionDays: number
    auditLogRetentionDays: number
    defaultPageSize: number
    maxUploadSizeMB: number
  }
}

const defaultSettings: SystemSettings = {
  company: {
    name: '',
    logo: '',
    timezone: 'Asia/Shanghai',
    contactEmail: '',
    contactPhone: '',
    address: '',
  },
  security: {
    passwordMinLength: 8,
    passwordComplexity: ['lowercase', 'number'],
    passwordExpiryDays: 90,
    loginFailureLockoutThreshold: 5,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 60,
  },
  notification: {
    siteEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    dndEnabled: false,
    dndStart: '22:00',
    dndEnd: '08:00',
    approvalEnabled: true,
    attendanceEnabled: true,
    systemEnabled: true,
    announcementEnabled: true,
  },
  parameters: {
    dataRetentionDays: 365,
    auditLogRetentionDays: 180,
    defaultPageSize: 20,
    maxUploadSizeMB: 10,
  },
}

function loadFromStorage(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...defaultSettings, ...JSON.parse(raw) }
    }
  } catch {
    // ignore
  }
  return { ...defaultSettings }
}

function saveToStorage(data: SystemSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getSystemSettings(): Promise<SystemSettings> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(loadFromStorage()), 300)
  })
}

export function updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
  return new Promise((resolve) => {
    const current = loadFromStorage()
    const merged: SystemSettings = {
      company: { ...current.company, ...(data.company || {}) },
      security: { ...current.security, ...(data.security || {}) },
      notification: { ...current.notification, ...(data.notification || {}) },
      parameters: { ...current.parameters, ...(data.parameters || {}) },
    }
    saveToStorage(merged)
    setTimeout(() => resolve(merged), 300)
  })
}
