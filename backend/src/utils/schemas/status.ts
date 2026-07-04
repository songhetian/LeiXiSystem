import { z } from 'zod'

// Leave statuses
export const leaveStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled'])

// Overtime request statuses
export const overtimeStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled'])

// Payslip statuses
export const payslipStatusSchema = z.enum(['draft', 'calculated', 'published', 'viewed', 'confirmed'])

// Payroll run statuses
export const payrollRunStatusSchema = z.enum(['draft', 'calculated', 'published'])

// Payroll adjustment statuses
export const adjustmentStatusSchema = z.enum(['pending', 'approved', 'rejected'])

// Helpdesk ticket statuses
export const helpdeskTicketStatusSchema = z.enum(['open', 'processing', 'resolved', 'closed', 'cancelled'])

// Helpdesk ticket priority
export const helpdeskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])

// Performance review statuses
export const performanceReviewStatusSchema = z.enum(['draft', 'self_submitted', 'reviewed', 'confirmed'])

// Promotion recommendation
export const promotionRecommendationSchema = z.enum(['promoted', 'pending', 'demoted', 'none'])

// Candidate statuses
export const candidateStatusSchema = z.enum(['new', 'screening', 'interviewing', 'offered', 'hired', 'rejected'])

// Attendance exception request status (pending/approved/rejected)
export const attendanceExceptionRequestStatusSchema = z.enum(['pending', 'approved', 'rejected'])

// Attendance exception resolution status (resolved/rejected - after handling)
export const attendanceExceptionResolutionStatusSchema = z.enum(['resolved', 'rejected'])

// Salary structure / assignment statuses
export const salaryStatusSchema = z.enum(['active', 'inactive'])

// Employee status
export const employeeStatusSchema = z.enum(['probation', 'formal', 'contract', 'terminated'])

// Contract status
export const contractStatusSchema = z.enum(['draft', 'active', 'expired', 'terminated'])

// Onboarding/offboarding event status
export const eventStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled'])

// Payroll dispute status
export const disputeStatusSchema = z.enum(['pending', 'resolved', 'rejected'])

// Job request status (recruitment)
export const jobRequestStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected', 'closed'])

// Job opening status (recruitment)
export const jobOpeningStatusSchema = z.enum(['draft', 'open', 'paused', 'closed'])

// Interview result (recruitment)
export const interviewResultSchema = z.enum(['pending', 'passed', 'failed', 'cancelled'])

// Offer status (recruitment)
export const offerStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected', 'cancelled'])

// Performance cycle status
export const performanceCycleStatusSchema = z.enum(['draft', 'active', 'closed'])

// Goal status
export const goalStatusSchema = z.enum(['active', 'completed', 'cancelled'])

// Check-in status
export const checkInStatusSchema = z.enum(['normal', 'late', 'early', 'absent', 'leave'])

// Attendance correction log type
export const correctionLogTypeSchema = z.enum(['in', 'out'])

// Attendance exception status (for disputes/resolution)
export const attendanceExceptionStatusSchema = z.enum(['resolved', 'rejected'])
