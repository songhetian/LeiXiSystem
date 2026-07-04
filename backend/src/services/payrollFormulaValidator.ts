import { z } from 'zod'

export class FormulaValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public position?: number
  ) {
    super(message)
    this.name = 'FormulaValidationError'
  }
}

const VALID_VARIABLES = [
  'baseSalary',
  'base_salary',
  'grossPay',
  'gross_pay',
  'netPay',
  'net_pay',
  'totalDeduction',
  'total_deduction',
  'attendanceDays',
  'attendance_days',
  'expectedWorkDays',
  'expected_work_days',
  'paidDays',
  'paid_days',
  'absentDays',
  'absent_days',
  'overtimeHours',
  'overtime_hours',
  'overtimeAmount',
  'overtime_amount',
  'lateHours',
  'late_hours',
  'earlyLeaveHours',
  'early_leave_hours',
  'bonus',
  'commission',
  'allowance',
  'deduction',
  'tax',
  'socialSecurity',
  'social_security',
  'housingFund',
  'housing_fund',
]

const OPERATORS = ['+', '-', '*', '/', '(', ')', '%', '&&', '||', '!', '>', '<', '>=', '<=', '==', '!=', '?', ':']
const FUNCTIONS = ['abs', 'round', 'floor', 'ceil', 'min', 'max', 'sum', 'avg', 'if', 'ifnull', 'coalesce', 'greatest', 'least']

const formulaSchema = z.string().refine(
  (value) => {
    if (!value || value.trim() === '') return true
    const trimmed = value.trim()
    for (const op of OPERATORS) {
      if (trimmed.includes(op)) return true
    }
    for (const fn of FUNCTIONS) {
      if (trimmed.toLowerCase().includes(fn.toLowerCase())) return true
    }
    return /^\d+(\.\d+)?$/.test(trimmed)
  },
  { message: '公式必须包含有效的运算符或函数' }
)

export interface FormulaValidationResult {
  valid: boolean
  errors: Array<{
    field: string
    message: string
    position?: number
  }>
  warnings: Array<{
    field: string
    message: string
  }>
}

export function validateFormula(
  formula: string,
  fieldName: string = 'formula'
): FormulaValidationResult {
  const errors: FormulaValidationResult['errors'] = []
  const warnings: FormulaValidationResult['warnings'] = []

  if (!formula || formula.trim() === '') {
    return { valid: true, errors: [], warnings: [] }
  }

  const trimmed = formula.trim()

  // 检查括号匹配
  let parenCount = 0
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '(') parenCount++
    if (trimmed[i] === ')') parenCount--
    if (parenCount < 0) {
      errors.push({
        field: fieldName,
        message: '括号不匹配，右括号多于左括号',
        position: i,
      })
      return { valid: false, errors, warnings }
    }
  }
  if (parenCount !== 0) {
    errors.push({
      field: fieldName,
      message: '括号不匹配，左括号多于右括号',
    })
  }

  // 检查连续运算符
  const consecutiveOps = /([+\-*/]{2,})/
  const match = trimmed.match(consecutiveOps)
  if (match) {
    errors.push({
      field: fieldName,
      message: `公式中不能有连续运算符: "${match[1]}"`,
    })
  }

  // 检查除零
  if (trimmed.includes('/0') || trimmed.includes('/ 0')) {
    warnings.push({
      field: fieldName,
      message: '公式包含除以零的运算，可能导致计算错误',
    })
  }

  // 检查变量名有效性
  const variablePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g
  let variableMatch
  while ((variableMatch = variablePattern.exec(trimmed)) !== null) {
    const varName = variableMatch[1]
    const lowerName = varName.toLowerCase()
    const isFunction = FUNCTIONS.some(fn => fn.toLowerCase() === lowerName)
    const isValidVariable = VALID_VARIABLES.some(v => v.toLowerCase() === lowerName)

    if (!isFunction && !isValidVariable && !/^\d+(\.\d+)?$/.test(varName)) {
      warnings.push({
        field: fieldName,
        message: `使用了未知的变量或字段: "${varName}"，计算时可能返回 null`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function validateSalaryFormula(formula: string): boolean {
  const result = validateFormula(formula, 'salary_formula')
  return result.valid
}

export function validateConditionFormula(formula: string): boolean {
  if (!formula || formula.trim() === '') return true

  // 条件公式允许更灵活的语法
  const trimmed = formula.trim()

  // 简单的布尔表达式
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*(>=|<=|!=|==|>|<)\s*.+$/.test(trimmed)) {
    return true
  }

  // if 函数
  const ifPattern = /if\s*\(.+,.+[,)].*/i
  if (ifPattern.test(trimmed)) {
    return true
  }

  return validateFormula(formula, 'condition').valid
}

export interface ComponentFormulaCheck {
  componentId: number
  componentName: string
  formula: string
  result: FormulaValidationResult
}

export function validateStructureFormulas(
  components: Array<{ id: number; name: string; formula?: string | null }>
): ComponentFormulaCheck[] {
  return components
    .filter(c => c.formula)
    .map(c => ({
      componentId: c.id,
      componentName: c.name,
      formula: c.formula!,
      result: validateFormula(c.formula!, `组件 "${c.name}" 的公式`),
    }))
    .filter(r => !r.result.valid || r.result.warnings.length > 0)
}

export function testFormula(
  formula: string,
  variables: Record<string, number>
): { success: boolean; result?: number; error?: string } {
  try {
    if (!formula || formula.trim() === '') {
      return { success: true, result: 0 }
    }

    const trimmed = formula.trim()

    // 替换变量
    let expression = trimmed
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      expression = expression.replace(regex, String(value))
    }

    // 安全检查：只允许数字、运算符和括号
    const safeExpression = expression.replace(/[\d.]+/g, 'N').replace(/[+\-*/%()]/g, 'O')

    // 简单的 eval 安全检查
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s*\(/,
      /process\./,
      /eval\s*\(/,
      /Function\s*\(/,
      /[;]/,
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        return { success: false, error: '公式包含不安全的表达式' }
      }
    }

    // 使用 Function 构造函数进行安全计算
    const fn = new Function(`'use strict'; return (${expression})`)
    const result = fn()

    if (typeof result !== 'number' || !isFinite(result)) {
      return { success: false, error: '公式计算结果无效' }
    }

    return { success: true, result: Math.round(result * 100) / 100 }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '公式计算错误',
    }
  }
}
