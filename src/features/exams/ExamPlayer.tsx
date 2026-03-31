import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Group, Title, Text, Button, Stack, rem, 
  ThemeIcon, Badge, Progress, Radio, Divider, Container, Card
} from '@mantine/core';
import { Clock, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/core/api';
import { notifications } from '@mantine/notifications';

export const ExamPlayer = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [resultId, setResultId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);

  // 1. 开始考试 (规约执行：事务闭环)
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/exams/assessment/start', { planId: Number(planId) });
      return res.data.data;
    },
    onSuccess: (data) => {
      setResultId(data.result_id);
      setQuestions(data.questions);
      setTimeLeft(data.duration * 60);
    }
  });

  useEffect(() => {
    startMutation.mutate();
  }, []);

  // 2. 自动保存答案 (逻辑闭环)
  const saveAnswer = async (qId: string, ans: string) => {
    setAnswers({ ...answers, [qId]: ans });
    if (resultId) {
      await api.put('/exams/assessment/answer', { resultId, questionId: qId, answer: ans });
    }
  };

  // 3. 最终提交
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/exams/assessment/submit', { resultId });
      return res.data;
    },
    onSuccess: (data) => {
      notifications.show({ title: '考试已提交', message: `最终得分：${data.score}`, color: 'green' });
      navigate('/app/hr-exam-management');
    }
  });

  return (
    <Box style={{ backgroundColor: 'var(--mantine-color-gray-0)', minHeight: '100vh' }}>
      <Container size="md" py="xl">
        <Stack gap="xl">
          <Paper withBorder p="md" radius="xl" shadow="md" style={{ position: 'sticky', top: rem(20), zIndex: 10 }}>
            <Group justify="space-between">
              <Title order={4} fw={900}>在线考核系统 · 进行中</Title>
              <Group gap="xl">
                <Group gap="xs" c="red">
                  <Clock size={20} />
                  <Text fw={900}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</Text>
                </Group>
                <Button color="blue" radius="md" h={44} leftSection={<Send size={18} />} onClick={() => submitMutation.mutate()} loading={submitMutation.isPending} fw={900}>
                  立即交卷
                </Button>
              </Group>
            </Group>
          </Paper>

          {questions.map((q, idx) => (
            <Card key={q.id} withBorder radius="lg" p="xl" shadow="sm">
              <Stack gap="md">
                <Group gap="xs">
                  <Badge variant="light">第 {idx + 1} 题</Badge>
                  <Text fw={900} size="md">{q.content}</Text>
                </Group>
                <Divider />
                <Radio.Group value={answers[q.id]} onChange={(v) => saveAnswer(q.id, v)}>
                  <Stack gap="sm">
                    {['A', 'B', 'C', 'D'].map(opt => (
                      <Radio key={opt} value={opt} label={`${opt}. 选项内容示例`} />
                    ))}
                  </Stack>
                </Radio.Group>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};
