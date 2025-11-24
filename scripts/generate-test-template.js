const ExcelJS = require('exceljs');
const path = require('path');

async function generateTestTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('试题模板');

  // 设置列
  sheet.columns = [
    { header: '题型', key: 'type', width: 16 },
    { header: '题干', key: 'content', width: 60 },
    { header: '选项A', key: 'optA', width: 20 },
    { header: '选项B', key: 'optB', width: 20 },
    { header: '选项C', key: 'optC', width: 20 },
    { header: '选项D', key: 'optD', width: 20 },
    { header: '正确答案', key: 'answer', width: 14 },
    { header: '分值', key: 'score', width: 10 },
    { header: '答案解析', key: 'explanation', width: 40 }
  ];

  // 添加数据验证
  const typeList = '单选题,多选题,判断题,填空题,简答题';
  for (let row = 2; row <= 100; row++) {
    sheet.getCell(`A${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${typeList}"`]
    };
  }

  // 添加测试数据
  sheet.addRow({
    type: '单选题',
    content: 'JavaScript中哪个方法用于向数组末尾添加元素？',
    optA: 'push()',
    optB: 'pop()',
    optC: 'shift()',
    optD: 'unshift()',
    answer: 'A',
    score: 10,
    explanation: 'push()方法用于向数组末尾添加一个或多个元素'
  });

  sheet.addRow({
    type: '多选题',
    content: '以下哪些是JavaScript的数据类型？',
    optA: 'String',
    optB: 'Number',
    optC: 'Boolean',
    optD: 'Array',
    answer: 'ABC',
    score: 15,
    explanation: 'String、Number、Boolean是基本数据类型,Array是引用类型'
  });

  sheet.addRow({
    type: '判断题',
    content: 'null和undefined在JavaScript中是相等的(==)',
    optA: '正确',
    optB: '错误',
    answer: 'A',
    score: 5,
    explanation: 'null == undefined 返回true,但 null === undefined 返回false'
  });

  sheet.addRow({
    type: '填空题',
    content: '在JavaScript中,使用___关键字声明常量',
    score: 10,
    explanation: '答案是const'
  });

  sheet.addRow({
    type: '简答题',
    content: '请简述JavaScript中闭包的概念和作用',
    score: 20,
    explanation: '闭包是指有权访问另一个函数作用域中变量的函数。主要作用包括:1.数据私有化 2.保持变量在内存中 3.实现模块化'
  });

  // 添加使用说明工作表
  const guide = workbook.addWorksheet('使用说明');
  guide.getCell('A1').value = '试题导入模板使用说明';
  guide.getCell('A1').font = { bold: true, size: 14 };
  guide.getCell('A2').value = '1. 题型请使用下拉框选择：单选题/多选题/判断题/填空题/简答题';
  guide.getCell('A3').value = '2. 单选/多选题需填写选项A-D；判断题选项固定为"正确/错误"';
  guide.getCell('A4').value = '3. 正确答案：单选/判断题用 A/B；多选题用如 ABC；填空/简答无需填写';
  guide.getCell('A5').value = '4. 分值为正整数；建议每题 5~20 分';
  guide.getCell('A6').value = '5. 导入模式：题目将追加到试卷现有题目后面，不会覆盖原有题目';
  guide.getCell('A7').value = '6. 保存为 .xlsx 格式后，在试题管理页面的"试题导入"中上传';
  guide.getCell('A8').value = '7. 本模板包含5道示例题目，可以直接导入测试';

  // 保存文件
  const outputPath = path.join(__dirname, '试题导入测试模板.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log('✅ 测试模板已生成:', outputPath);
  console.log('📝 包含5道示例题目:');
  console.log('   - 1道单选题 (10分)');
  console.log('   - 1道多选题 (15分)');
  console.log('   - 1道判断题 (5分)');
  console.log('   - 1道填空题 (10分)');
  console.log('   - 1道简答题 (20分)');
  console.log('   总分: 60分');
}

generateTestTemplate().catch(console.error);
