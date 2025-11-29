// 生成质检会话测试Excel文件
// 使用数据库中的真实数据作为样本

const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// 数据库配置
const dbConfig = {
    host: 'localhost',
    user: 'tian',
    password: 'tian',
    database: 'leixin_customer_service'
};

async function generateTestExcel() {
    let connection;

    try {
        // 连接数据库
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ 数据库连接成功');

        // 查询真实的质检会话数据
        const [sessions] = await connection.execute(`
            SELECT
                qs.session_no,
                qs.agent_id,
                qs.customer_id,
                qs.channel,
                qs.start_time,
                qs.end_time,
                qs.duration,
                qs.message_count,
                p.name as platform_name,
                s.name as shop_name
            FROM quality_sessions qs
            LEFT JOIN platforms p ON qs.platform_id = p.id
            LEFT JOIN shops s ON qs.shop_id = s.id
            LIMIT 20
        `);

        console.log(`✅ 查询到 ${sessions.length} 条会话数据`);

        // 创建工作簿
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('质检会话数据');

        // 设置列
        worksheet.columns = [
            { header: '会话编号', key: 'session_no', width: 20 },
            { header: '客服ID', key: 'agent_id', width: 12 },
            { header: '客户ID', key: 'customer_id', width: 15 },
            { header: '沟通渠道', key: 'channel', width: 12 },
            { header: '开始时间', key: 'start_time', width: 20 },
            { header: '结束时间', key: 'end_time', width: 20 },
            { header: '时长(秒)', key: 'duration', width: 12 },
            { header: '消息数量', key: 'message_count', width: 12 },
        ];

        // 设置表头样式
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // 添加数据
        sessions.forEach(session => {
            worksheet.addRow({
                session_no: session.session_no,
                agent_id: session.agent_id,
                customer_id: session.customer_id,
                channel: session.channel,
                start_time: session.start_time,
                end_time: session.end_time,
                duration: session.duration,
                message_count: session.message_count
            });
        });

        // 添加数据验证和格式
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                // 设置边框
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });

                // 设置时间格式
                row.getCell('start_time').numFmt = 'yyyy-mm-dd hh:mm:ss';
                row.getCell('end_time').numFmt = 'yyyy-mm-dd hh:mm:ss';
            }
        });

        // 创建输出目录
        const outputDir = path.join(__dirname, '../public/templates');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 保存文件
        const filename = `质检会话测试数据_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filepath = path.join(outputDir, filename);
        await workbook.xlsx.writeFile(filepath);

        console.log(`✅ Excel文件已生成: ${filepath}`);
        console.log(`📊 包含 ${sessions.length} 条测试数据`);

        // 同时生成一个空模板
        const templateWorkbook = new ExcelJS.Workbook();
        const templateWorksheet = templateWorkbook.addWorksheet('质检会话数据');

        templateWorksheet.columns = [
            { header: '会话编号', key: 'session_no', width: 20 },
            { header: '客服ID', key: 'agent_id', width: 12 },
            { header: '客户ID', key: 'customer_id', width: 15 },
            { header: '沟通渠道', key: 'channel', width: 12 },
            { header: '开始时间', key: 'start_time', width: 20 },
            { header: '结束时间', key: 'end_time', width: 20 },
            { header: '时长(秒)', key: 'duration', width: 12 },
            { header: '消息数量', key: 'message_count', width: 12 },
        ];

        // 设置表头样式
        templateWorksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        templateWorksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        templateWorksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // 添加示例行
        templateWorksheet.addRow({
            session_no: 'JD20251129001',
            agent_id: '1',
            customer_id: 'CUST001',
            channel: 'chat',
            start_time: '2025-11-29 10:00:00',
            end_time: '2025-11-29 10:15:00',
            duration: 900,
            message_count: 25
        });

        // 添加说明行
        const noteRow = templateWorksheet.addRow({
            session_no: '说明：',
            agent_id: '必填',
            customer_id: '必填',
            channel: 'chat/phone/email/video',
            start_time: 'YYYY-MM-DD HH:MM:SS',
            end_time: 'YYYY-MM-DD HH:MM:SS',
            duration: '单位：秒',
            message_count: '整数'
        });
        noteRow.font = { italic: true, color: { argb: 'FF808080' } };

        const templateFilename = '质检会话导入模板.xlsx';
        const templateFilepath = path.join(outputDir, templateFilename);
        await templateWorkbook.xlsx.writeFile(templateFilepath);

        console.log(`✅ 模板文件已生成: ${templateFilepath}`);

    } catch (error) {
        console.error('❌ 生成Excel文件失败:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('✅ 数据库连接已关闭');
        }
    }
}

// 执行脚本
generateTestExcel()
    .then(() => {
        console.log('\n🎉 所有文件生成完成！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ 脚本执行失败:', error);
        process.exit(1);
    });
