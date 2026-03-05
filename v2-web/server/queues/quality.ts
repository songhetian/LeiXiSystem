import ExcelJS from 'exceljs';
import { Job } from 'bullmq';
import { prisma } from '../app';
import { registerWorker, QueueNames } from './base';

const getColValue = (rowData: any, possibleNames: string[]) => {
  const foundName = possibleNames.find(name => rowData[name] !== undefined);
  return foundName ? rowData[foundName] : null;
};

export const qualityImportWorker = registerWorker(QueueNames.IMPORT_QUALITY, async (job: Job) => {
  const { fileBuffer, platformId, shopId } = job.data;
  const buffer = Buffer.from(fileBuffer, 'base64');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sessionSheet = workbook.getWorksheet('会话信息') || workbook.getWorksheet(1);
  const messageSheet = workbook.getWorksheet('聊天记录') || workbook.getWorksheet(2);

  if (!sessionSheet) throw new Error('Missing session sheet');

  // 解析消息逻辑 (保持不变)
  const messagesMap = new Map<string, any[]>();
  if (messageSheet) {
    const messageHeaders: any[] = [];
    messageSheet.getRow(1).eachCell((cell, colNumber) => {
      messageHeaders[colNumber] = cell.value?.toString().trim();
    });

    messageSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: any = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = messageHeaders[colNumber];
        if (header) rowData[header] = cell.value;
      });

      const sessionNo = getColValue(rowData, ['会话编号', '会话ID', 'SessionNo']);
      const content = getColValue(rowData, ['消息内容', '内容', 'Message']);
      
      if (sessionNo && content) {
        const key = sessionNo.toString().trim();
        if (!messagesMap.has(key)) messagesMap.set(key, []);
        messagesMap.get(key)!.push({
          sender_type: (getColValue(rowData, ['发送者类型', '角色'])?.toString() || '').includes('客') ? 'customer' : 'agent',
          sender_name: getColValue(rowData, ['发送者姓名', '昵称'])?.toString() || '',
          content: content.toString(),
          timestamp: getColValue(rowData, ['发送时间', '时间']) || new Date()
        });
      }
    });
  }

  // 规约执行：使用事务保证逻辑闭环
  let successCount = 0;
  const sessionRows: any[] = [];
  sessionSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData: any = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = sessionSheet.getRow(1).getCell(colNumber).value?.toString().trim();
      if (header) rowData[header] = cell.value;
    });
    sessionRows.push(rowData);
  });

  for (const rowData of sessionRows) {
    try {
      await prisma.$transaction(async (tx) => {
        const originalNo = getColValue(rowData, ['会话编号', '会话ID'])?.toString().trim();
        const agentName = getColValue(rowData, ['客服姓名', '客服'])?.toString().trim();
        
        let agentId: number | null = null;
        let externalAgentId: number | null = null;

        if (agentName) {
          const internal = await tx.users.findFirst({
            where: { real_name: agentName, employees: { some: { status: 'active' } } }
          });
          if (internal) {
            agentId = internal.id;
          } else {
            const ext = await tx.external_agents.upsert({
              where: { uk_name_platform_shop: { name: agentName, platform_id: platformId, shop_id: shopId } },
              update: {},
              create: { name: agentName, platform_id: platformId, shop_id: shopId }
            });
            externalAgentId = ext.id;
          }
        }

        const session = await tx.quality_sessions.create({
          data: {
            session_no: `QS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            agent_id: agentId,
            external_agent_id: externalAgentId,
            agent_name: agentName,
            customer_name: getColValue(rowData, ['客户姓名', '客户']),
            platform_id: platformId,
            shop_id: shopId,
            status: 'pending',
            start_time: getColValue(rowData, ['开始时间', 'Start']),
            end_time: getColValue(rowData, ['结束时间', 'End']),
            duration: Number(getColValue(rowData, ['时长']) || 0),
            message_count: messagesMap.get(originalNo)?.length || 0,
          }
        });

        const messages = messagesMap.get(originalNo) || [];
        if (messages.length > 0) {
          await tx.session_messages.createMany({
            data: messages.map(m => ({
              session_id: session.id,
              ...m
            }))
          });
        }
      });

      successCount++;
      await job.updateProgress(Math.floor((successCount / sessionRows.length) * 100));
    } catch (e) {
      console.error('Row transaction failed:', e);
    }
  }

  return { successCount, total: sessionRows.length };
});
