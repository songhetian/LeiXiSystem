/**
 * Excel Export Utilities
 * Provides functions to export data to Excel format
 */

const ExcelJS = require('exceljs');

/**
 * Export vacation balance data to Excel
 */
async function exportVacationBalances(data, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('假期余额');

  // Set column headers
  worksheet.columns = [
    { header: '工号', key: 'employee_no', width: 12 },
    { header: '姓名', key: 'real_name', width: 12 },
    { header: '部门', key: 'department_name', width: 15 },
    { header: '年度', key: 'year', width: 10 },
    { header: '年假总额', key: 'annual_leave_total', width: 12 },
    { header: '年假已用', key: 'annual_leave_used', width: 12 },
    { header: '年假余额', key: 'annual_leave_remaining', width: 12 },
    { header: '加班假总额', key: 'overtime_leave_total', width: 12 },
    { header: '加班假已用', key: 'overtime_leave_used', width: 12 },
    { header: '加班假余额', key: 'overtime_leave_remaining', width: 12 },
    { header: '病假总额', key: 'sick_leave_total', width: 12 },
    { header: '病假已用', key: 'sick_leave_used', width: 12 },
    { header: '病假余额', key: 'sick_leave_remaining', width: 12 },
    { header: '加班时长(小时)', key: 'overtime_hours_remaining', width: 15 },
    { header: '总假期额度', key: 'total_days', width: 12 },
    { header: '有效期', key: 'expiry_date', width: 12 }
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add data rows
  data.forEach(item => {
    worksheet.addRow({
      employee_no: item.employee_no,
      real_name: item.real_name,
      department_name: item.department_name,
      year: item.year,
      annual_leave_total: item.annual_leave_total || 0,
      annual_leave_used: item.annual_leave_used || 0,
      annual_leave_remaining: item.annual_leave_remaining || 0,
      overtime_leave_total: item.overtime_leave_total || 0,
      overtime_leave_used: item.overtime_leave_used || 0,
      overtime_leave_remaining: item.overtime_leave_remaining || 0,
      sick_leave_total: item.sick_leave_total || 0,
      sick_leave_used: item.sick_leave_used || 0,
      sick_leave_remaining: item.sick_leave_remaining || 0,
      overtime_hours_remaining: item.overtime_hours_remaining || 0,
      total_days: item.total_days || 0,
      expiry_date: item.expiry_date || ''
    });
  });

  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  return workbook;
}

/**
 * Export vacation change history to Excel
 */
async function exportVacationHistory(data, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('变更历史');

  // Set column headers
  worksheet.columns = [
    { header: '时间', key: 'created_at', width: 20 },
    { header: '工号', key: 'employee_no', width: 12 },
    { header: '姓名', key: 'real_name', width: 12 },
    { header: '变更类型', key: 'change_type', width: 12 },
    { header: '假期类型', key: 'leave_type', width: 12 },
    { header: '变更数量', key: 'amount', width: 12 },
    { header: '变更后余额', key: 'balance_after', width: 12 },
    { header: '原因', key: 'reason', width: 30 },
    { header: '操作人', key: 'operator_name', width: 12 }
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add data rows
  data.forEach(item => {
    const row = worksheet.addRow({
      created_at: item.created_at,
      employee_no: item.employee_no || '',
      real_name: item.real_name || '',
      change_type: getChangeTypeText(item.change_type),
      leave_type: getLeaveTypeText(item.leave_type),
      amount: item.amount,
      balance_after: item.balance_after,
      reason: item.reason || '',
      operator_name: item.operator_name || ''
    });

    // Color code amount cell
    const amountCell = row.getCell('amount');
    if (parseFloat(item.amount) > 0) {
      amountCell.font = { color: { argb: 'FF00B050' } };
    } else if (parseFloat(item.amount) < 0) {
      amountCell.font = { color: { argb: 'FFFF0000' } };
    }
  });

  // Add borders
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  return workbook;
}

function getChangeTypeText(type) {
  const map = {
    'addition': '增加',
    'deduction': '扣减',
    'conversion': '转换',
    'adjustment': '调整'
  };
  return map[type] || type;
}

function getLeaveTypeText(type) {
  const map = {
    'annual_leave': '年假',
    'sick_leave': '病假',
    'overtime_leave': '加班假',
    'personal_leave': '事假',
    'marriage_leave': '婚假',
    'maternity_leave': '产假'
  };
  return map[type] || type;
}

module.exports = {
  exportVacationBalances,
  exportVacationHistory
};
