import logger from '@/utils/logger';
import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Select, Button, Space, message, Card, Radio, InputNumber, Checkbox, Tag } from 'antd';
import { MinusCircleOutlined, PlusOutlined, ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useFormAutoSave } from '../../hooks/useFormAutoSave';

const { Option } = Select;
const { TextArea } = Input;
const RadioGroup = Radio.Group;
const CheckboxGroup = Checkbox.Group;

const QuestionEditor = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { examId, questionId } = useParams(); // examId for new question, questionId for editing
  const [loading, setLoading] = useState(false);
  const [questionType, setQuestionType] = useState('single_choice');
  const [formChanged, setFormChanged] = useState(false);

  useEffect(() => {
    if (questionId) {
      fetchQuestionDetails(questionId);
    } else {
      // Set default values for new question
      form.setFieldsValue({
        type: 'single_choice',
        score: 5,
        options: [{ value: '' }, { value: '' }],
        correct_answer: undefined,
      });
    }
  }, [questionId]);

  const fetchQuestionDetails = async (id) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/questions/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const question = response.data.data;
      setQuestionType(question.type);

      // Parse JSON fields
      if (question.options && typeof question.options === 'string') {
        question.options = JSON.parse(question.options);
      }
      if (question.correct_answer && typeof question.correct_answer === 'string') {
        question.correct_answer = JSON.parse(question.correct_answer);
      }

      form.setFieldsValue(question);
    } catch (error) {
      message.error('获取题目详情失败');
      logger.error('Failed to fetch question details:', error);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        exam_id: examId,
      };

      // Stringify JSON fields for API
      if (payload.options) {
        payload.options = JSON.stringify(payload.options);
      }
      if (payload.correct_answer) {
        payload.correct_answer = JSON.stringify(payload.correct_answer);
      }
      // Remove deprecated fields if present just in case
      delete payload.fill_blanks;

      if (questionId) {
        await axios.put(`/api/questions/${questionId}`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('题目更新成功');
      } else {
        await axios.post(`/api/exams/${examId}/questions`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('题目创建成功');
      }
      navigate(`/assessment/exams/${examId}`); // Navigate back to exam details
    } catch (error) {
      message.error(`操作失败: ${error.response?.data?.message || error.message}`);
      logger.error('Failed to save question:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionTypeChange = (value) => {
    setQuestionType(value);
    // Reset relevant fields when type changes
    form.setFieldsValue({
      options: undefined,
      correct_answer: undefined,
    });
    if (value === 'single_choice' || value === 'multiple_choice') {
      form.setFieldsValue({ options: [{ value: '' }, { value: '' }] });
    }
  };

  // Auto-save draft function
  const autoSaveDraft = useCallback(async (values) => {
    if (!questionId) return;

    try {
      const payload = { ...values, exam_id: examId };
      if (payload.options) payload.options = JSON.stringify(payload.options);
      if (payload.correct_answer) payload.correct_answer = JSON.stringify(payload.correct_answer);

      await axios.put(`/api/questions/${questionId}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    } catch (error) {
      logger.error('Auto-save failed:', error);
      throw error;
    }
  }, [questionId, examId]);

  const { triggerSave, isSaving, saveStatus } = useFormAutoSave(autoSaveDraft, 3000, questionId && formChanged);

  const handleFormChange = useCallback(() => {
    setFormChanged(true);
    if (questionId) {
      const values = form.getFieldsValue();
      triggerSave(values);
    }
  }, [questionId, form, triggerSave]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 flex justify-center">
      <div className="w-full max-w-4xl">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
             <h1 className="text-2xl font-bold text-gray-900">{questionId ? '编辑题目' : '创建新题目'}</h1>
             <p className="text-gray-500 mt-1">设计高质量的客观题，包括单选、多选及判断题</p>
          </div>
          <div className="flex items-center gap-3">
             <Button
               icon={<ArrowLeftOutlined />}
               onClick={() => navigate(`/assessment/exams/${examId}`)}
               className="hover:bg-gray-100 border-none shadow-sm"
             >
               返回
             </Button>
            {questionId && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                {isSaving && <Tag icon={<SaveOutlined spin />} color="processing" className="m-0 border-none bg-transparent">保存中</Tag>}
                {saveStatus === 'success' && <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 border-none bg-transparent">已保存</Tag>}
                {saveStatus === 'error' && <Tag icon={<CloseCircleOutlined />} color="error" className="m-0 border-none bg-transparent">失败</Tag>}
              </div>
            )}
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleFormChange}
          onFinish={onFinish}
          className="space-y-6"
        >
          {/* Main Content Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex items-center gap-4">
                <Form.Item
                  name="type"
                  noStyle
                  rules={[{ required: true, message: '请选择题型' }]}
                >
                  <Select
                    placeholder="请选择题型"
                    onChange={handleQuestionTypeChange}
                    className="w-40"
                    variant="borderless"
                    suffixIcon={<span className="text-gray-400">▼</span>}
                    dropdownStyle={{ borderRadius: '12px', padding: '8px' }}
                  >
                    <Option value="single_choice">单选题</Option>
                    <Option value="multiple_choice">多选题</Option>
                    <Option value="true_false">判断题</Option>
                  </Select>
                </Form.Item>
                <div className="h-6 w-px bg-gray-200"></div>
                <Form.Item
                  name="score"
                  noStyle
                  rules={[{ required: true, message: '请输入分值' }]}
                >
                   <InputNumber
                      min={1}
                      className="w-32 border-transparent hover:border-primary-200 focus:border-primary-500 bg-transparent"
                      placeholder="分值"
                      addonBefore="分值"
                      controls={false}
                   />
                </Form.Item>
             </div>

             <div className="p-8">
                <Form.Item
                  name="content"
                  rules={[{ required: true, message: '请输入题目内容' }]}
                  className="mb-0"
                >
                  <TextArea
                    rows={4}
                    placeholder="在这里输入题目内容..."
                    className="text-lg font-medium text-gray-800 border-none focus:shadow-none p-0 resize-none placeholder:text-gray-300"
                    style={{ minHeight: '120px' }}
                  />
                </Form.Item>
             </div>
          </div>

          {/* Options Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
             <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
               <span className="w-1 h-6 bg-primary-500 rounded-full"></span>
               选项设置
             </h3>

            {(questionType === 'single_choice' || questionType === 'multiple_choice') && (
              <Form.List name="options" rules={[{
                validator: async (_, options) => {
                  if (!options || options.length < 2) {
                    return Promise.reject(new Error('至少需要两个选项'));
                  }
                  if (options.some(option => !option || !option.value || option.value.trim() === '')) {
                    return Promise.reject(new Error('选项内容不能为空'));
                  }
                },
              }]}>
                {(fields, { add, remove }) => (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.key} className="group relative flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all bg-white">
                        <div className="flex-shrink-0 mt-2 w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">
                          {String.fromCharCode(65 + index)}
                        </div>
                        <Form.Item
                          {...field}
                          name={[field.name, 'value']}
                          fieldKey={[field.fieldKey, 'value']}
                          rules={[{ required: true, message: '请输入选项内容' }]}
                          className="flex-1 mb-0"
                        >
                          <Input.TextArea
                             autoSize
                             placeholder={`选项 ${index + 1}`}
                             className="border-none focus:shadow-none p-0 text-gray-700 resize-none bg-transparent"
                          />
                        </Form.Item>
                        {fields.length > 2 && (
                          <MinusCircleOutlined
                            onClick={() => remove(field.name)}
                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        )}
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block
                      icon={<PlusOutlined />}
                      className="h-12 rounded-xl border-2 border-gray-100 hover:border-primary-500 hover:text-primary-600 text-gray-400 font-medium transition-colors"
                    >
                      添加选项
                    </Button>
                  </div>
                )}
              </Form.List>
            )}

            {questionType === 'true_false' && (
               <div className="p-8 bg-gray-50 rounded-xl text-center text-gray-500">
                  判断题默认包含“正确”和“错误”两个选项，无需手动配置。
               </div>
            )}
          </div>

          {/* Answer & Explanation */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
             <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
               <span className="w-1 h-6 bg-green-500 rounded-full"></span>
               答案与解析
             </h3>

            {questionType === 'single_choice' && (
              <Form.Item
                name="correct_answer"
                label="正确答案"
                rules={[{ required: true, message: '请选择正确答案' }]}
              >
                <RadioGroup className="flex flex-wrap gap-4">
                  {form.getFieldValue('options')?.map((option, index) => (
                    <Radio key={index} value={option.value} className="px-4 py-2 border rounded-lg hover:border-primary-500 transition-colors">
                      <span className="font-bold text-primary-600 mr-2">{String.fromCharCode(65 + index)}.</span>
                      {option.value || <span className="text-gray-300 italic">选项内容为空</span>}
                    </Radio>
                  ))}
                </RadioGroup>
              </Form.Item>
            )}

            {questionType === 'multiple_choice' && (
              <Form.Item
                name="correct_answer"
                label="正确答案"
                rules={[{ required: true, message: '请选择至少两个正确答案' }, {
                  validator: async (_, value) => {
                    if (questionType === 'multiple_choice' && (!value || value.length < 2)) {
                      return Promise.reject(new Error('多选题至少需要选择两个正确答案'));
                    }
                  },
                }]}
              >
                <CheckboxGroup className="flex flex-col gap-3">
                  {form.getFieldValue('options')?.map((option, index) => (
                    <Checkbox key={index} value={option.value} className="px-4 py-3 border rounded-xl hover:border-primary-500 transition-all bg-gray-50 hover:bg-white">
                      <span className="font-bold text-primary-600 mr-2">{String.fromCharCode(65 + index)}.</span>
                      {option.value || <span className="text-gray-300 italic">选项内容为空</span>}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </Form.Item>
            )}

            {questionType === 'true_false' && (
              <Form.Item
                name="correct_answer"
                label="正确答案"
                rules={[{ required: true, message: '请选择正确答案' }]}
              >
                <RadioGroup>
                  <Radio.Button value={true} className="px-6 h-10 leading-10">正确</Radio.Button>
                  <Radio.Button value={false} className="px-6 h-10 leading-10">错误</Radio.Button>
                </RadioGroup>
              </Form.Item>
            )}

            <Form.Item
              name="explanation"
              label="答案解析"
              className="mt-6"
            >
              <TextArea
                 rows={4}
                 placeholder="输入题目解析，帮助考生理解（选填）"
                 className="rounded-xl border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all p-4"
              />
            </Form.Item>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 pb-12">
             <Button
               size="large"
               onClick={() => navigate(`/assessment/exams/${examId}`)}
               className="h-12 px-8 rounded-xl border-gray-300 text-gray-600 hover:text-gray-800 hover:border-gray-400 font-medium"
             >
               取消
             </Button>
             <Button
               type="primary"
               htmlType="submit"
               loading={loading}
               className="h-12 px-10 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 border-none shadow-lg shadow-primary-500/30 text-lg font-bold"
             >
               {loading ? '保存中...' : '完成并保存'}
             </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default QuestionEditor;
