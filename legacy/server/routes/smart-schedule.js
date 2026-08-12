// 智能排班算法
const ExcelJS = require('exceljs');

module.exports = async function (fastify, opts) {
  // 生成Excel排班方案
  fastify.post('/api/smart-schedule/generate-excel', async (request, reply) => {
    const { departmentId, startDate, endDate, textRules } = request.body;

    try {
      // 获取部门员工（从users表）
      const [employees] = await fastify.mysql.query(
        `SELECT u.id, u.real_name as name, u.username as employee_no
         FROM users u
         WHERE u.department_id = ? AND u.status = 'active'
         ORDER BY u.username`,
        [departmentId]
      );

      // 获取可用班次
      const [shifts] = await fastify.mysql.query(
        `SELECT * FROM work_shifts WHERE is_active = 1 ORDER BY id`
      );

      if (employees.length === 0) {
        return reply.status(400).send({ error: '该部门没有可用的员工' });
      }

      if (shifts.length === 0) {
        return reply.status(400).send({ error: '没有可用的班次' });
      }

      // 生成日期范围
      const dates = generateDateRange(startDate, endDate);

      // 初始化排班表
      const schedule = [];

      // 应用文字规则
      const textRuleMap = {};
      if (textRules && textRules.length > 0) {
        textRules.forEach(rule => {
          const key = `${rule.employee_id}`;
          if (!textRuleMap[key]) {
            textRuleMap[key] = [];
          }
          textRuleMap[key].push(rule);
        });
      }

      // 为每个员工生成排班
      for (const employee of employees) {
        const employeeRules = textRuleMap[employee.id] || [];

        for (const date of dates) {
          const dateObj = new Date(date);
          const day = dateObj.getDate();

          // 检查是否有文字规则
          let appliedRule = null;
          for (const rule of employeeRules) {
            if (day >= rule.start_day && day <= rule.end_day) {
              appliedRule = rule;
              break;
            }
          }

          if (appliedRule) {
            // 应用文字规则
            schedule.push({
              employee_id: employee.id,
              employee_name: employee.name,
              employee_no: employee.employee_no,
              shift_id: appliedRule.shift_id,
              shift_name: appliedRule.action === '休息' ? '休息' : appliedRule.shift_name,
              schedule_date: date,
              is_rest_day: appliedRule.action === '休息'
            });
          } else {
            // 没有规则的日期，也添加到排班表（留空，让用户在Excel中填写）
            schedule.push({
              employee_id: employee.id,
              employee_name: employee.name,
              employee_no: employee.employee_no,
              shift_id: null,
              shift_name: '',
              schedule_date: date,
              is_rest_day: false
            });
          }
        }
      }

      // 创建排班映射：employee_id -> date -> schedule
      const scheduleMap = new Map();
      schedule.forEach(item => {
        const key = `${item.employee_id}_${item.schedule_date}`;
        scheduleMap.set(key, item);
      });

      // 创建Excel工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('排班表');

      // 设置列：工号、姓名、每一天
      const columns = [
        { header: '工号', key: 'employee_no', width: 12 },
        { header: '姓名', key: 'real_name', width: 15 }
      ];

      // 添加日期列（使用实际日期）
      dates.forEach((date, index) => {
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();

        // 获取星期几
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[dateObj.getDay()];

        columns.push({
          header: `${month}/${day}\n${weekday}`,
          key: `date_${index}`,
          width: 10
        });
      });

      // 添加统计列
      columns.push(
        { header: '休息天数', key: 'rest_days', width: 15 },
        { header: '班次统计', key: 'shift_stats', width: 30 }
      );

      worksheet.columns = columns;

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // 添加员工排班数据
      const startRow = 2;
      employees.forEach((emp, index) => {
        const rowNum = startRow + index;
        const row = {
          employee_no: emp.employee_no,
          real_name: emp.name
        };

        // 统计变量
        let restDays = 0;
        const shiftCounts = {};

        // 填充每一天的排班
        dates.forEach((date, dateIndex) => {
          const key = `${emp.id}_${date}`;
          const scheduleItem = scheduleMap.get(key);

          if (scheduleItem) {
            if (scheduleItem.is_rest_day) {
              row[`date_${dateIndex}`] = '休';
              restDays++;
            } else {
              row[`date_${dateIndex}`] = scheduleItem.shift_name;
              // 统计各班次天数
              shiftCounts[scheduleItem.shift_name] = (shiftCounts[scheduleItem.shift_name] || 0) + 1;
            }
          } else {
            row[`date_${dateIndex}`] = '';
          }
        });

        // 添加统计数据到行末尾
        row['rest_days'] = `休息:${restDays}天`;

        // 添加各班次天数统计
        let shiftStats = '';
        for (const [shiftName, count] of Object.entries(shiftCounts)) {
          shiftStats += `${shiftName}:${count}天 `;
        }
        row['shift_stats'] = shiftStats.trim();

        worksheet.addRow(row);

        // 为每个日期单元格添加下拉列表
        dates.forEach((date, dateIndex) => {
          const colIndex = dateIndex + 3; // +3 因为前两列是工号和姓名，从第3列开始
          const cellAddress = worksheet.getColumn(colIndex).letter + rowNum;

          // 创建下拉列表选项：休 + 班次名称
          const dropdownOptions = ['休', ...shifts.map(s => s.name)];

          worksheet.getCell(cellAddress).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${dropdownOptions.join(',')}"`],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: '无效的班次',
            error: `请从下拉列表中选择班次：${dropdownOptions.join('、')}`
          };
        });
      });

      // 添加说明行
      worksheet.addRow({});
      const noteRow = worksheet.addRow({
        employee_no: '填写说明：',
        real_name: `请在日期单元格中使用下拉列表选择班次。班次列表：${shifts.map(s => s.name).join('、')}、休息`
      });
      noteRow.font = { italic: true, color: { argb: 'FF0066CC' } };

      // 添加班次对照表
      worksheet.addRow({});
      const mappingHeaderRow = worksheet.addRow({
        employee_no: '班次对照表',
        real_name: '（导入时使用）'
      });
      mappingHeaderRow.font = { bold: true, color: { argb: 'FFFF6600' } };

      shifts.forEach(shift => {
        worksheet.addRow({
          employee_no: shift.name,
          real_name: `代码: ${shift.id}`
        });
      });

      // 生成Excel文件
      const buffer = await workbook.xlsx.writeBuffer();

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="schedule_${startDate}_${endDate}.xlsx"`)
        .send(buffer);

    } catch (error) {
      console.error('生成Excel失败:', error);
      reply.status(500).send({ error: '生成Excel失败: ' + error.message });
    }
  });
};

// 生成日期范围
function generateDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(new Date(current).toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
