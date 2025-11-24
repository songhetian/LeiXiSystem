import React, { useState, useEffect, useMemo, useRef } from 'react'
import { formatDate } from '../utils/date'
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

  // Ref to track latest questions state for debounced save
  const questionsRef = useRef([])
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
  const [showDeleteExamModal, setShowDeleteExamModal] = useState(false)
  const [examToDelete, setExamToDelete] = useState(null)
  const [history, setHistory] = useState([])
  const [autoSave, setAutoSave] = useState(true)
  const dragCounter = useRef(0)
  const examListRef = useRef(null)
  const [scoreModalOpen, setScoreModalOpen] = useState(false)
  const [scoreInfo, setScoreInfo] = useState({ currentSum: 0, examTotal: 0 })
  const [showExamInfo, setShowExamInfo] = useState(false)
  const [examInfo, setExamInfo] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState(null)
  const [viewMode, setViewMode] = useState('card')
  const [downloadingTpl, setDownloadingTpl] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [creatorOptions, setCreatorOptions] = useState([])
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [creatorId, setCreatorId] = useState('')
  const [showPublishedWarning, setShowPublishedWarning] = useState(false)

  const getCurrentTotalScore = () => {
    try {
      return (questions || []).reduce((sum, q) => sum + (parseFloat(q.score) || 0), 0)
    } catch {
      return 0
    }
  }

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
    category_id: '',
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

  useEffect(() => {
    fetchExams()
  }, [searchTerm, sortBy, sortOrder, creatorId])

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

  const [categories, setCategories] = useState([])

  // Keep questionsRef in sync with questions state
  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  useEffect(() => {
    fetchExams()
    fetchQuestionBank()
    fetchCreators()
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await api.get('/exam-categories/tree')
      setCategories(response.data?.data || [])
    } catch (error) {
      console.error('获取分类失败:', error)
    }
  }

  // 扁平化分类树用于下拉选择
  const flattenCategories = (nodes, level = 0, result = []) => {
    nodes.forEach(node => {
      result.push({
        id: node.id,
        name: node.name,
        level: level,
        displayName: '　'.repeat(level) + node.name
      })
      if (node.children && node.children.length > 0) {
        flattenCategories(node.children, level + 1, result)
      }
    })
    return result
  }

  const categoryOptions = useMemo(() => flattenCategories(categories), [categories])

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
      const response = await api.get('/exams', {
        params: {
          page: 1,
          pageSize: 100,
          title: searchTerm || undefined,
          creator_id: creatorId || undefined,
          sort_by: sortBy,
          order: sortOrder
        }
      })
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

  const fetchCreators = async () => {
    try {
      const res = await api.get('/exams/creators')
      const data = res?.data?.data || []
      setCreatorOptions(Array.isArray(data) ? data : [])
    } catch (e) {
      setCreatorOptions([])
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
    // 题目数据现在包含在试卷详情中，不需要单独获取
    // 这里保留函数是为了兼容现有逻辑，但实际上应该直接使用 selectedExam.questions
    if (selectedExam && selectedExam.id === examId && selectedExam.questions) {
      setQuestions(selectedExam.questions)
    } else {
      // 如果 selectedExam 没有题目数据，重新获取试卷详情
      try {
        const response = await api.get(`/exams/${examId}`)
        const examData = response?.data?.data
        if (examData) {
          setQuestions(examData.questions || [])
          // 更新 selectedExam 以包含题目
          setSelectedExam(prev => ({ ...prev, ...examData }))
        }
      } catch (error) {
        console.error('获取题目失败:', error)
        toast.error('获取题目失败')
        setQuestions([])
      }
    }
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { status, ...basic } = formData
      if (editingExam || selectedExam) {
        const total = getCurrentTotalScore()
        const examTotal = basic.total_score
        if (parseFloat(examTotal) < total) {
          setScoreInfo({ currentSum: total, examTotal })
          setScoreModalOpen(true)
          setLoading(false)
          return
        }
      }
      if (editingExam) {
        await api.put(`/exams/${editingExam.id}`, basic)
        toast.success('试卷更新成功')
      } else {
        await api.post('/exams', basic)
        toast.success('试卷创建成功')
      }
      setShowModal(false)
      resetForm()
      fetchExams()
    } catch (error) {
      console.error('提交失败:', error)
      const errorMsg = error.response?.data?.message || error.message
      toast.error(editingExam ? `更新失败: ${errorMsg}` : `创建失败: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const saveExamQuestions = async (updatedQuestions) => {
    if (!selectedExam) return
    try {
      await api.put(`/exams/${selectedExam.id}`, {
        questions: updatedQuestions
      })
      // 更新本地状态
      setQuestions(updatedQuestions)
      setSelectedExam(prev => ({ ...prev, questions: updatedQuestions }))
      toast.success('试卷保存成功')
    } catch (error) {
      console.error('保存试卷失败:', error)
      toast.error('保存试卷失败')
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

    const newQ = {
      ...newQuestion,
      id: `temp_${Date.now()}`, // 临时ID，保存后后端会生成正式ID
      score: Number(newQuestion.score),
      options: newQuestion.type.includes('choice') ? newQuestion.options.filter(opt => opt.trim()) : null,
      order_num: questions.length + 1
    }

    const total = getCurrentTotalScore()
    const examTotal = selectedExam.total_score
    const newScore = parseFloat(newQ.score) || 0
    if (total + newScore > (parseFloat(examTotal) || 0)) {
      setScoreInfo({ currentSum: total + newScore, examTotal })
      setScoreModalOpen(true)
      return
    }

    const updatedQuestions = [...questions, newQ]
    setQuestions(updatedQuestions)
    resetQuestionForm()

    // 自动保存
    if (autoSave) {
      await saveExamQuestions(updatedQuestions)
    } else {
      toast.success('题目已添加 (未保存)')
    }
  }

  const handleDeleteQuestion = (questionId) => {
    setDeleteTargetId(questionId)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteQuestion = async () => {
    if (!deleteTargetId) return

    const updatedQuestions = questions.filter(q => q.id !== deleteTargetId)
    setQuestions(updatedQuestions)
    setShowDeleteConfirm(false)
    setDeleteTargetId(null)

    if (autoSave) {
      await saveExamQuestions(updatedQuestions)
    } else {
      toast.success('题目已删除 (未保存)')
    }
  }

  const handleEditQuestion = (question) => {
    setEditingQuestion(question)
    setNewQuestion({
      type: question.type,
      content: question.content,
      options: Array.isArray(question.options) ? question.options : (question.options ? JSON.parse(question.options) : ['', '', '', '']),
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

    const updatedQ = {
      ...editingQuestion,
      type: newQuestion.type,
      content: newQuestion.content,
      options: newQuestion.type.includes('choice') ? newQuestion.options.filter(opt => opt.trim()) : null,
      correct_answer: newQuestion.correct_answer,
      score: Number(newQuestion.score),
      explanation: newQuestion.explanation
    }

    const total = getCurrentTotalScore()
    const oldScore = parseFloat(editingQuestion?.score) || 0
    const newScore = parseFloat(updatedQ.score) || 0
    const examTotal = selectedExam.total_score
    const projected = total - oldScore + newScore

    if (projected > (parseFloat(examTotal) || 0)) {
      setScoreInfo({ currentSum: projected, examTotal })
      setScoreModalOpen(true)
      return
    }

    const updatedQuestions = questions.map(q => q.id === editingQuestion.id ? updatedQ : q)
    setQuestions(updatedQuestions)
    setEditingQuestion(null)
    resetQuestionForm()

    if (autoSave) {
      await saveExamQuestions(updatedQuestions)
    } else {
      toast.success('题目已更新 (未保存)')
    }
  }

  const handleDeleteExam = (exam) => {
    setExamToDelete(exam)
    setShowDeleteExamModal(true)
  }

  const confirmDeleteExam = async () => {
    if (!examToDelete) return

    try {
      await api.delete(`/exams/${examToDelete.id}`)
      toast.success('试卷已移入回收站')
      setShowDeleteExamModal(false)
      setExamToDelete(null)
      fetchExams()
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
    // 检查试卷是否已发布
    if (exam.status === 'published') {
      setSelectedExam(exam)
      setShowPublishedWarning(true)
      return
    }

    // 获取完整试卷信息（包含题目）
    try {
      const res = await api.get(`/exams/${exam.id}`)
      const fullExam = res?.data?.data
      if (fullExam) {
        setSelectedExam(fullExam)
        setQuestions(fullExam.questions || [])
        setShowEditorModal(true)
      }
    } catch (e) {
      toast.error('无法打开试卷编辑器')
    }
  }

  const openExamInfo = async (exam) => {
    try {
      const res = await api.get(`/exams/${exam.id}`)
      const data = res?.data?.data || res?.data || null
      setExamInfo(data)
      setSelectedExam(exam)
      setShowExamInfo(true)
    } catch {
      setExamInfo(null)
      setShowExamInfo(true)
    }
  }

  const handleFileImport = async (file) => {
    if (!selectedExam || !file) return
    setImporting(true)
    setImportProgress(0)
    setImportResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(`/exams/${selectedExam.id}/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => { if (e.total) setImportProgress(Math.round((e.loaded / e.total) * 100)) }
      })
      // 导入后重新获取试卷数据
      const examRes = await api.get(`/exams/${selectedExam.id}`)
      const fullExam = examRes?.data?.data
      if (fullExam) {
        setQuestions(fullExam.questions || [])
        setSelectedExam(fullExam)
      }

      const payload = res?.data?.data || {}
      setImportResult({ success: payload.success_count || 0, failed: payload.failed_count || 0, errors: payload.errors || [] })
    } catch (error) {
      const msg = error.response?.data?.message || error.message
      toast.error(`导入失败: ${msg}`)
    } finally {
      setImporting(false)
    }
  }

  const publishExam = async (exam) => {
    try {
      const res = await api.put(`/exams/${exam.id}/status`, { status: 'published' })
      toast.success('试卷发布成功')
      fetchExams()
      return res?.data
    } catch (error) {
      const msg = error.response?.data?.message || error.message
      toast.error(`发布失败: ${msg}`)
      return null
    }
  }

  const downloadTemplateXlsx = async () => {
    try {
      setDownloadingTpl(true)
      setDownloadProgress(0)
      const res = await api.get('/exams/import/template.xlsx', {
        responseType: 'blob',
        onDownloadProgress: (e) => { if (e.total) setDownloadProgress(Math.round((e.loaded / e.total) * 100)) }
      })
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers?.['content-disposition'] || ''
      let filename = '试题导入模板.xlsx'
      const m = /filename\*=UTF-8''([^;]+)/.exec(disposition)
      if (m && m[1]) filename = decodeURIComponent(m[1])
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('模板下载完成')
    } catch (error) {
      const msg = error.response?.data?.message || error.message
      toast.error(`模板下载失败: ${msg}`)
    } finally {
      setDownloadingTpl(false)
    }
  }

  // 拖拽相关函数
  const handleDragStart = (e, question, index, source = 'exam') => {
    setDraggedQuestion({ question, index, source })
    e.dataTransfer.effectAllowed = source === 'bank' ? 'copy' : 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault()
    setIsDraggingOverExam(false)

    if (!draggedQuestion) {
      return
    }

    // 从题库拖入
    if (draggedQuestion.source === 'bank') {
      const bankQuestion = draggedQuestion.question
      const newQ = {
        id: `temp_${Date.now()}`,
        type: bankQuestion.type,
        content: bankQuestion.content,
        options: typeof bankQuestion.options === 'string' ? JSON.parse(bankQuestion.options) : bankQuestion.options,
        correct_answer: bankQuestion.correct_answer,
        score: bankQuestion.score || 10,
        explanation: bankQuestion.explanation || '',
        order_num: targetIndex + 1
      }

      const total = getCurrentTotalScore()
      const examTotal = selectedExam.total_score
      if (total + (parseFloat(newQ.score) || 0) > (parseFloat(examTotal) || 0)) {
        setScoreInfo({ currentSum: total + (parseFloat(newQ.score) || 0), examTotal: examTotal })
        setScoreModalOpen(true)
        setDraggedQuestion(null)
        return
      }

      const updatedQuestions = [...questions]
      updatedQuestions.splice(targetIndex, 0, newQ)
      setQuestions(updatedQuestions)

      if (autoSave) {
        await saveExamQuestions(updatedQuestions)
      } else {
        toast.success('题目已添加 (未保存)')
      }

      setDraggedQuestion(null)
      return
    }

    // 试卷内拖拽排序
    if (selectedExam?.status === 'published') {
      showStatus('error', '已发布的试卷不允许调整题目顺序')
      setDraggedQuestion(null)
      return
    }
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

    if (autoSave) {
      await saveExamQuestions(newQuestions)
    } else {
      toast.success('顺序已更新 (未保存)')
    }
  }
  const handleContainerDragEnter = (e) => {
    dragCounter.current += 1
    if (dragCounter.current === 1) {
      setIsDraggingOverExam(true)
    }
  }
  const handleContainerDragLeave = (e) => {
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) {
      setIsDraggingOverExam(false)
    }
  }
  const handleContainerDragOver = (e) => {
    e.preventDefault()
  }
  const handleDropToContainer = (e) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDraggingOverExam(false)
    if (!draggedQuestion) return
    let targetIndex = questions.length
    const container = examListRef.current
    if (container) {
      const children = Array.from(container.querySelectorAll('[data-index]'))
      const y = e.clientY
      let bestIdx = null
      let minDist = Infinity
      children.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const idx = parseInt(el.getAttribute('data-index'), 10)
        const dist = Math.abs(y - center)
        if (dist < minDist) {
          minDist = dist
          bestIdx = idx
        }
      })
      if (bestIdx !== null) {
        targetIndex = bestIdx
      }
    }
    handleDrop(e, targetIndex)
  }

  const saveOrder = async () => {
    if (!selectedExam) return
    try {
      if (selectedExam.status === 'published') {
        toast.error('已发布的试卷不允许调整题目顺序')
        return
      }
      // Save the entire questions array with new order
      await saveExamQuestions(questions)
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
      category_id: '',
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

  const debouncedSave = useMemo(() => debounce(async (updatedFields) => {
    if (!editingQuestion || !selectedExam) return

    try {
      // Get the latest questions from ref
      const currentQuestions = questionsRef.current

      // Update the specific question with new fields
      const updatedQuestions = currentQuestions.map(q =>
        q.id === editingQuestion.id ? { ...q, ...updatedFields } : q
      )

      // Update local state
      setQuestions(updatedQuestions)

      // Save to backend
      await api.put(`/exams/${selectedExam.id}`, { questions: updatedQuestions })
    } catch (e) {
      console.error('自动保存失败:', e)
      toast.error('自动保存失败')
    }
  }, 500), [editingQuestion, selectedExam])

  const getQuestionTypeLabel = (type) => {
    const types = {
      single_choice: '单选题',
      multiple_choice: '多选题',
      true_false: '判断题',
      fill_blank: '填空题',
      short_answer: '简答题',
      essay: '简答题'
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
        if (selectedExam.status === 'published') {
          toast.error('已发布的试卷不允许调整题目顺序')
          return
        }
        // Save the restored questions array
        await saveExamQuestions(prev)
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

  const updateExamStatus = async (examId, currentStatus, nextStatus) => {
    try {
      if (!['draft','published','archived'].includes(nextStatus)) {
        toast.error('无效的状态值')
        return
      }
      if (currentStatus === nextStatus) {
        toast.info('状态未变化')
        return
      }
      const validTransitions = {
        draft: ['published'],
        published: ['archived'],
        archived: ['published']
      }
      const statusLabel = (s) => ({ draft: '草稿', published: '已发布', archived: '已归档' }[s] || s)
      if (!validTransitions[currentStatus]?.includes(nextStatus)) {
        toast.error(`不允许从 ${statusLabel(currentStatus)} 切换到 ${statusLabel(nextStatus)}`)
        return
      }
      await api.put(`/exams/${examId}/status`, { status: nextStatus })
      toast.success(`试卷状态已更新为 ${statusLabel(nextStatus)}`)
      fetchExams()
      setShowModal(false)
      setEditingExam(null)
    } catch (error) {
      const msg = error.response?.data?.message || error.message
      toast.error(`更新状态失败: ${msg}`)
    }
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-1.5 rounded-lg text-sm ${viewMode==='card'?'bg-primary-600 text-white':'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
              >卡片视图</button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-sm ${viewMode==='list'?'bg-primary-600 text-white':'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
              >列表视图</button>
            </div>
            <button
              onClick={downloadTemplateXlsx}
              className="px-6 py-2.5 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors flex items-center gap-2"
            >
              {downloadingTpl ? `下载中 ${downloadProgress}%` : '下载导入模板'}
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
        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="关键字（标题/分类）"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
            <select
              value={creatorId}
              onChange={(e) => setCreatorId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="">创建人（全部）</option>
              {creatorOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.username}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="created_at">按创建时间</option>
              <option value="title">按试卷名称</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="asc">升序</option>
              <option value="desc">降序</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              onClick={fetchExams}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >应用筛选</button>
          </div>
        </div>

        {viewMode === 'list' ? (
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
                      <button onClick={() => openExamInfo(exam)} className="font-medium text-gray-900 text-left hover:text-primary-700">{exam.title}</button>
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
                              category_id: exam.category_id || '',
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
                          onClick={() => publishExam(exam)}
                          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          发布试卷
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam)}
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
        ) : (
          <div>
            {loading ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                <p className="mt-2 text-gray-600">加载中...</p>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">暂无试卷</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getCurrentPageData().map((exam) => (
                  <div key={exam.id} className="bg-white" style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-lg font-semibold text-gray-900">{exam.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{exam.description || '无描述'}</div>
                        </div>
                        <div className="text-right">
                          <div>{getStatusBadge(exam.status)}</div>
                          {exam.creator?.name && <div className="mt-1 text-xs text-gray-500">创建人：{exam.creator.name}</div>}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700">
                        <div>分类：{exam.category || '-'}</div>
                        <div>难度：{getDifficultyBadge(exam.difficulty)}</div>
                        <div>时长：{exam.duration} 分钟</div>
                        <div>总分：{exam.total_score}</div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button onClick={() => openExamInfo(exam)} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded hover:bg-primary-100">查看信息</button>
                        <button onClick={() => handleOpenEditor(exam)} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded hover:bg-primary-100">编辑题目</button>
                        <button onClick={() => { setEditingExam(exam); setFormData({ title: exam.title, description: exam.description || '', category: exam.category || '', difficulty: exam.difficulty, duration: exam.duration, total_score: exam.total_score, pass_score: exam.pass_score, status: exam.status }); setShowModal(true) }} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">编辑信息</button>
                        <button onClick={() => publishExam(exam)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded hover:bg-green-100">发布试卷</button>
                        <button onClick={() => handleDeleteExam(exam)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded hover:bg-red-100">删除</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">请选择分类</option>
                {categoryOptions.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.displayName}
                  </option>
                ))}
              </select>
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
              <option value="draft" disabled={editingExam?.status !== 'draft'}>草稿</option>
              <option value="published" disabled={editingExam?.status === 'published'}>已发布</option>
              <option value="archived" disabled={editingExam?.status !== 'published'}>已归档</option>
            </select>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => updateExamStatus(editingExam?.id || selectedExam?.id, editingExam?.status || selectedExam?.status, formData.status)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              >更新状态</button>
              <span className="text-xs text-gray-500 self-center">允许：草稿→已发布，已发布→已归档，已归档→已发布</span>
            </div>
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
                      <td className="px-4 py-3 text-gray-600">{formatDate(exam.delete_time)}</td>
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
        isOpen={showExamInfo}
        onClose={() => { setShowExamInfo(false); setExamInfo(null) }}
        title="试卷信息"
        size="medium"
        footer={(
          <div className="flex items-center justify-end gap-2 w-full">
            <button onClick={downloadTemplateXlsx} className="px-4 py-2 border border-primary-300 text-primary-700 rounded hover:bg-primary-50">
              {downloadingTpl ? `下载中 ${downloadProgress}%` : '下载导入模板'}
            </button>
            <button onClick={() => setShowImportModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">试题导入</button>
            <button onClick={() => { setShowExamInfo(false); setExamInfo(null) }} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">关闭</button>
          </div>
        )}
      >
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><span className="text-gray-600">标题</span><span className="font-medium">{examInfo?.title || selectedExam?.title}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-600">总分</span><span className="font-medium">{examInfo?.total_score ?? selectedExam?.total_score}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-600">题量</span><span className="font-medium">{examInfo?.question_count ?? '-'}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-600">分类</span><span className="font-medium">{examInfo?.category ?? '-'}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-600">难度</span><span className="font-medium">{examInfo?.difficulty ?? '-'}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-600">时长</span><span className="font-medium">{examInfo?.duration ?? '-'}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-600">创建时间</span><span className="font-medium">{examInfo?.created_at ? formatDate(examInfo.created_at) : (selectedExam?.created_at ? formatDate(selectedExam.created_at) : '-')}</span></div>

        </div>
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportResult(null); setImportProgress(0) }}
        title="试题导入"
        size="large"
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center bg-gray-50" onDragOver={(e)=>{e.preventDefault()}} onDrop={(e)=>{e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) handleFileImport(f)}}>
            <div className="text-gray-700 mb-2">拖拽文件到此处，或点击选择文件</div>
            <input type="file" accept=".txt,.docx,.pdf" onChange={(e) => e.target.files?.[0] && handleFileImport(e.target.files[0])} className="hidden" id="import-file-input" />
            <label htmlFor="import-file-input" className="inline-block px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 cursor-pointer">选择文件</label>
            {importing && (
              <div className="mt-3 w-full bg-gray-200 rounded h-2">
                <div className="bg-primary-600 h-2 rounded" style={{ width: `${importProgress}%` }}></div>
              </div>
            )}
            {importResult && (
              <div className="mt-3 text-sm text-gray-700">成功 {importResult.success} · 失败 {importResult.failed}</div>
            )}
            <div className="mt-4 text-sm">
              <button onClick={downloadTemplateXlsx} className="px-3 py-1.5 border border-primary-300 text-primary-700 rounded hover:bg-primary-50">下载导入模板</button>
              <a href="#/knowledge-base" target="_blank" className="ml-3 text-primary-700 hover:underline">模板使用说明</a>
            </div>
          </div>
          <div className="text-xs text-gray-500">支持 .txt、.docx、.pdf。当前版本优先支持文本格式。</div>
        </div>
      </Modal>



      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }}
        title="确认删除题目"
        size="small"
        zIndex={2000}
        footer={(
          <div className="w-full flex items-center justify-end gap-2">
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={confirmDeleteQuestion} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">确认删除</button>
          </div>
        )}
      >
        <div className="text-gray-700">确定要删除这道题目吗？删除后将无法撤销。</div>
      </Modal>

      {/* 删除试卷确认Modal */}
      <Modal
        isOpen={showDeleteExamModal}
        onClose={() => { setShowDeleteExamModal(false); setExamToDelete(null) }}
        title="确认删除试卷"
        size="small"
        zIndex={2000}
        footer={(
          <div className="w-full flex items-center justify-end gap-2">
            <button onClick={() => { setShowDeleteExamModal(false); setExamToDelete(null) }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={confirmDeleteExam} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">确认删除</button>
          </div>
        )}
      >
        <div className="text-gray-700">
          确定要删除试卷 <span className="font-semibold text-gray-900">"{examToDelete?.title}"</span> 吗？
          <div className="mt-2 text-sm text-gray-600">删除后试卷将移入回收站,可以在回收站中恢复。</div>
        </div>
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
        size="wide"
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
        <div className="flex-1 overflow-hidden flex flex-row gap-4">
          {/* 左侧：题目列表 */}
          <div className="w-2/3 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-800">📋 题目列表</h3>
              <p className="text-sm text-gray-600 mt-1">
                拖拽题目可调整顺序 · 共 {questions.length} 道题
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm">
                  当前总分：{getCurrentTotalScore()} / 试卷总分：{selectedExam?.total_score}
                </div>
                <div className="w-1/2 h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-2 bg-green-500" style={{ width: `${Math.min(100, Math.round(((getCurrentTotalScore() || 0) / (selectedExam?.total_score || 1)) * 100))}%` }}></div>
                </div>
              </div>
            </div>

            <div className={`relative flex-1 overflow-y-auto p-4 ${isDraggingOverExam ? 'ring-2 ring-primary-300 rounded-lg' : ''}`}
                 ref={examListRef}
                 onDragEnter={handleContainerDragEnter}
                 onDragOver={handleContainerDragOver}
                 onDragLeave={handleContainerDragLeave}
                 onDrop={handleDropToContainer}>
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
                      data-index={index}
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
          <div className="w-1/3 min-w-[280px] flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分值 *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    onClick={() => { const v = Math.max(1, (parseInt(newQuestion.score, 10) || 0) - 1); setNewQuestion({ ...newQuestion, score: v }); if (editingQuestion && autoSave) { debouncedSave({ score: v }) } }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newQuestion.score}
                    onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; setNewQuestion({ ...newQuestion, score: v }); if (editingQuestion && autoSave) { debouncedSave({ score: v }) } }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    onClick={() => { const v = (parseInt(newQuestion.score, 10) || 0) + 1; setNewQuestion({ ...newQuestion, score: v }); if (editingQuestion && autoSave) { debouncedSave({ score: v }) } }}
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 10, 15, 20].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`px-3 py-1.5 rounded border ${newQuestion.score === v ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                      onClick={() => { setNewQuestion({ ...newQuestion, score: v }); if (editingQuestion && autoSave) { debouncedSave({ score: v }) } }}
                    >
                      {v}分
                    </button>
                  ))}
                </div>
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

      <Modal
        isOpen={scoreModalOpen}
        onClose={() => setScoreModalOpen(false)}
        title="总分超出限制"
        size="medium"
      >
        <div className="space-y-3">
          <div className="text-red-600 font-semibold">试卷题目累计总分超过试卷设置总分</div>
          <div className="text-sm text-gray-700">
            当前总分：<span className="font-bold text-red-600">{scoreInfo.currentSum}</span>，试卷设置总分：<span className="font-bold">{scoreInfo.examTotal}</span>
          </div>
          <div className="text-sm text-gray-600">请调整题目分值或数量，使累计总分不超过试卷设置总分。</div>
          <div className="pt-2">
            <button onClick={() => setScoreModalOpen(false)} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">确认</button>
          </div>
        </div>
      </Modal>

      {/* 已发布试卷编辑警告模态框 */}
      <Modal
        isOpen={showPublishedWarning}
        onClose={() => setShowPublishedWarning(false)}
        title="无法编辑已发布的试卷"
        size="medium"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span className="text-3xl">⚠️</span>
            <div>
              <div className="font-semibold text-yellow-800">该试卷已发布</div>
              <div className="text-sm text-yellow-700 mt-1">
                已发布的试卷不允许编辑，以确保考试的公平性和一致性。
              </div>
            </div>
          </div>

          {selectedExam && (
            <div className="text-sm text-gray-600 space-y-1">
              <div><span className="font-medium">试卷名称：</span>{selectedExam.title}</div>
              <div><span className="font-medium">发布状态：</span><span className="text-green-600 font-semibold">已发布</span></div>
            </div>
          )}

          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
            <div className="font-medium mb-1">💡 建议：</div>
            <ul className="list-disc list-inside space-y-1">
              <li>如需修改，请先将试卷归档</li>
              <li>或者创建一个新的试卷副本进行编辑</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowPublishedWarning(false)}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ExamManagement
