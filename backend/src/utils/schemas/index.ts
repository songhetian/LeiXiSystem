// Shared query schemas used across multiple modules
import { z } from 'zod'
import { dateStringSchema, optionalKeywordSchema, statusSchema as genericStatusSchema } from '../validation'

// Re-export generic statusSchema for backward compatibility
export { genericStatusSchema as statusSchema }

// Re-export all specific status enums
export {
  leaveStatusSchema,
  overtimeStatusSchema,
  adjustmentStatusSchema,
  helpdeskTicketStatusSchema,
  helpdeskPrioritySchema,
  performanceReviewStatusSchema,
  promotionRecommendationSchema,
  candidateStatusSchema,
  attendanceExceptionRequestStatusSchema,
  attendanceExceptionResolutionStatusSchema,
  salaryStatusSchema,
  employeeStatusSchema,
  contractStatusSchema,
  eventStatusSchema,
  disputeStatusSchema,
  jobRequestStatusSchema,
  jobOpeningStatusSchema,
  interviewResultSchema,
  offerStatusSchema,
  performanceCycleStatusSchema,
  goalStatusSchema,
  checkInStatusSchema,
  correctionLogTypeSchema,
} from './status'

/**
 * Shared task list query schema (lifecycle events/tasks/documents/contracts)
 * Fields: page, pageSize, employeeId, status
 */
export const taskListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  status: genericStatusSchema,
})

/**
 * Shared date range query schema (attendance records/checkins/corrections/exceptions)
 * Fields: page, pageSize, keyword, departmentId, employeeId, startDate, endDate, status
 */
export const dateRangeBaseQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  status: genericStatusSchema,
}).refine(
  (value) => !value.startDate || !value.endDate || new Date(value.startDate) <= new Date(value.endDate),
  { message: '开始日期不能晚于结束日期' }
)

/**
 * Opinion schema for approval/rejection actions
 */
export const opinionSchema = z.object({
  opinion: z.string().trim().max(1000).optional(),
})
