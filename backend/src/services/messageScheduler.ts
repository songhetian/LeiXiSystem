import prisma from '../prisma'
import { sendMessage } from './messageCenter'

let schedulerInterval: NodeJS.Timeout | null = null
let isRunning = false

// 简单的 cron 解析（支持: 每分钟/每小时/每天/每周）
function shouldRunNow(cronExpression: string): boolean {
  const now = new Date()
  const minute = now.getMinutes()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  const dayOfMonth = now.getDate()

  const parts = cronExpression.split(' ')
  if (parts.length < 5) return false

  const [min, hourExp, dayOfMonthExp, monthExp, dayOfWeekExp] = parts

  // 检查分钟
  if (min !== '*' && min !== String(minute)) return false

  // 检查小时
  if (hourExp !== '*' && !matchCronField(hourExp, hour)) return false

  // 检查月份
  if (monthExp !== '*' && !matchCronField(monthExp, monthExp === '*' ? now.getMonth() + 1 : null as any)) return false

  // 检查日期/星期（互斥）
  if (dayOfMonthExp !== '*' && dayOfWeekExp === '*') {
    if (!matchCronField(dayOfMonthExp, dayOfMonth)) return false
  } else if (dayOfWeekExp !== '*' && dayOfMonthExp === '*') {
    if (!matchCronField(dayOfWeekExp, dayOfWeek)) return false
  }

  return true
}

function matchCronField(expression: string, value: number): boolean {
  if (expression === '*') return true

  // 处理列表 "1,2,3"
  if (expression.includes(',')) {
    return expression.split(',').some(part => matchCronField(part.trim(), value))
  }

  // 处理范围 "1-5"
  if (expression.includes('-')) {
    const [start, end] = expression.split('-').map(Number)
    return value >= start && value <= end
  }

  // 处理步长 "*/5"
  if (expression.startsWith('*/')) {
    const step = parseInt(expression.slice(2))
    return value % step === 0
  }

  return parseInt(expression) === value
}

function getNextScheduledTime(cronExpression: string, after: Date): Date {
  const next = new Date(after)
  next.setSeconds(0)
  next.setMilliseconds(0)

  // 简单实现：默认 1 分钟
  next.setMinutes(next.getMinutes() + 1)
  return next
}

async function processScheduledTasks() {
  if (isRunning) return
  isRunning = true

  try {
    const now = new Date()

    // 处理定时任务（scheduled）
    const scheduledTasks = await prisma.messageSendTask.findMany({
      where: {
        status: 'pending',
        sendMode: 'scheduled',
        scheduledAt: { lte: now },
      },
    })

    for (const task of scheduledTasks) {
      await processTask(task)
    }

    // 处理周期性任务（recurring）
    const recurringTasks = await prisma.messageSendTask.findMany({
      where: {
        status: 'pending',
        sendMode: 'recurring',
        cronExpression: { not: null },
      },
    })

    for (const task of recurringTasks) {
      if (task.cronExpression && shouldRunNow(task.cronExpression)) {
        // 检查是否已过结束时间
        if (task.repeatEndAt && now > task.repeatEndAt) {
          await prisma.messageSendTask.update({
            where: { id: task.id },
            data: { status: 'completed' },
          })
          continue
        }
        await processTask(task)
      }
    }
  } catch (err) {
    console.error('[MessageScheduler] 处理定时任务出错:', err)
  } finally {
    isRunning = false
  }
}

async function processTask(task: any) {
  try {
    await prisma.messageSendTask.update({
      where: { id: task.id },
      data: { status: 'sending' },
    })

    const attachments = await prisma.messageAttachment.findMany({
      where: { taskId: task.id },
      select: { fileName: true, fileUrl: true, fileSize: true, fileType: true },
    })

    const result = await sendMessage({
      title: task.title,
      content: task.content,
      type: task.type,
      priority: task.priority,
      targetType: task.targetType,
      targetConfig: task.targetConfig as any,
      requiresConfirm: task.requiresConfirm,
      sendTaskId: task.id,
      attachments,
    })

    // 如果是周期性任务，计算下次执行时间
    if (task.sendMode === 'recurring' && task.cronExpression) {
      const nextTime = getNextScheduledTime(task.cronExpression, new Date())
      await prisma.messageSendTask.update({
        where: { id: task.id },
        data: {
          status: 'pending',
          scheduledAt: nextTime,
          sentCount: { increment: result.sentCount },
          readCount: { increment: result.sentCount }, // 临时，实际从 recipient 读取
        },
      })
    } else {
      await prisma.messageSendTask.update({
        where: { id: task.id },
        data: {
          status: 'sent',
          sentCount: result.sentCount,
          sentAt: new Date(),
        },
      })
    }

    console.log(`[MessageScheduler] 任务 ${task.id} 发送完成，共 ${result.sentCount} 人`)
  } catch (err) {
    console.error(`[MessageScheduler] 任务 ${task.id} 发送失败:`, err)
    await prisma.messageSendTask.update({
      where: { id: task.id },
      data: { status: 'failed' },
    }).catch(() => {})
  }
}

// 清理过期去重记录（每天凌晨执行一次）
async function cleanupDeduplicationRecords() {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await prisma.messageDeduplication.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
    })

    if (result.count > 0) {
      console.log(`[MessageScheduler] 清理了 ${result.count} 条过期去重记录`)
    }
  } catch (err) {
    console.error('[MessageScheduler] 清理去重记录失败:', err)
  }
}

export function startMessageScheduler() {
  if (schedulerInterval) {
    console.warn('[MessageScheduler] 调度器已在运行')
    return
  }

  // 每分钟检查一次
  schedulerInterval = setInterval(async () => {
    await processScheduledTasks()

    // 每天凌晨清理一次
    const now = new Date()
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      await cleanupDeduplicationRecords()
    }
  }, 60 * 1000)

  console.log('[MessageScheduler] 定时消息调度器已启动（每分钟检查一次）')

  // 启动时执行一次
  setImmediate(processScheduledTasks)
}

export function stopMessageScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[MessageScheduler] 定时消息调度器已停止')
  }
}
