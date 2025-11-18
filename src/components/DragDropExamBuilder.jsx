import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import Modal from './Modal'; // Assuming a generic Modal component exists
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const DragDropExamBuilder = () => {
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]); // Questions added to the exam
  const [loading, setLoading] = useState(false);
  const [questionSearchTerm, setQuestionSearchTerm] = useState('');
  const [questionFilterType, setQuestionFilterType] = useState('');
  const [showExamConfigModal, setShowExamConfigModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false); // New state for preview modal

  const [examFormData, setExamFormData] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: 'medium',
    duration: 60,
    pass_score: 60,
    status: 'draft',
  });

  useEffect(() => {
    fetchAvailableQuestions();
  }, []);

  const fetchAvailableQuestions = async () => {
    setLoading(true);
    try {
      // Assuming an API endpoint to get all available questions
      const response = await api.get('/questions');
      setAvailableQuestions(response.data || []);
    } catch (error) {
      console.error('获取可用题目失败:', error);
      toast.error('获取可用题目列表失败');
      setAvailableQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;

    // Dropped outside the list
    if (!destination) {
      return;
    }

    // Dragging from question bank to exam area
    if (source.droppableId === 'questionBank' && destination.droppableId === 'examArea') {
      const question = availableQuestions[source.index];
      // Add a default score if not present, or use existing
      const newQuestion = { ...question, score: question.score || 5, tempId: Date.now() + Math.random() }; // Add tempId for unique key
      setExamQuestions((prev) => [...prev, newQuestion]);
    }
    // Reordering within the exam area
    else if (source.droppableId === 'examArea' && destination.droppableId === 'examArea') {
      const reorderedQuestions = Array.from(examQuestions);
      const [removed] = reorderedQuestions.splice(source.index, 1);
      reorderedQuestions.splice(destination.index, 0, removed);
      setExamQuestions(reorderedQuestions);
    }
  };

  const removeQuestionFromExam = (tempId) => {
    setExamQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
  };

  const updateQuestionScore = (tempId, newScore) => {
    setExamQuestions((prev) =>
      prev.map((q) => (q.tempId === tempId ? { ...q, score: parseInt(newScore) || 0 } : q))
    );
  };

  const totalExamScore = useMemo(() => {
    return examQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
  }, [examQuestions]);

  const filteredAvailableQuestions = useMemo(() => {
    return availableQuestions.filter((q) => {
      const matchesSearch =
        q.content.toLowerCase().includes(questionSearchTerm.toLowerCase()) ||
        q.description?.toLowerCase().includes(questionSearchTerm.toLowerCase());
      const matchesType = questionFilterType === '' || q.type === questionFilterType;
      return matchesSearch && matchesType;
    });
  }, [availableQuestions, questionSearchTerm, questionFilterType]);

  const handleSaveExam = async (publish = false) => {
    setLoading(true);
    try {
      const examData = {
        ...examFormData,
        total_score: totalExamScore,
        question_count: examQuestions.length,
        status: publish ? 'published' : 'draft',
        questions: examQuestions.map((q, index) => ({
          question_id: q.id,
          score: q.score,
          order_num: index + 1,
        })),
      };

      // Basic validation
      if (!examData.title) {
        toast.error('试卷标题不能为空');
        return;
      }
      if (examQuestions.length === 0) {
        toast.error('试卷中至少需要一道题目');
        return;
      }
      if (examData.pass_score > examData.total_score) {
        toast.error('及格分不能大于总分');
        return;
      }

      const response = await api.post('/exams/with-questions', examData); // Assuming a new API for creating exam with questions
      toast.success(publish ? '试卷发布成功！' : '试卷草稿保存成功！');
      // TODO: Navigate back to exam list or show success message
      setShowExamConfigModal(false);
      setExamQuestions([]); // Clear exam questions after saving
      setExamFormData({
        title: '',
        description: '',
        category: '',
        difficulty: 'medium',
        duration: 60,
        pass_score: 60,
        status: 'draft',
      });
    } catch (error) {
      console.error('保存试卷失败:', error);
      toast.error('保存试卷失败');
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'single_choice': return '单选';
      case 'multiple_choice': return '多选';
      case 'true_false': return '判断';
      case 'fill_blank': return '填空';
      case 'short_answer': return '简答';
      default: return '';
    }
  };

  return (
    <div className="p-6 flex h-full">
      {/* 题库区域 */}
      <div className="w-1/2 bg-white rounded-xl shadow-md p-4 mr-4 flex flex-col">
        <h3 className="text-xl font-bold text-gray-800 mb-4">题库</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="搜索题目内容..."
            value={questionSearchTerm}
            onChange={(e) => setQuestionSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          />
          <select
            value={questionFilterType}
            onChange={(e) => setQuestionFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="">所有题型</option>
            <option value="single_choice">单选题</option>
            <option value="multiple_choice">多选题</option>
            <option value="true_false">判断题</option>
            <option value="fill_blank">填空题</option>
            <option value="short_answer">简答题</option>
          </select>
        </div>

        <Droppable droppableId="questionBank">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex-1 overflow-y-auto space-y-3"
            >
              {loading ? (
                <div className="text-center py-12">加载中...</div>
              ) : filteredAvailableQuestions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">暂无可用题目</div>
              ) : (
                filteredAvailableQuestions.map((question, index) => (
                  <Draggable key={question.id} draggableId={String(question.id)} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {getQuestionTypeLabel(question.type)}
                          </span>
                          <span className="text-sm font-medium text-gray-700">{question.score || 0}分</span>
                        </div>
                        <p className="text-sm text-gray-800 line-clamp-2">{question.content}</p>
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>

      {/* 试卷构建区域 */}
      <div className="w-1/2 bg-white rounded-xl shadow-md p-4 flex flex-col">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          试卷构建区
          <span className="ml-4 text-sm text-gray-600">
            题目数量: {examQuestions.length} | 总分: {totalExamScore}
          </span>
        </h3>

        <Droppable droppableId="examArea">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex-1 overflow-y-auto space-y-3 border border-dashed border-gray-300 rounded-lg p-3 min-h-[200px]"
            >
              {examQuestions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  从左侧题库拖拽题目到此处
                </div>
              ) : (
                examQuestions.map((question, index) => (
                  <Draggable key={question.tempId} draggableId={String(question.tempId)} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="bg-primary-50 border border-primary-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between cursor-grab"
                      >
                        <div className="flex-1 mr-4">
                          <div className="flex items-center mb-1">
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium mr-2">
                              {getQuestionTypeLabel(question.type)}
                            </span>
                            <p className="text-sm font-medium text-gray-800 line-clamp-1">
                              {index + 1}. {question.content}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={question.score}
                            onChange={(e) => updateQuestionScore(question.tempId, e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center"
                            min="0"
                          />
                          <span className="text-sm text-gray-700">分</span>
                          <button
                            onClick={() => removeQuestionFromExam(question.tempId)}
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                          >
                            ✖
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
            disabled={examQuestions.length === 0}
          >
            预览
          </button>
          <button
            onClick={() => setShowExamConfigModal(true)}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md"
          >
            保存试卷
          </button>
        </div>
      </div>

      {/* 试卷配置Modal */}
      <Modal
        isOpen={showExamConfigModal}
        onClose={() => setShowExamConfigModal(false)}
        title="试卷配置"
      >
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">试卷标题 *</label>
            <input
              type="text"
              required
              value={examFormData.title}
              onChange={(e) => setExamFormData({ ...examFormData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="输入试卷标题"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
            <textarea
              value={examFormData.description}
              onChange={(e) => setExamFormData({ ...examFormData, description: e.target.value })}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="输入试卷描述"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
              <input
                type="text"
                value={examFormData.category}
                onChange={(e) => setExamFormData({ ...examFormData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="例如：前端基础"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">难度</label>
              <select
                value={examFormData.difficulty}
                onChange={(e) => setExamFormData({ ...examFormData, difficulty: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">困难</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">考试时长 (分钟) *</label>
              <input
                type="number"
                required
                min="1"
                value={examFormData.duration}
                onChange={(e) => setExamFormData({ ...examFormData, duration: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">总分</label>
              <input
                type="text"
                value={totalExamScore}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">及格分 *</label>
              <input
                type="number"
                required
                min="0"
                value={examFormData.pass_score}
                onChange={(e) => setExamFormData({ ...examFormData, pass_score: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowExamConfigModal(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => handleSaveExam(false)}
              disabled={loading}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存草稿'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveExam(true)}
              disabled={loading}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '发布中...' : '发布试卷'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 试卷预览Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={`试卷预览: ${examFormData.title || '未命名试卷'}`}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto p-2">
          {examQuestions.length === 0 ? (
            <p className="text-gray-500 text-center">暂无题目可预览。</p>
          ) : (
            examQuestions.map((question, index) => (
              <div key={question.tempId} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-lg font-semibold text-gray-800">
                    {index + 1}. {question.content}
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {getQuestionTypeLabel(question.type)}
                    </span>
                  </h4>
                  <span className="text-md font-medium text-gray-700">{question.score}分</span>
                </div>
                {/* For preview, we just show the content and type, not interactive answers */}
                {question.type === 'single_choice' && question.options && (
                  <ul className="list-disc list-inside ml-4 text-gray-600">
                    {JSON.parse(question.options).map((option, optIndex) => (
                      <li key={optIndex}>{String.fromCharCode(65 + optIndex)}. {option}</li>
                    ))}
                  </ul>
                )}
                {question.type === 'multiple_choice' && question.options && (
                  <ul className="list-disc list-inside ml-4 text-gray-600">
                    {JSON.parse(question.options).map((option, optIndex) => (
                      <li key={optIndex}>{String.fromCharCode(65 + optIndex)}. {option}</li>
                    ))}
                  </ul>
                )}
                {question.type === 'true_false' && (
                  <p className="text-gray-600 ml-4">A. 正确 B. 错误</p>
                )}
                {question.type === 'fill_blank' && (
                  <p className="text-gray-600 ml-4">填空题区域</p>
                )}
                {question.type === 'short_answer' && (
                  <p className="text-gray-600 ml-4">简答题区域</p>
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end pt-4 border-t mt-4">
          <button
            onClick={() => setShowPreviewModal(false)}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default DragDropExamBuilder;
