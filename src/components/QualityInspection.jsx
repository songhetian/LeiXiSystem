import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { qualityAPI } from '../api'
import Modal from './Modal'

const QualityInspection = () => {
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [isInspectOpen, setIsInspectOpen] = useState(false)
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [inspectionData, setInspectionData] = useState({
    attitude: 0,
    professional: 0,
    communication: 0,
    compliance: 0,
    comment: ''
  })

  useEffect(() => {
    loadInspections()
  }, [])

  const loadInspections = async () => {
    try {
      setLoading(true)
      const response = await qualityAPI.getAll()
      setInspections(response.data)
    } catch (error) {
      toast.error('加载质检列表失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleInspect = (inspection) => {
    setSelectedInspection(inspection)
    setInspectionData({
      attitude: 0,
      professional: 0,
      communication: 0,
      compliance: 0,
      comment: ''
    })
    setIsInspectOpen(true)
  }

  const handleSubmitInspection = async () => {
    try {
      const totalScore = Math.round(
        inspectionData.attitude * 0.3 +
        inspectionData.professional * 0.3 +
        inspectionData.communication * 0.2 +
        inspectionData.compliance * 0.2
      )

      await qualityAPI.submit({
        sessionId: selectedInspection.id,
        scores: inspectionData,
        comment: inspectionData.comment
      })

      toast.success('质检完成！')
      setIsInspectOpen(false)
      loadInspections()
    } catch (error) {
      toast.error('提交质检失败')
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
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">质检管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {inspections.length} 条质检记录</p>
          </div>
          <div className="flex gap-3">
            <select className="px-4 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>全部状态</option>
              <option>待质检</option>
              <option>已完成</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-primary-100 text-primary-800">
                <th className="px-4 py-3 text-left rounded-tl-lg">会话ID</th>
                <th className="px-4 py-3 text-left">客服</th>
                <th className="px-4 py-3 text-left">质检员</th>
                <th className="px-4 py-3 text-left">评分</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">日期</th>
                <th className="px-4 py-3 text-center rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                inspections.map((inspection, index) => (
                  <tr key={inspecti.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'} hover:bg-primary-100/50 transition-colors`}>
                    <td className="px-4 py-3 font-medium">#{inspection.sessionId}</td>
                    <td className="px-4 py-3">{inspection.agent}</td>
                    <td className="px-4 py-3 text-gray-600">{inspection.inspector || '-'}</td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        inspection.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {inspection.status === 'completed' ? '已完成' : '待质检'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inspection.date}</td>
                    <td className="px-4 py-3 text-center">
                      {inspection.status === 'pending' ? (
                        <button
                          onClick={() => handleInspect(inspection)}
                          className="px-4 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          开始质检
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInspect(inspection)}
                          className="px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
      </div>

      <Modal isOpen={isInspectOpen} onClose={() => setIsInspectOpen(false)} title="质检评分">
        {selectedInspection && (
          <div className="space-y-6">
            <div className="bg-primary-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">会话信息</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>会话ID: #{selectedInspection.sessionId}</div>
                <div>客服: {selectedInspection.agent}</div>
              </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">评价意见</label>
              <textarea
                value={inspectionData.comment}
                onChange={(e) => setInspectionData({...inspectionData, comment: e.target.value})}
                className="w-full px-4 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows="4"
                placeholder="请输入评价意见和改进建议..."
              />
            </div>

            <div className="bg-primary-100 rounded-lg p-4">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">综合得分</div>
                <div className="text-3xl font-bold text-primary-700">
                  {Math.round(
                    inspectionData.attitude * 0.3 +
                    inspectionData.professional * 0.3 +
                    inspectionData.communication * 0.2 +
                    inspectionData.compliance * 0.2
                  )}分
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsInspectOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmitInspection}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg"
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
