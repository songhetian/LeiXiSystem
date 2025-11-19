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
        fill_blanks: [{ keyword: '' }],
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
      if (question.fill_blanks && typeof question.fill_blanks === 'string') {
        question.fill_blanks = JSON.parse(question.fill_blanks);
      }

      form.setFieldsValue(question);
    } catch (error) {
      message.error('获取题目详情失败');
      console.error('Failed to fetch question details:', error);
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
      if (payload.fill_blanks) {
        payload.fill_blanks = JSON.stringify(payload.fill_blanks);
      }

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
      console.error('Failed to save question:', error);
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
      fill_blanks: undefined,
    });
    if (value === 'single_choice' || value === 'multiple_choice') {
      form.setFieldsValue({ options: [{ value: '' }, { value: '' }] });
    }
    if (value === 'fill_blank') {
      form.setFieldsValue({ fill_blanks: [{ keyword: '' }] });
    }
  };

  // Auto-save draft function
  const autoSaveDraft = useCallback(async (values) => {
    if (!questionId) return;

    try {
      const payload = { ...values, exam_id: examId };
      if (payload.options) payload.options = JSON.stringify(payload.options);
      if (payload.correct_answer) payload.correct_answer = JSON.stringify(payload.correct_answer);
      if (payload.fill_blanks) payload.fill_blanks = JSON.stringify(payload.fill_blanks);

      await axios.put(`/api/questions/${questionId}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
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
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <span>{questionId ? '编辑题目' : '创建题目'}</span>
            {questionId && (
              <>
                {isSaving && <Tag icon={<SaveOutlined spin />} color="processing">保存中...</Tag>}
                {saveStatus === 'success' && <Tag icon={<CheckCircleOutlined />} color="success">已保存</Tag>}
                {saveStatus === 'error' && <Tag icon={<CloseCircleOutlined />} color="error">保存失败</Tag>}
              </>
            )}
          </Space>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleFormChange}
          onFinish={onFinish}
        >
          <Form.Item
            name="type"
            label="题型"
            rules={[{ required: true, message: '请选择题型' }]}
          >
            <Select placeholder="请选择题型" onChange={handleQuestionTypeChange}>
              <Option value="single_choice">单选题</Option>
              <Option value="multiple_choice">多选题</Option>
              <Option value="true_false">判断题</Option>
              <Option value="fill_blank">填空题</Option>
              <Option value="essay">简答题</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="题目内容"
            rules={[{ required: true, message: '请输入题目内容' }]}
          >
            <TextArea rows={4} placeholder="请输入题目内容" />
          </Form.Item>

          <Form.Item
            name="score"
            label="分值"
            rules={[{ required: true, message: '请输入分值' }, { type: 'number', min: 1, message: '分值必须大于0' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          {/* Options for Single/Multiple Choice */}
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
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...field}
                        name={[field.name, 'value']}
                        fieldKey={[field.fieldKey, 'value']}
                        rules={[{ required: true, message: '选项内容不能为空' }]}
                      >
                        <Input placeholder={`选项 ${index + 1}`} style={{ width: 300 }} />
                      </Form.Item>
                      {fields.length > 2 ? (
                        <MinusCircleOutlined onClick={() => remove(field.name)} />
                      ) : null}
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加选项
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          )}

          {/* Correct Answer for Single/Multiple Choice */}
          {questionType === 'single_choice' && (
            <Form.Item
              name="correct_answer"
              label="正确答案"
              rules={[{ required: true, message: '请选择正确答案' }]}
            >
              <RadioGroup>
                {form.getFieldValue('options')?.map((option, index) => (
                  <Radio key={index} value={option.value}>{`选项 ${index + 1}: ${option.value}`}</Radio>
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
              <CheckboxGroup>
                {form.getFieldValue('options')?.map((option, index) => (
                  <Checkbox key={index} value={option.value}>{`选项 ${index + 1}: ${option.value}`}</Checkbox>
                ))}
              </CheckboxGroup>
            </Form.Item>
          )}

          {/* Correct Answer for True/False */}
          {questionType === 'true_false' && (
            <Form.Item
              name="correct_answer"
              label="正确答案"
              rules={[{ required: true, message: '请选择正确答案' }]}
            >
              <RadioGroup>
                <Radio value={true}>正确</Radio>
                <Radio value={false}>错误</Radio>
              </RadioGroup>
            </Form.Item>
          )}

          {/* Keywords for Fill-in-the-blank */}
          {questionType === 'fill_blank' && (
            <Form.List name="fill_blanks" rules={[{
              validator: async (_, fill_blanks) => {
                if (!fill_blanks || fill_blanks.length === 0) {
                  return Promise.reject(new Error('至少需要一个填空项'));
                }
                if (fill_blanks.some(blank => !blank || !blank.keyword || blank.keyword.trim() === '')) {
                  return Promise.reject(new Error('填空关键词不能为空'));
                }
              },
            }]}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...field}
                        name={[field.name, 'keyword']}
                        fieldKey={[field.fieldKey, 'keyword']}
                        rules={[{ required: true, message: '填空关键词不能为空' }]}
                      >
                        <Input placeholder={`填空项 ${index + 1} 关键词`} style={{ width: 300 }} />
                      </Form.Item>
                      {fields.length > 1 ? (
                        <MinusCircleOutlined onClick={() => remove(field.name)} />
                      ) : null}
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加填空项
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          )}

          {/* Reference Answer for Essay */}
          {questionType === 'essay' && (
            <Form.Item
              name="correct_answer" // Using correct_answer to store reference answer
              label="参考答案"
            >
              <TextArea rows={6} placeholder="请输入参考答案" />
            </Form.Item>
          )}

          <Form.Item
            name="explanation"
            label="解析"
          >
            <TextArea rows={4} placeholder="请输入题目解析" />
          </Form.Item>

          {/* Image Upload (Placeholder) */}
          <Form.Item label="图片上传">
            <Button icon={<PlusOutlined />} disabled>
              上传图片 (待实现)
            </Button>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存题目
              </Button>
              <Button onClick={() => navigate(`/assessment/exams/${examId}`)} disabled={loading}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default QuestionEditor;
