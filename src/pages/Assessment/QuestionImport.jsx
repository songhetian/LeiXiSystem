import React, { useState } from 'react';
import { Card, Button, Upload, Table, message, Space, Tag, Popconfirm } from 'antd';
import { UploadOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import ExcelJS from 'exceljs';

const QuestionImport = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [fileList, setFileList] = useState([]);
  const [parsedData, setParsedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importErrors, setImportErrors] = useState([]);

  const handleDownloadTemplate = () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('题目导入模板');

    worksheet.columns = [
      { header: '题型 (type)', key: 'type', width: 15 },
      { header: '题目内容 (content)', key: 'content', width: 50 },
      { header: '分值 (score)', key: 'score', width: 10 },
      { header: '选项 (options)', key: 'options', width: 40 },
      { header: '正确答案 (correct_answer)', key: 'correct_answer', width: 40 },
      { header: '解析 (explanation)', key: 'explanation', width: 50 },
    ];

    worksheet.addRow({
      type: 'single_choice',
      content: '以下哪个是正确的选项？',
      score: 5,
      options: '["选项A", "选项B", "选项C", "选项D"]',
      correct_answer: '"选项A"',
      explanation: '这是正确选项的解释。',
    });
    worksheet.addRow({
      type: 'multiple_choice',
      content: '以下哪些是正确的选项？',
      score: 10,
      options: '["选项A", "选项B", "选项C", "选项D"]',
      correct_answer: '["选项A", "选项C"]',
      explanation: '这是正确选项的解释。',
    });
    worksheet.addRow({
      type: 'true_false',
      content: '地球是方的。',
      score: 2,
      options: '["true", "false"]',
      correct_answer: 'false',
      explanation: '地球是圆的。',
    });
    worksheet.addRow({
      type: 'fill_blank',
      content: '中国的首都是____。',
      score: 5,
      options: '[]',
      correct_answer: '["北京"]',
      explanation: '北京是中国的首都。',
    });
    worksheet.addRow({
      type: 'essay',
      content: '请简述你对人工智能的理解。',
      score: 20,
      options: '[]',
      correct_answer: '人工智能是...',
      explanation: '参考答案：人工智能是...',
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '题目导入模板.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    }).catch(error => {
      message.error('下载模板失败');
      console.error('Failed to download template:', error);
    });
  };

  const props = {
    onRemove: (file) => {
      const newFileList = fileList.filter((item) => item.uid !== file.uid);
      setFileList(newFileList);
      setParsedData([]);
      setImportErrors([]);
    },
    beforeUpload: (file) => {
      const isXLSX = file.name.endsWith('.xlsx');
      if (!isXLSX) {
        message.error('只能上传 XLSX 文件!');
      }
      const isLt2M = file.size / 1024 / 1024 < 10; // 10MB limit
      if (!isLt2M) {
        message.error('文件大小不能超过 10MB!');
      }
      if (isXLSX && isLt2M) {
        setFileList([file]);
        parseExcel(file);
      }
      return false; // Prevent default upload behavior
    },
    fileList,
  };

  const parseExcel = async (file) => {
    setLoading(true);
    setImportErrors([]);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        const headers = worksheet.getRow(1).values.map(h => {
          // Extract key from header like "题型 (type)" -> "type"
          const match = h.match(/\(([^)]+)\)/);
          return match ? match[1] : h;
        });

        const data = [];
        const errors = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row

          const rowData = {};
          row.eachCell((cell, colNumber) => {
            const headerKey = headers[colNumber - 1];
            if (headerKey) {
              rowData[headerKey] = cell.value;
            }
          });

          // Basic validation
          const { type, content, score, options, correct_answer, explanation } = rowData;
          let isValid = true;
          let rowError = '';

          if (!type || !content || !score) {
            isValid = false;
            rowError += '缺少必填字段 (题型, 题目内容, 分值); ';
          }
          if (isNaN(score) || score <= 0) {
            isValid = false;
            rowError += '分值必须是大于0的数字; ';
          }

          // Type-specific validation
          try {
            switch (type) {
              case 'single_choice':
              case 'multiple_choice':
                if (!options || !correct_answer) {
                  isValid = false;
                  rowError += '选择题必须提供选项和正确答案; ';
                } else {
                  const parsedOptions = JSON.parse(options);
                  if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
                    isValid = false;
                    rowError += '选项必须是包含至少两个元素的JSON数组; ';
                  }
                  const parsedCorrectAnswer = JSON.parse(correct_answer);
                  if (type === 'single_choice' && (Array.isArray(parsedCorrectAnswer) || !parsedOptions.includes(parsedCorrectAnswer))) {
                    isValid = false;
                    rowError += '单选题正确答案必须是单个选项值且存在于选项中; ';
                  }
                  if (type === 'multiple_choice' && (!Array.isArray(parsedCorrectAnswer) || parsedCorrectAnswer.length < 2 || !parsedCorrectAnswer.every(ans => parsedOptions.includes(ans)))) {
                    isValid = false;
                    rowError += '多选题正确答案必须是包含至少两个选项值的JSON数组且存在于选项中; ';
                  }
                }
                break;
              case 'true_false':
                if (correct_answer !== 'true' && correct_answer !== 'false') {
                  isValid = false;
                  rowError += '判断题正确答案必须是 "true" 或 "false"; ';
                }
                break;
              case 'fill_blank':
                if (!correct_answer) {
                  isValid = false;
                  rowError += '填空题必须提供正确答案; ';
                } else {
                  const parsedCorrectAnswer = JSON.parse(correct_answer);
                  if (!Array.isArray(parsedCorrectAnswer) || parsedCorrectAnswer.length === 0) {
                    isValid = false;
                    rowError += '填空题正确答案必须是包含至少一个关键词的JSON数组; ';
                  }
                }
                break;
              case 'essay':
                // Essay questions don't strictly require correct_answer for auto-grading, but can have reference
                break;
              default:
                isValid = false;
                rowError += '无效的题型; ';
            }
          } catch (jsonError) {
            isValid = false;
            rowError += `JSON解析错误: ${jsonError.message}; `;
          }

          if (isValid) {
            data.push({ ...rowData, key: rowNumber });
          } else {
            errors.push({ row: rowNumber, message: rowError, data: rowData });
          }
        });
        setParsedData(data);
        setImportErrors(errors);
        if (errors.length > 0) {
          message.warning(`文件解析完成，发现 ${errors.length} 条错误。`);
        } else {
          message.success('文件解析成功，请确认后导入。');
        }
      } catch (error) {
        message.error('解析 Excel 文件失败');
        console.error('Failed to parse Excel:', error);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportConfirm = async () => {
    if (parsedData.length === 0) {
      message.warning('没有可导入的题目。');
      return;
    }
    if (importErrors.length > 0) {
      message.error('存在错误数据，请修正后重新上传。');
      return;
    }

    setLoading(true);
    try {
      // Backend API for batch import (not yet implemented, placeholder)
      await axios.post(`/api/exams/${examId}/questions/batch-import`, { questions: parsedData }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      message.success('题目批量导入成功！');
      navigate(`/assessment/exams/${examId}`);
    } catch (error) {
      message.error(`批量导入失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to batch import questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '行号', dataIndex: 'key', key: 'key', width: 60 },
    { title: '题型', dataIndex: 'type', key: 'type', render: (text) => <Tag>{text}</Tag> },
    { title: '题目内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '分值', dataIndex: 'score', key: 'score', width: 80 },
    { title: '选项', dataIndex: 'options', key: 'options', ellipsis: true },
    { title: '正确答案', dataIndex: 'correct_answer', key: 'correct_answer', ellipsis: true },
    { title: '解析', dataIndex: 'explanation', key: 'explanation', ellipsis: true },
  ];

  const errorColumns = [
    { title: '行号', dataIndex: 'row', key: 'row', width: 60 },
    { title: '错误信息', dataIndex: 'message', key: 'message' },
    { title: '原始数据', dataIndex: 'data', key: 'data', render: (data) => JSON.stringify(data), ellipsis: true },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="批量导入题目" loading={loading}>
        <Space style={{ marginBottom: 16 }}>
          <Button type="default" onClick={() => navigate(`/assessment/exams/${examId}`)} icon={<ArrowLeftOutlined />}>
            返回试卷详情
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载导入模板
          </Button>
          <Upload {...props} accept=".xlsx">
            <Button icon={<UploadOutlined />}>
              上传题目文件 (.xlsx)
            </Button>
          </Upload>
        </Space>

        {parsedData.length > 0 && (
          <Card title="导入预览" style={{ marginBottom: 16 }}>
            <Table
              columns={columns}
              dataSource={parsedData}
              pagination={{ pageSize: 5 }}
              scroll={{ x: 'max-content' }}
            />
            <Space style={{ marginTop: 16 }}>
              <Popconfirm
                title="确认导入所有有效题目吗？"
                onConfirm={handleImportConfirm}
                okText="是"
                cancelText="否"
                disabled={parsedData.length === 0 || importErrors.length > 0}
              >
                <Button type="primary" icon={<UploadOutlined />} disabled={parsedData.length === 0 || importErrors.length > 0}>
                  确认导入 ({parsedData.length} 条)
                </Button>
              </Popconfirm>
              <Button onClick={() => { setParsedData([]); setFileList([]); setImportErrors([]); }}>
                清空预览
              </Button>
            </Space>
          </Card>
        )}

        {importErrors.length > 0 && (
          <Card title="导入错误" type="inner" style={{ marginBottom: 16 }} headStyle={{ color: 'red' }}>
            <Table
              columns={errorColumns}
              dataSource={importErrors}
              pagination={{ pageSize: 5 }}
              rowKey="row"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        )}
      </Card>
    </div>
  );
};

export default QuestionImport;
