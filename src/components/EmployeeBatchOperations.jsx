import React, { useState } from 'react'
import { toast } from 'sonner';
import { getApiUrl } from '../utils/apiConfig'
import { saveAs } from 'file-saver'

export default function EmployeeBatchOperations({ onImportSuccess }) {
  const [importing, setImporting] = useState(false)

  // 获取所有部门和职位用于下拉框
  const fetchTemplateData = async () => {
    try {
      const token = localStorage.getItem('token')
      const [deptRes, posRes] = await Promise.all([
        fetch(getApiUrl('/api/departments/all'), { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(getApiUrl('/api/positions?limit=1000'), { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!deptRes.ok || !posRes.ok) throw new Error('获取数据失败');

      const deptData = await deptRes.json();
      const posData = await posRes.json();

      const departments = Array.isArray(deptData.data) ? deptData.data : (Array.isArray(deptData) ? deptData : []);
      const positions = Array.isArray(posData.data) ? posData.data : (Array.isArray(posData) ? posData : []);

      return {
        departments: departments.filter(d => d.status !== 'deleted').map(d => d.name),
        positions: positions.map(p => p.name)
      };
    } catch (error) {
      console.error('获取模板基础数据失败:', error);
      return { departments: [], positions: [] };
    }
  }

  // 下载导入模板 (XLSX 格式含下拉框)
  const handleDownloadTemplate = async () => {
    try {
      const { departments, positions } = await fetchTemplateData();
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('员工导入');
      const dataSheet = workbook.addWorksheet('数据源'); // 数据源工作表
      dataSheet.state = 'hidden';

      // 准备数据源
      if (departments.length > 0) {
        departments.forEach((dept, index) => {
          dataSheet.getCell(`A${index + 1}`).value = dept;
        });
      }
      if (positions.length > 0) {
        positions.forEach((pos, index) => {
          dataSheet.getCell(`B${index + 1}`).value = pos;
        });
      }

      // 定义列和表头
      worksheet.columns = [
        { header: '姓名*', key: 'real_name', width: 15 },
        { header: '部门名称*', key: 'department_name', width: 20 },
        { header: '职位', key: 'position', width: 20 },
        { header: '手机', key: 'phone', width: 15 },
        { header: '入职日期*', key: 'hire_date', width: 15 }
      ];

      // 设置表头样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // 添加示例行
      worksheet.addRow({
        real_name: '张三',
        department_name: departments.length > 0 ? departments[0] : '示例部门',
        position: positions.length > 0 ? positions[0] : '示例职位',
        phone: '13800138000',
        hire_date: new Date().toISOString().split('T')[0]
      });

      // 配置数据验证 (下拉框) - 预设 100 行
      for (let i = 2; i <= 101; i++) {
        // 部门下拉框 (Column B)
        if (departments.length > 0) {
          worksheet.getCell(`B${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`'数据源'!$A$1:$A$${departments.length}`]
          };
        }

        // 职位下拉框 (Column C)
        if (positions.length > 0) {
          worksheet.getCell(`C${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`'数据源'!$B$1:$B$${positions.length}`]
          };
        }

        // 日期提示 (Column E)
        worksheet.getCell(`E${i}`).note = '格式要求：YYYY-MM-DD';
      }

      // 导出文件
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `员工导入模板_${new Date().getTime()}.xlsx`);

      toast.success('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      toast.error('下载模板失败');
    }
  }

  // 批量导出员工 (XLSX)
  const handleBatchExport = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/employees'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('获取员工数据失败');
      const employees = await response.json();

      if (employees.length === 0) {
        toast.warning('没有员工数据可导出');
        return;
      }

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('员工列表');

      const headers = [
        { header: '工号', key: 'employee_no', width: 12 },
        { header: '姓名', key: 'real_name', width: 15 },
        { header: '登录账号', key: 'username', width: 20 },
        { header: '部门', key: 'department_name', width: 20 },
        { header: '职位', key: 'position', width: 15 },
        { header: '手机', key: 'phone', width: 15 },
        { header: '邮箱', key: 'email', width: 20 },
        { header: '入职日期', key: 'hire_date', width: 15 },
        { header: '状态', key: 'status', width: 10 },
        { header: '星级', key: 'rating', width: 10 },
        { header: '备注', key: 'remark', width: 30 }
      ];

      worksheet.columns = headers;
      worksheet.getRow(1).font = { bold: true };

      employees.forEach(emp => {
        worksheet.addRow({
          employee_no: emp.employee_no,
          real_name: emp.real_name,
          username: emp.username,
          department_name: emp.department_name,
          position: emp.position,
          phone: emp.phone,
          email: emp.email,
          hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
          status: emp.status,
          rating: emp.rating,
          remark: emp.remark
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `员工列表_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success(`成功导出 ${employees.length} 名员工`);
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败：' + error.message);
    }
  }

  // 批量导入员工 (XLSX)
  const handleBatchImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx')) {
      toast.error('请选择 Excel 文件');
      return
    }

    try {
      setImporting(true)
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file);
      const worksheet = workbook.getWorksheet(1);

      const employees = [];
      worksheet.eachRow((row, rowNumber) => {
        // 获取单元格值
        const nameVal = row.getCell(1).value;

        // 跳过表头：检查第一行或者是表头文本
        if (rowNumber === 1 || nameVal === '姓名*') return;

        // 跳过示例行 (如果用户没改的话)
        if (nameVal === '张三' && row.getCell(4).value === '13800138000') return;

        // 过滤空行
        if (!nameVal) return;

        const deptVal = row.getCell(2).value;
        const posVal = row.getCell(3).value;
        const phoneVal = row.getCell(4).value;
        const hireDateVal = row.getCell(5).value;

        employees.push({
          real_name: nameVal?.toString().trim(),
          department_name: deptVal?.toString().trim(),
          position: posVal?.toString().trim() || null,
          phone: phoneVal?.toString().trim() || null,
          hire_date: hireDateVal instanceof Date ? hireDateVal.toISOString().split('T')[0] : hireDateVal?.toString().trim(),
          status: 'active'
        });
      });

      if (employees.length === 0) {
        toast.error('没有有效的员工数据');
        return
      }

      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/employees/batch-import'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ employees })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`成功导入 ${result.successCount} 名员工${result.failCount > 0 ? `，失败 ${result.failCount} 名` : ''}`)
        if (onImportSuccess) onImportSuccess()
      } else {
        toast.error('导入失败：' + result.message)
      }
    } catch (error) {
      console.error('导入失败:', error)
      toast.error('导入失败：' + error.message)
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }


  return (
    <div className="flex gap-2">
      <button
        onClick={handleDownloadTemplate}
        className="px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-all"
      >
        下载导入模板
      </button>

      <label className="px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-all cursor-pointer">
        {importing ? '导入中...' : '批量导入'}
        <input
          type="file"
          accept=".xlsx"
          onChange={handleBatchImport}
          disabled={importing}
          className="hidden"
        />
      </label>

      <button
        onClick={handleBatchExport}
        className="px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-all"
      >
        批量导出
      </button>
    </div>
  )
}
