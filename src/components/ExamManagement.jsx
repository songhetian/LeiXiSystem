import React, { useState, useEffect, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { toast } from 'react-toastify'
import api from '../api'
import Modal from './Modal'
import { getApiUrl } from '../utils/apiConfig'
import debounce from 'lodash.debounce'


const ExamManagement = () => {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [editingExam, setEditingExam] = useState(null)
  const [selectedExam, setSelectedExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [draggedQuestion, setDraggedQuestion] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [questionBank, setQuestionBank] = useState([])
  const [bankSearchTerm, setBankSearchTerm] = useState('')
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [showEditQuestionModal, setShowEditQuestionModal] = useState(false)
  const [selectedQuestionId, setSelectedQuestionId] = useState(null)
  const typePalette = [
    { id: 'single_choice', label: '单选题' },
    { id: 'multiple_choice', label: '多选题' },
    { id: 'true_false', label: '判断题' },
    { id: 'fill_blank', label: '填空题' },
    { id: 'short_answer', label: '简答题' }
  ]
  const [showRecycleBin, setShowRecycleBin] = useState(false)
  const [deletedExams, setDeletedExams] = useState([])
  const [deletedSearch, setDeletedSearch] = useState('')
  const [deletedPage, setDeletedPage] = useState(1)
  const [deletedTotal, setDeletedTotal] = useState(0)
  const deletedPageSize = 10
  const [isDraggingOverExam, setIsDraggingOverExam] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [history, setHistory] = useState([])
  const [autoSave, setAutoSave] = useState(true)

  const showStatus = (type, message) => {
    try { toast.dismiss() } catch (e) {}
    if (type === 'success') return toast.success(message)
    return toast.error(message)
  }

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: 'medium',
    duration: 60,
    total_score: 100,
    pass_score: 60,
    status: 'draft'
  })

  const [newQuestion, setNewQuestion] = useState({
    type: 'single_choice',
    content: '',
    options: ['', '', '', ''],
    correct_answer: '',
    score: 10,
    explanation: ''
  })

  const filteredExams = React.useMemo(() => {
    return exams.filter(exam =>
      exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [exams, searchTerm])

  useEffect(() => {
    if (filteredExams) {
      setTotalPages(Math.ceil(filteredExams.length / pageSize))
    }
  }, [filteredExams, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredExams.slice(startIndex, endIndex)
  }

  useEffect(() => {
    fetchExams()
    fetchQuestionBank()
  }, [])

  const fetchQuestionBank = async () => {
    try {
      const response = await api.get('/question-bank')
      setQuestionBank(response.data || [])
    } catch (error) {
      setQuestionBank([])
    }
  }

  const fetchExams = async () => {
    setLoading(true)
    try {
      const response = await api.get('/exams')
      const payload = response?.data
      const list = Array.isArray(payload?.data?.exams)
        ? payload.data.exams
        : Array.isArray(payload?.exams)
        ? payload.exams
        : []
      setExams(list)
    } catch (error) {
      console.error('获取试卷失败:', error)
      toast.error('获取试卷列表失败')
      setExams([])
    } finally {
      setLoading(false)
    }
  }

  const fetchDeletedExams = async (page = 1, title = '') => {
    try {
      const response = await api.get('/exams/deleted', { params: { page, pageSize: deletedPageSize, title } })
      const payload = response?.data?.data || {}
      setDeletedExams(Array.isArray(payload.exams) ? payload.exams : [])
      setDeletedTotal(payload.total || 0)
    } catch (error) {
      console.error('获取回收站试卷失败:', error)
      setDeletedExams([])
      setDeletedTotal(0)
    }
  }

  const fetchQuestions = async (examId) => {
    try {
      const response = await api.get(`/exams/${examId}/questions`)
      const payload = response?.data
      const list = Array.isArray(payload?.data?.questions)
        ? payload.data.questions
        : Array.isArray(payload)
        ? payload
        : []
      setQuestions(list)
    } catch (error) {
      console.error('获取题目失败:', error)
      toast.error('获取题目失败')
      setQuestions([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingExam) {
        await api.put(`/exams/${editingExam.id}`, formData)
        toast.success('试卷更新成功')
      } else {
        await api.post('/exams', formData)
        toast.success('试卷创建成功')
      }
      setShowModal(false)
      resetForm()
      fetchExams()
    } catch (error) {
      console.error('提交失败:', error)
      toast.error(editingExam ? '更新失败' : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = async () => {
    if (!newQuestion.content.trim()) {
      toast.error('请输入题目内容')
      return
    }

    if (newQuestion.type.includes('choice')) {
      const validOptions = newQuestion.options.filter(opt => opt.trim())
      if (validOptions.length < 2) {
        toast.error('至少需要2个选项')
        return
      }
      if (!newQuestion.correct_answer) {
        toast.error('请设置正确答案')
        return
      }
    }

    try {
      const data = {
        ...newQuestion,
        exam_id: selectedExam.id,
        options: newQuestion.type.includes('choice') ? newQuestion.options.filter(opt => opt.trim()) : null,
        order_num: questions.length + 1
      }

      const res = await api.post(`/exams/${selectedExam.id}/questions`, data)
      showStatus('success', '题目添加成功')
      const newId = res?.data?.data?.id
      resetQuestionForm()
      await fetchQuestions(selectedExam.id)
      if (newId) {
        const q = Array.isArray(questions) ? questions.find((x) => x.id === newId) : null
        if (q) setEditingQuestion(q)
      }
    } catch (error) {
      console.error('添加题目失败:', error)
      showStatus('error', '添加题目失败')
    }
  }

  const handleDeleteQuestion = (questionId) => {
    setDeleteTargetId(questionId)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteQuestion = async () => {
    if (!deleteTargetId) return
    try {
      await api.delete(`/questions/${deleteTargetId}`)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
      toast.success('题目删除成功')
      fetchQuestions(selectedExam.id)
    } catch (error) {
      toast.error('删除题目失败')
    }
  }

  const handleEditQuestion = (question) => {
    setEditingQuestion(question)
    setNewQuestion({
      type: question.type,
      content: question.content,
      options: question.options ? JSON.parse(question.options) : ['', '', '', ''],
      correct_answer: question.correct_answer,
      score: question.score,
      explanation: question.explanation || ''
    })
  }

  const handleUpdateQuestion = async () => {
    if (!newQuestion.content.trim()) {
      toast.error('请输入题目内容')
      return
    }

    if (newQuestion.type.includes('choice')) {
      const validOptions = newQuestion.options.filter(opt => opt.trim())
      if (validOptions.length < 2) {
        toast.error('至少需要2个选项')
        return
      }
      if (!newQuestion.correct_answer) {
        toast.error('请设置正确答案')
        return
      }
    }

    try {
      const data = {
        type: newQuestion.type,
        content: newQuestion.content,
        options: newQuestion.type.includes('choice') ? newQuestion.options.filter(opt => opt.trim()) : null,
        correct_answer: newQuestion.correct_answer,
        score: newQuestion.score,
        explanation: newQuestion.explanation
      }

      await api.put(`/questions/${editingQuestion.id}`, data)
      showStatus('success', '题目更新成功')
      setEditingQuestion(null)
      resetQuestionForm()
      fetchQuestions(selectedExam.id)
    } catch (error) {
      console.error('更新题目失败:', error)
      showStatus('error', '更新题目失败')
    }
  }

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('确定要删除这份试卷吗？')) return

    try {
      await api.delete(`/exams/${examId}`)
      toast.success('试卷已移入回收站')
      fetchExams()
      setShowRecycleBin(true)
      setDeletedPage(1)
      setDeletedSearch('')
      fetchDeletedExams(1, '')
    } catch (error) {
      console.error('删除试卷失败:', error)
      toast.error('删除试卷失败')
    }
  }

  const handleRestoreExam = async (examId) => {
    if (!window.confirm('确定要还原该试卷吗？')) return
    try {
      await api.put(`/exams/${examId}/restore`)
      toast.success('试卷已还原')
      fetchExams()
      fetchDeletedExams(deletedPage, deletedSearch)
    } catch (error) {
      console.error('还原试卷失败:', error)
      toast.error('还原试卷失败')
    }
  }

  const handleOpenEditor = async (exam) => {
    setSelectedExam(exam)
    await fetchQuestions(exam.id)
    setShowEditorModal(true)
  }

  // 拖拽相关函数
  const handleDragStart = (e, question, index, source = 'exam') => {
    setDraggedQuestion({ question, index, source })
    e.dataTransfer.effectAllowed = source === 'bank' ? 'copy' : 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDraggingOverExam(true)
  }

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault()
    setIsDraggingOverExam(false)

    if (!draggedQuestion) {
      return
    }

    // 从题库拖入
    if (draggedQuestion.source === 'bank') {
      try {
        const bankQuestion = draggedQuestion.question
        const data = {
          type: bankQuestion.type,
          content: bankQuestion.content,
          options: bankQuestion.options,
          correct_answer: bankQuestion.correct_answer,
          score: bankQuestion.score || 10,
          explanation: bankQuestion.explanation || '',
          exam_id: selectedExam.id,
          order_num: targetIndex + 1
        }

        const res = await api.post(`/exams/${selectedExam.id}/questions`, data)
        showStatus('success', '题目已添加到试卷')
        const newId = res?.data?.data?.id
        await fetchQuestions(selectedExam.id)
        if (newId) {
          const q = Array.isArray(questions) ? questions.find((x) => x.id === newId) : null
          if (q) setEditingQuestion(q)
        }
      } catch (error) {
        console.error('添加题目失败:', error)
        showStatus('error', '添加题目失败')
      }
      setDraggedQuestion(null)
      return
    }

    // 试卷内拖拽排序
    if (draggedQuestion.index === targetIndex) {
      setDraggedQuestion(null)
      return
    }

    setHistory((prev) => [...prev, questions])
    const newQuestions = [...questions]
    const [removed] = newQuestions.splice(draggedQuestion.index, 1)
    newQuestions.splice(targetIndex, 0, removed)

    setQuestions(newQuestions)
    setDraggedQuestion(null)

    try {
      const updates = newQuestions.map((q, idx) => ({
        id: q.id,
        order_num: idx + 1
      }))

      await api.put(`/exams/${selectedExam.id}/questions/reorder`, { questions: updates })
      showStatus('success', '题目顺序已更新')
    } catch (error) {
      console.error('更新顺序失败:', error)
      showStatus('error', '更新顺序失败')
      fetchQuestions(selectedExam.id)
    }
  }

  const saveOrder = async () => {
    if (!selectedExam) return
    try {
      const updates = questions.map((q, idx) => ({ id: q.id, order_num: idx + 1 }))
      await api.put(`/exams/${selectedExam.id}/questions/reorder`, { questions: updates })
      toast.success('题目顺序已更新')
    } catch (error) {
      console.error('更新顺序失败:', error)
      toast.error('更新顺序失败')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      difficulty: 'medium',
      duration: 60,
      total_score: 100,
      pass_score: 60,
      status: 'draft'
    })
    setEditingExam(null)
  }

  const resetQuestionForm = () => {
    setNewQuestion({
      type: 'single_choice',
      content: '',
      options: ['', '', '', ''],
      correct_answer: '',
      score: 10,
      explanation: ''
    })
  }

  const debouncedSave = useMemo(() => debounce(async (payload) => {
    try {
      await api.put(`/questions/${editingQuestion.id}`, payload)
    } catch (e) {
      toast.error('自动保存失败')
    }
  }, 300), [editingQuestion])

  const getQuestionTypeLabel = (type) => {
    const types = {
      single_choice: '单选题',
      multiple_choice: '多选题',
      true_false: '判断题',
      fill_blank: '填空题',
      short_answer: '简答题'
    }
    return types[type] || type
  }

  const createTypeTemplate = (type) => {
    if (type === 'single_choice') {
      return { type, content: '新题目', options: JSON.stringify(['选项A', '选项B']), correct_answer: 'A', score: 10, explanation: '' }
    }
    if (type === 'multiple_choice') {
      return { type, content: '新题目', options: JSON.stringify(['选项A', '选项B', '选项C']), correct_answer: 'AB', score: 10, explanation: '' }
    }
    if (type === 'true_false') {
      return { type, content: '新题目', options: JSON.stringify(['正确', '错误']), correct_answer: 'A', score: 10, explanation: '' }
    }
    if (type === 'fill_blank') {
      return { type, content: '请填写答案', options: null, correct_answer: '', score: 10, explanation: '' }
    }
    if (type === 'short_answer') {
      return { type, content: '请作答', options: null, correct_answer: '', score: 10, explanation: '' }
    }
    return { type, content: '新题目', options: null, correct_answer: '', score: 10, explanation: '' }
  }

  const undoLast = async () => {
    if (!history.length || !selectedExam) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    if (Array.isArray(prev) && Array.isArray(questions)) {
      setQuestions(prev)
      try {
        const updates = prev.map((q, idx) => ({ id: q.id, order_num: idx + 1 }))
        await api.put(`/exams/${selectedExam.id}/questions/reorder`, { questions: updates })
        toast.success('已撤销排序')
      } catch (e) {
        toast.error('撤销失败')
      }
    }
  }

  const getDifficultyBadge = (difficulty) => {
    const badges = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-red-100 text-red-700'
    }
    const labels = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[difficulty]}`}>
        {labels[difficulty]}
      </span>
    )
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-700',
      published: 'bg-green-100 text-green-700',
      archived: 'bg-yellow-100 text-yellow-700'
    }
    const labels = {
      draft: '草稿',
      published: '已发布',
      archived: '已归档'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status]}`}>
        {labels[status]}
      </span>
    )
  }

  

  return (
    <div className="p-0">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">试卷管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {filteredExams.length} 份试卷</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              <span>新建试卷</span>
            </button>
            <button
              onClick={() => {
                setShowRecycleBin(true)
                setDeletedPage(1)
                setDeletedSearch('')
                fetchDeletedExams(1, '')
              }}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
            >
              回收站
            </button>
          </div>
        </div>

        {/* 搜索筛选区 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <input
            type="text"
            placeholder="按试卷标题、分类搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tl-lg">试卷标题</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">分类</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">难度</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">时长</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">总分</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </td>
                </tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    暂无试卷
                  </td>
                </tr>
              ) : (
                getCurrentPageData().map((exam, index) => (
                  <tr key={exam.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'} hover:bg-primary-100/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{exam.title}</div>
                      <div className="text-xs text-gray-500">{exam.description}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{exam.category || '-'}</td>
                    <td className="px-4 py-3 text-center">{getDifficultyBadge(exam.difficulty)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{exam.duration}分钟</td>
                    <td className="px-4 py-3 text-center text-gray-600">{exam.total_score}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(exam.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEditor(exam)}
                          className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          编辑题目
                        </button>
                        <button
                          onClick={() => {
                            setEditingExam(exam)
                            setFormData({
                              title: exam.title,
                              description: exam.description || '',
                              category: exam.category || '',
                              difficulty: exam.difficulty,
                              duration: exam.duration,
                              total_score: exam.total_score,
                              pass_score: exam.pass_score,
                              status: exam.status
                            })
                            setShowModal(true)
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          编辑信息
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam.id)}
                          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 分页组件 */}
        {filteredExams.length > 0 && (
          <div className="mt-4 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">每页显示</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-600">条</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 创建/编辑试卷Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          resetForm()
        }}
        title={editingExam ? '编辑试卷' : '新建试卷'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">试卷标题 *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="输入试卷标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">试卷描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="如：产品知识、技能考核"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">难度 *</label>
              <select
                required
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">考试时长(分钟) *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">总分 *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.total_score}
                onChange={(e) => setFormData({ ...formData, total_score: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">及格分 *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.pass_score}
                onChange={(e) => setFormData({ ...formData, pass_score: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">状态 *</label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false)
                resetForm()
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showRecycleBin}
        onClose={() => setShowRecycleBin(false)}
        title="回收站"
        size="custom800"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={deletedSearch}
              onChange={(e) => { setDeletedSearch(e.target.value); setDeletedPage(1); fetchDeletedExams(1, e.target.value) }}
              placeholder="按试卷标题搜索..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <div className="border rounded-lg">
            <table className="w-full table-auto">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">试卷标题</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">删除时间</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {deletedExams.length === 0 ? (
                  <tr><td colSpan="3" className="px-4 py-6 text-center text-gray-500">暂无删除的试卷</td></tr>
                ) : (
                  deletedExams.map((exam) => (
                    <tr key={exam.id} className="border-b">
                      <td className="px-4 py-3">{exam.title}</td>
                      <td className="px-4 py-3 text-gray-600">{exam.delete_time}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRestoreExam(exam.id)}
                          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          还原
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">共 {deletedTotal} 条</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const p = Math.max(1, deletedPage - 1); setDeletedPage(p); fetchDeletedExams(p, deletedSearch) }}
                disabled={deletedPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >上一页</button>
              <span className="text-sm">第 {deletedPage} 页</span>
              <button
                onClick={() => { const totalPages = Math.ceil(deletedTotal / deletedPageSize); const p = Math.min(totalPages || 1, deletedPage + 1); setDeletedPage(p); fetchDeletedExams(p, deletedSearch) }}
                disabled={deletedPage >= Math.ceil(deletedTotal / deletedPageSize)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >下一页</button>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setShowRecycleBin(false)} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">关闭</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }}
        title="确认删除题目"
        size="small"
        footer={(
          <div className="w-full flex items-center justify-end gap-2">
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={confirmDeleteQuestion} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">确认删除</button>
          </div>
        )}
      >
        <div className="text-gray-700">确定要删除这道题目吗？删除后将无法撤销。</div>
      </Modal>

      {/* 拖拽编辑器Modal */}
      <Modal
        isOpen={showEditorModal && selectedExam}
        onClose={() => {
          setShowEditorModal(false)
          setSelectedExam(null)
          setQuestions([])
        }}
        title={selectedExam ? `${selectedExam.title} - 题目编辑` : '题目编辑'}
        size="xlarge"
        footer={(
          <>
            <div className="text-sm text-gray-600">雷犀® 考核系统 · © 2025 LeiXi</div>
            <div className="flex items-center gap-2">
              <button onClick={saveOrder} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">保存顺序</button>
              <button onClick={undoLast} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">撤销</button>
              <button
                onClick={() => {
                  setShowEditorModal(false)
                  setSelectedExam(null)
                  setQuestions([])
                }}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >关闭编辑</button>
            </div>
          </>
        )}
      >
        <div className="flex-1 overflow-hidden flex">
          {/* 左侧：题目列表 */}
          <div className="w-2/3 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-800">📋 题目列表</h3>
              <p className="text-sm text-gray-600 mt-1">
                拖拽题目可调整顺序 · 共 {questions.length} 道题
              </p>
            </div>

            <div className={`relative flex-1 overflow-y-auto p-4 ${isDraggingOverExam ? 'ring-2 ring-primary-300 rounded-lg' : ''}`}
                 onDragEnter={() => setIsDraggingOverExam(true)}
                 onDragOver={handleDragOver}
                 onDragLeave={() => setIsDraggingOverExam(false)}>
              {isDraggingOverExam && (
                <div className="mb-3 px-3 py-2 bg-primary-50 text-primary-700 rounded border border-primary-200 text-sm">
                  释放以添加到此处
                </div>
              )}
              {questions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  暂无题目，请在右侧添加题目
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, question, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`bg-white border-2 rounded-lg p-4 cursor-move hover:shadow-md transition-all ${
                        draggedQuestion?.index === index
                          ? 'border-primary-500 opacity-50'
                          : 'border-gray-200 hover:border-primary-300'
                      } ${editingQuestion?.id === question.id ? 'ring-2 ring-primary-400' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold text-sm">
                            {index + 1}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0" onClick={() => handleEditQuestion(question)}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {getQuestionTypeLabel(question.type)}
                            </span>
                            {editingQuestion?.id === question.id && (
                              <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">编辑中</span>
                            )}
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                              {question.score}分
                            </span>
                          </div>

                          <p className="text-gray-900 font-medium mb-2">
                            {question.content}
                          </p>

                          {question.type.includes('choice') && question.options && (
                            <div className="space-y-1 text-sm">
                              {(Array.isArray(question.options) ? question.options : (() => { try { return JSON.parse(question.options) } catch { return [] } })()).map((option, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2 ${
                                    question.correct_answer === String.fromCharCode(65 + idx)
                                      ? 'text-green-600 font-medium'
                                      : 'text-gray-600'
                                  }`}
                                >
                                  <span className="font-semibold">
                                    {String.fromCharCode(65 + idx)}.
                                  </span>
                                  <span>{option}</span>
                                  {question.correct_answer === String.fromCharCode(65 + idx) && (
                                    <span className="text-green-600">✓</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {question.explanation && (
                            <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400 text-sm text-gray-700">
                              <span className="font-medium">解析：</span>
                              {question.explanation}
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 flex flex-col gap-2">
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="删除"
                          >
                            🗑️
                          </button>
                          <div className="p-2 text-gray-400 cursor-grab active:cursor-grabbing" title="拖拽排序">
                            ⋮⋮
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：添加题目 */}
          <div className="w-1/3 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-800">➕ 添加题目</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">题型选择</label>
                <div className="grid grid-cols-2 gap-3">
                  {typePalette.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, createTypeTemplate(t.id), 0, 'bank')}
                      onClick={() => setNewQuestion({ ...newQuestion, type: t.id })}
                      className="border-2 border-primary-100 hover:border-primary-300 rounded-lg p-3 bg-primary-50/50 hover:bg-primary-100 cursor-move select-none flex items-center justify-between"
                    >
                      <span className="text-primary-700 font-medium">{t.label}</span>
                      <span className="text-xs text-primary-600">拖拽到左侧</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* 题目类型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">题目类型</label>
                <select
                  value={newQuestion.type}
                  onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="single_choice">单选题</option>
                  <option value="multiple_choice">多选题</option>
                  <option value="true_false">判断题</option>
                  <option value="fill_blank">填空题</option>
                  <option value="short_answer">简答题</option>
                </select>
              </div>

              {/* 题目内容 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">题目内容 *</label>
                <textarea
                  value={newQuestion.content}
                  onChange={(e) => { setNewQuestion({ ...newQuestion, content: e.target.value }); if (editingQuestion && autoSave) { debouncedSave({ content: e.target.value }) } }}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="输入题目内容"
                />
              </div>

              {/* 选项（仅选择题和判断题） */}
              {newQuestion.type.includes('choice') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选项</label>
                  <div className="space-y-2">
                    {newQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600 w-6">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...newQuestion.options]
                            newOptions[index] = e.target.value
                            setNewQuestion({ ...newQuestion, options: newOptions })
                            if (editingQuestion && autoSave) {
                              const filtered = newOptions.filter(opt => opt.trim())
                              debouncedSave({ options: filtered })
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (newQuestion.options.length < 6) {
                        setNewQuestion({
                          ...newQuestion,
                          options: [...newQuestion.options, '']
                        })
                      }
                    }}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    + 添加选项
                  </button>
                </div>
              )}

              {newQuestion.type === 'true_false' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选项</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 w-6">A.</span>
                      <input
                        type="text"
                        value="正确"
                        disabled
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600 w-6">B.</span>
                      <input
                        type="text"
                        value="错误"
                        disabled
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 正确答案 */}
              {(newQuestion.type.includes('choice') || newQuestion.type === 'true_false') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">正确答案 *</label>
                  {newQuestion.type === 'multiple_choice' ? (
                    <input
                      type="text"
                      value={newQuestion.correct_answer}
                      onChange={(e) => { const v = e.target.value.toUpperCase(); setNewQuestion({ ...newQuestion, correct_answer: v }); if (editingQuestion && autoSave) { debouncedSave({ correct_answer: v }) } }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="如：ABC（多个答案）"
                    />
                  ) : (
                    <select
                      value={newQuestion.correct_answer}
                      onChange={(e) => { setNewQuestion({ ...newQuestion, correct_answer: e.target.value }); if (editingQuestion && autoSave) { debouncedSave({ correct_answer: e.target.value }) } }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                      <option value="">请选择</option>
                      {newQuestion.type === 'true_false' ? (
                        <>
                          <option value="A">A. 正确</option>
                          <option value="B">B. 错误</option>
                        </>
                      ) : (
                        newQuestion.options.map((option, index) => (
                          option.trim() && (
                            <option key={index} value={String.fromCharCode(65 + index)}>
                              {String.fromCharCode(65 + index)}. {option}
                            </option>
                          )
                        ))
                      )}
                    </select>
                  )}
                </div>
              )}

              {/* 分值 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分值 *</label>
                <input
                  type="number"
                  min="1"
                  value={newQuestion.score}
                  onChange={(e) => { const v = parseInt(e.target.value) || 0; setNewQuestion({ ...newQuestion, score: v }); if (editingQuestion && autoSave) { debouncedSave({ score: v }) } }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              {/* 解析 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">答案解析</label>
                <textarea
                  value={newQuestion.explanation}
                  onChange={(e) => { setNewQuestion({ ...newQuestion, explanation: e.target.value }); if (editingQuestion && autoSave) { debouncedSave({ explanation: e.target.value }) } }}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="输入答案解析（可选）"
                />
              </div>

              <button
                onClick={editingQuestion ? handleUpdateQuestion : handleAddQuestion}
                className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {editingQuestion ? '更新题目' : '➕ 添加题目'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ExamManagement
