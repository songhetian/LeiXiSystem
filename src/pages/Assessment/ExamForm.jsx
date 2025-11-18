import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Space, message, Card } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;

const ExamForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams(); // For editing existing exam
  const [loading, setLoading] = useState(false);
  const [examCategories, setExamCategories] = useState([]);

  useEffect(() => {
    fetchExamCategories();
    if (id) {
      fetchExamDetails(id);
    }
  }, [id]);

  const fetchExamCategories = async () => {
    try {
      const response = await axios.get('/api/exam-categories', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExamCategories(response.data);
    } catch (error) {
      message.error('获取考试分类失败');
      console.error('Failed to fetch exam categories:', error);
    }
  };

  const fetchExamDetails = async (examId) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/exams/${examId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const exam = response.data.data;
      form.setFieldsValue({
        ...exam,
        category: exam.category_id, // Assuming category_id is used for Select
      });
    } catch (error) {
      message.error('获取试卷详情失败');
      console.error('Failed to fetch exam details:', error);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values, status = 'draft') => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        category_id: values.category, // Map back to category_id for API
        status: status,
      };

      if (id) {
        await axios.put(`/api/exams/${id}`, payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('试卷更新成功');
      } else {
        await axios.post('/api/exams', payload, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        message.success('试卷创建成功');
      }
      navigate('/assessment/exams'); // Navigate back to exam list
    } catch (error) {
      message.error(`操作失败: ${error.response?.data?.message || error.message}`);
      console.error('Failed to save exam:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    form.validateFields().then((values) => {
      onFinish(values, 'draft');
    }).catch(info => {
      console.log('Validate Failed:', info);
      message.error('请检查表单填写');
    });
  };

  const handlePublish = () => {
    form.validateFields().then((values) => {
      // Additional validation for publishing, e.g., question_count > 0
      // This might need to be handled on the backend or after questions are added
      onFinish(values, 'published');
    }).catch(info => {
      console.log('Validate Failed:', info);
      message.error('请检查表单填写');
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title={id ? '编辑试卷' : '创建试卷'} loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            difficulty: 'medium',
            duration: 60,
            total_score: 100,
            pass_score: 60,
          }}
        >
          {/* 基本信息表单 */}
          <Form.Item
            name="title"
            label="试卷标题"
            rules={[{ required: true, message: '请输入试卷标题' }, { max: 200, message: '标题不能超过200字符' }]}
          >
            <Input placeholder="请输入试卷标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="试卷描述"
          >
            <TextArea rows={4} placeholder="请输入试卷描述" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择试卷分类' }]}
          >
            <Select placeholder="请选择分类">
              {examCategories.map(cat => (
                <Option key={cat.id} value={cat.id}>{cat.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="difficulty"
            label="难度"
            rules={[{ required: true, message: '请选择试卷难度' }]}
          >
            <Select placeholder="请选择难度">
              <Option value="easy">简单</Option>
              <Option value="medium">中等</Option>
              <Option value="hard">困难</Option>
            </Select>
          </Form.Item>

          {/* 考试配置 */}
          <Form.Item
            name="duration"
            label="考试时长 (分钟)"
            rules={[{ required: true, message: '请输入考试时长' }, { type: 'number', min: 1, message: '时长必须大于0' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="total_score"
            label="总分"
            rules={[{ required: true, message: '请输入总分' }, { type: 'number', min: 1, message: '总分必须大于0' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="pass_score"
            label="及格分"
            rules={[
              { required: true, message: '请输入及格分' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('total_score') >= value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('及格分不能大于总分!'));
                },
              }),
            ]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="default" onClick={handleSaveDraft} loading={loading}>
                保存草稿
              </Button>
              <Button type="primary" onClick={handlePublish} loading={loading}>
                发布试卷
              </Button>
              <Button onClick={() => navigate('/assessment/exams')} disabled={loading}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ExamForm;
