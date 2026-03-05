import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Group, Title, Text, TextInput, Select, Button, Badge, 
  ActionIcon, Stack, rem, SimpleGrid, Divider, Card, Textarea, NumberInput, 
  Checkbox, MultiSelect
} from '@mantine/core';
import { Save, Plus, Trash2, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/core/api';
import { notifications } from '@mantine/notifications';

export const ExamEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [examData, setExamData] = useState<any>({});

  const { data } = useQuery({
    queryKey: ['exams', id],
    queryFn: async () => {
      const res = await api.get(`/exams/${id}`);
      return res.data.data;
    },
    enabled: !!id && id !== 'new'
  });

  useEffect(() => {
    if (data) {
      setExamData(data);
      setQuestions(JSON.parse(data.questions || '[]'));
    }
  }, [data]);

  const addQuestion = (type: string) => {
    setQuestions([...questions, { 
      id: Date.now().toString(), 
      type, 
      content: '', 
      options: ['A', 'B', 'C', 'D'], 
      correct_answer: type === 'multiple_choice' ? [] : 'A', 
      score: 5 
    }]);
  };

  const handleSave = async () => {
    try {
      const payload = { ...examData, questions: JSON.stringify(questions) };
      if (id === 'new') await api.post('/exams', payload);
      else await api.put(`/exams/${id}`, payload);
      notifications.show({ title: '物理存证成功', message: '试卷全题型架构已同步', color: 'green' });
      navigate('/app/hr-exam-management');
    } catch (e) {
      notifications.show({ title: '保存失败', message: '后端事务链路异常', color: 'red' });
    }
  };

  return (
    <Box p="md">
      <Stack gap="xl">
        <Paper withBorder p="md" radius="lg" shadow="xs">
          <Group justify="space-between">
            <Group>
              <ActionIcon variant="subtle" onClick={() => navigate(-1)}><ChevronLeft size={20} /></ActionIcon>
              <Title order={4} fw={900}>试卷架构设计器 (全题型重构版)</Title>
            </Group>
            <Button color="blue" radius="md" h={44} leftSection={<Save size={18} />} onClick={handleSave} fw={900}>
              同步发布版本
            </Button>
          </Group>
        </Paper>

        <Box style={{ display: 'flex', gap: rem(24) }}>
          <Stack style={{ flex: 1 }}>
            {questions.map((q, index) => (
              <Card key={q.id} withBorder radius="lg" p="xl" shadow="sm">
                <Group justify="space-between" mb="md">
                  <Badge variant="filled" color={q.type === 'essay' ? 'orange' : 'blue'}>题目 #{index + 1} - {q.type}</Badge>
                  <ActionIcon variant="subtle" color="red" onClick={() => setQuestions(questions.filter((_, i) => i !== index))}>
                    <Trash2 size={18} />
                  </ActionIcon>
                </Group>
                <Stack gap="md">
                  <Textarea label="题目正文" placeholder="请输入问题描述..." value={q.content} onChange={(e) => {
                    const newQs = [...questions];
                    newQs[index].content = e.currentTarget.value;
                    setQuestions(newQs);
                  }} size="md" radius="md" />
                  
                  <SimpleGrid cols={2}>
                    <Select label="题型物理切换" data={[
                      {value: 'single_choice', label: '单选题'},
                      {value: 'multiple_choice', label: '多选题'},
                      {value: 'true_false', label: '判断题'},
                      {value: 'fill_blank', label: '填空题'},
                      {value: 'essay', label: '简答/主观题'}
                    ]} value={q.type} onChange={(val) => {
                      const newQs = [...questions];
                      newQs[index].type = val;
                      setQuestions(newQs);
                    }} size="sm" radius="md" />
                    <NumberInput label="分值权重" value={q.score} onChange={(v) => {
                      const newQs = [...questions];
                      newQs[index].score = v;
                      setQuestions(newQs);
                    }} size="sm" radius="md" />
                  </SimpleGrid>

                  {/* 规约执行：零缩水题型配置区 */}
                  {['single_choice', 'multiple_choice'].includes(q.type) && (
                    <Box p="md" bg="gray.0" style={{ borderRadius: rem(8) }}>
                      <Text size="xs" fw={900} mb="xs">选项配置与正确答案：</Text>
                      {q.type === 'multiple_choice' ? (
                        <MultiSelect data={['A', 'B', 'C', 'D', 'E', 'F']} value={q.correct_answer} onChange={(val) => {
                          const newQs = [...questions];
                          newQs[index].correct_answer = val;
                          setQuestions(newQs);
                        }} placeholder="选择正确选项组合" size="sm" />
                      ) : (
                        <Select data={['A', 'B', 'C', 'D']} value={q.correct_answer} onChange={(val) => {
                          const newQs = [...questions];
                          newQs[index].correct_answer = val;
                          setQuestions(newQs);
                        }} placeholder="设定唯一标准答案" size="sm" />
                      )}
                    </Box>
                  )}
                </Stack>
              </Card>
            ))}
            <Group grow>
              <Button variant="dashed" h={60} radius="lg" onClick={() => addQuestion('single_choice')}>+ 单选</Button>
              <Button variant="dashed" h={60} radius="lg" onClick={() => addQuestion('multiple_choice')}>+ 多选</Button>
              <Button variant="dashed" h={60} radius="lg" onClick={() => addQuestion('essay')}>+ 主观题</Button>
            </Group>
          </Stack>

          <Paper withBorder p="xl" radius="lg" style={{ width: 300, height: 'fit-content', position: 'sticky', top: rem(20) }}>
            <Title order={5} mb="md">试卷元数据</Title>
            <Stack gap="md">
              <TextInput label="试卷名称" value={examData.title} onChange={(e) => setExamData({...examData, title: e.currentTarget.value})} radius="md" />
              <NumberInput label="考核时长" suffix=" min" value={examData.duration} onChange={(v) => setExamData({...examData, duration: v})} radius="md" />
              <NumberInput label="及格分存证" value={examData.pass_score} onChange={(v) => setExamData({...examData, pass_score: v})} radius="md" />
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
};
