import React, { useState, useEffect, useRef } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import qualityAPI from './api/qualityAPI'
import Modal from './Modal'
import ImportSessionModal from './ImportSessionModal'

const QualityInspection = () => {
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [isInspectOpen, setIsInspectOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [sessionMessages, setSessionMessages] = useState([]); // New state for session messages
  const [inspectionData, setInspectionData] = useState({
    attitude: 0,
    professional: 0,
    communication: 0,
    compliance: 0,
    comment: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const chatHistoryRef = useRef(null);
  const [filters, setFilters] = useState({
    search: '',
    customerServiceId: '',
    status: '',
    channel: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadInspections();
  }, [pagination.page, pagination.pageSize, filters]); // Reload inspections when page, pageSize, or filters change

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [sessionMessages]);

  const loadInspections = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getAllSessions({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters,
      });
      setInspections(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('加载质检列表失败');
      console.error('Error loading inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPagination({ ...pagination, page: 1 }); // Reset to first page on filter change
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleInspect = async (inspection) => { // Made async to fetch messages
    setSelectedInspection(inspection)
    setInspectionData({
      attitude: inspection.score_details?.attitude || 0, // Pre-fill if already scored
      professional: inspection.score_details?.professional || 0,
      communication: inspection.score_details?.communication || 0,
      compliance: inspection.score_details?.compliance || 0,
      comment: inspection.comment || ''
    })
    setIsInspectOpen(true)

    // Fetch session messages
    try {
      const messagesResponse = await qualityAPI.getSessionMessages(inspection.id);
      setSessionMessages(messagesResponse.data.data);
    } catch (error) {
      toast.error('加载会话消息失败');
      console.error('Error loading session messages:', error);
      setSessionMessages([]); // Clear messages on error
    }
  }

  const handleSubmitInspection = async () => {
    try {
      const totalScore = Math.round(
        inspectionData.attitude * 0.3 +
        inspectionData.professional * 0.3 +
        inspectionData.communication * 0.2 +
        inspectionData.compliance * 0.2
      )

      await qualityAPI.submitReview(selectedInspection.id, {
        score: totalScore,
        grade: 'A', // Placeholder, actual grade logic might be more complex
        rule_scores: [ // Example structure, adjust based on actual backend expectation
          { rule_id: 1, score: inspectionData.attitude, comment: 'Attitude score' },
          { rule_id: 2, score: inspectionData.professional, comment: 'Professional score' },
          { rule_id: 3, score: inspectionData.communication, comment: 'Communication score' },
          { rule_id: 4, score: inspectionData.compliance, comment: 'Compliance score' },
        ],
        comment: inspectionData.comment
      })

      toast.success('质检完成！')
      setIsInspectOpen(false)
      loadInspections()
    } catch (error) {
      toast.error('提交质检失败: ' + (error.response?.data?.message || error.message))
      console.error('Error submitting inspection:', error)
    }
  }

  const ScoreInput = ({ label, value, onChange, weight }) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm text-gray-500">权重: {weight}%</span>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #22c55e 0%, #22c55e ${value}%, #bbf7d0 ${value}%, #bbf7d0 100%)`
          }}
        />
        <span className="text-lg font-semibold text-primary-700 w-12 text-right">{value}</span>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="business-card">
        <div className="business-card-header">
          <div>
            <h2 className="business-card-title">质检管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {pagination.total} 条质检记录</p>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              name="search"
              placeholder="搜索会话编号/客户信息..."
              value={filters.search}
              onChange={handleFilterChange}
              className="business-input w-64"
            />
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="business-select w-40"
            >
              <option value="">全部状态</option>
              <option value="pending">待质检</option>
              <option value="completed">已完成</option>
            </select>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="business-input w-40"
            />
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="business-input w-40"
            />
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="business-btn business-btn-success"
            >
              导入会话
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="business-table">
            <thead>
              <tr>
                <th>会话ID</th>
                <th>客服</th>
                <th>沟通渠道</th>
                <th>平台</th>
                <th>店铺</th>
                <th>评分</th>
                <th>状态</th>
                <th>日期</th>
                <th className="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td className="font-medium">#{inspection.session_code}</td>
                    <td>{inspection.customer_service_name}</td>
                    <td>{inspection.communication_channel}</td>
                    <td>{inspection.platform}</td>
                    <td>{inspection.shop}</td>
                    <td>
                      {inspection.score ? (
                        <span className={`font-semibold ${
                          inspection.score >= 90 ? 'text-green-600' :
                          inspection.score >= 80 ? 'text-blue-600' :
                          inspection.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {inspection.score}分
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`business-badge ${
                        inspection.quality_status === 'completed'
                          ? 'business-badge-success'
                          : 'business-badge-warning'
                      }`}>
                        {inspection.quality_status === 'completed' ? '已完成' : '待质检'}
                      </span>
                    </td>
                    <td>{formatDate(inspection.created_at)}</td>
                    <td className="text-center">
                      {inspection.quality_status === 'pending' ? (
                        <button
                          onClick={() => handleInspect(inspection)}
                          className="business-btn business-btn-primary business-btn-sm"
                        >
                          开始质检
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInspect(inspection)}
                          className="business-btn business-btn-secondary business-btn-sm"
                        >
                          查看详情
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center mt-6 space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="business-btn business-btn-secondary business-btn-sm"
            >
              上一页
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`business-btn business-btn-sm ${
                  pagination.page === p ? 'business-btn-primary' : 'business-btn-secondary'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="business-btn business-btn-secondary business-btn-sm"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      <ImportSessionModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      <Modal isOpen={isInspectOpen} onClose={() => setIsInspectOpen(false)} title="质检评分">
        {selectedInspection && (
          <div className="space-y-6">
            <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
              <h3 className="font-semibold mb-2 text-primary-800">会话信息</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-primary-700">
                <div>会话ID: #{selectedInspection.session_code}</div>
                <div>客服: {selectedInspection.customer_service_name}</div>
                <div>渠道: {selectedInspection.communication_channel}</div>
                <div>时长: {selectedInspection.duration}s</div>
                <div>消息数: {selectedInspection.message_count}</div>
                <div>创建日期: {formatDate(selectedInspection.created_at)}</div>
              </div>
            </div>

            {/* Chat History Display */}
            <div ref={chatHistoryRef} className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto border border-gray-200">
                <h4 className="font-semibold mb-2 text-gray-700">会话消息</h4>
                {sessionMessages.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">暂无会话消息</p>
                ) : (
                    <div className="space-y-4 pt-2">
                        {sessionMessages.map((message) => {
                            const isAgent = message.sender_type === 'agent' || message.sender_type === 'customer_service';
                            return (
                                <div key={message.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex flex-col max-w-[80%] ${isAgent ? 'items-end' : 'items-start'}`}>
                                        <div className="text-xs text-gray-500 mb-1">
                                            {isAgent ? '客服' : '客户'} • {new Date(message.sent_at).toLocaleTimeString()}
                                        </div>
                                        <div className={`p-3 rounded-xl ${
                                            isAgent
                                                ? 'bg-blue-100 text-blue-900 rounded-br-none'
                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                                        } shadow-sm`}>
                                            <p className="text-sm break-words">{message.message_content}</p>
                                        </div>
                                    </div>
                                </div>
                            )})}
                    </div>
                )}
            </div>

            <div className="space-y-4">
              <ScoreInput
                label="服务态度"
                value={inspectionData.attitude}
                onChange={(v) => setInspectionData({...inspectionData, attitude: v})}
                weight={30}
              />
              <ScoreInput
                label="专业能力"
                value={inspectionData.professional}
                onChange={(v) => setInspectionData({...inspectionData, professional: v})}
                weight={30}
              />
              <ScoreInput
                label="沟通技巧"
                value={inspectionData.communication}
                onChange={(v) => setInspectionData({...inspectionData, communication: v})}
                weight={20}
              />
              <ScoreInput
                label="合规性"
                value={inspectionData.compliance}
                onChange={(v) => setInspectionData({...inspectionData, compliance: v})}
                weight={20}
              />
            </div>

            <div>
              <label className="business-label">评价意见</label>
              <textarea
                value={inspectionData.comment}
                onChange={(e) => setInspectionData({...inspectionData, comment: e.target.value})}
                className="business-textarea"
                rows="4"
                placeholder="请输入评价意见和改进建议..."
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">综合得分</div>
                <div className="text-3xl font-bold text-primary-600">
                  {Math.round(
                    inspectionData.attitude * 0.3 +
                    inspectionData.professional * 0.3 +
                    inspectionData.communication * 0.2 +
                    inspectionData.compliance * 0.2
                  )}分
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsInspectOpen(false)}
                className="business-btn business-btn-secondary"
               >
                取消
              </button>
              <button
                onClick={handleSubmitInspection}
                className="business-btn business-btn-primary"
              >
                提交质检
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default QualityInspection
