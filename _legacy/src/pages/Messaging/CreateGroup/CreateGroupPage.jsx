import React, { useState } from 'react';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
  TeamOutlined,
  CheckOutlined,
  ContactsOutlined,
  GroupOutlined,
} from '@ant-design/icons';
import './CreateGroupPage.css';

const CreateGroupPage = () => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'manage'
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Mock data for employees
  const employees = [
    { id: 1, name: '张三', department: '客服部', avatar: '张' },
    { id: 2, name: '李四', department: '技术部', avatar: '李' },
    { id: 3, name: '王五', department: '人事部', avatar: '王' },
    { id: 4, name: '赵六', department: '财务部', avatar: '赵' },
    { id: 5, name: '钱七', department: '市场部', avatar: '钱' },
    { id: 6, name: '孙八', department: '运营部', avatar: '孙' },
    { id: 7, name: '周九', department: '客服部', avatar: '周' },
    { id: 8, name: '吴十', department: '技术部', avatar: '吴' },
  ];

  // Mock data for existing groups
  const existingGroups = [
    { id: 1, name: '客服一组', members: 12, avatar: '客' },
    { id: 2, name: '技术组', members: 8, avatar: '技' },
    { id: 3, name: '管理层', members: 5, avatar: '管' },
  ];

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleMemberSelection = (employee) => {
    if (selectedMembers.some(member => member.id === employee.id)) {
      setSelectedMembers(selectedMembers.filter(member => member.id !== employee.id));
    } else {
      setSelectedMembers([...selectedMembers, employee]);
    }
  };

  return (
    <div className="create-group-page">
      {/* Header */}
      <div className="create-group-header">
        <button className="header-btn">
          <ArrowLeftOutlined />
        </button>
        <div className="header-title">
          <h2>群组管理</h2>
        </div>
        <button className="header-btn">
          {/* Empty button for spacing */}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <PlusOutlined />
          <span>创建群组</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          <ContactsOutlined />
          <span>群组管理</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Create Group Tab */}
        {activeTab === 'create' && (
          <div className="tab-pane">
            {/* Group Info Section */}
            <div className="group-info-section">
              <h3 className="section-title">群组信息</h3>
              <div className="group-info-form">
                <div className="form-group">
                  <label className="form-label">群组名称</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="请输入群组名称"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">群组描述</label>
                  <textarea
                    className="form-textarea"
                    placeholder="请输入群组描述（可选）"
                    rows="2"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Member Selection Section */}
            <div className="member-section">
              <h3 className="section-title">添加成员</h3>

              {/* Selected Members Preview */}
              {selectedMembers.length > 0 && (
                <div className="selected-members-preview">
                  <div className="selected-members-list">
                    {selectedMembers.map((member) => (
                      <div key={member.id} className="selected-member-item">
                        <div className="member-avatar selected">{member.avatar}</div>
                        <span className="member-name">{member.name}</span>
                        <button
                          className="remove-member-btn"
                          onClick={() => toggleMemberSelection(member)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="selected-count">
                    已选择 {selectedMembers.length} 人
                  </div>
                </div>
              )}

              {/* Search Box */}
              <div className="member-search">
                <div className="search-input-wrapper">
                  <SearchOutlined className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="搜索成员"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Members List */}
              <div className="members-list">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className={`member-item ${
                      selectedMembers.some(member => member.id === employee.id) ? 'selected' : ''
                    }`}
                    onClick={() => toggleMemberSelection(employee)}
                  >
                    <div className="member-avatar">{employee.avatar}</div>
                    <div className="member-info">
                      <div className="member-name">{employee.name}</div>
                      <div className="member-department">{employee.department}</div>
                    </div>
                    {selectedMembers.some(member => member.id === employee.id) ? (
                      <div className="selection-indicator selected">
                        <CheckOutlined />
                      </div>
                    ) : (
                      <div className="selection-indicator">
                        <PlusOutlined />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button className="cancel-btn">取消</button>
              <button
                className={`create-btn ${selectedMembers.length === 0 ? 'disabled' : ''}`}
                disabled={selectedMembers.length === 0 || !groupName.trim()}
              >
                创建群组
              </button>
            </div>
          </div>
        )}

        {/* Manage Groups Tab */}
        {activeTab === 'manage' && (
          <div className="tab-pane">
            <div className="manage-groups-section">
              <h3 className="section-title">我的群组</h3>

              {/* Search Box */}
              <div className="group-search">
                <div className="search-input-wrapper">
                  <SearchOutlined className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="搜索群组"
                  />
                </div>
              </div>

              {/* Groups List */}
              <div className="groups-list">
                {existingGroups.map((group) => (
                  <div key={group.id} className="group-item">
                    <div className="group-avatar">{group.avatar}</div>
                    <div className="group-info">
                      <div className="group-name">{group.name}</div>
                      <div className="group-meta">{group.members} 成员</div>
                    </div>
                    <div className="group-actions">
                      <button className="action-btn edit-btn">
                        <span>编辑</span>
                      </button>
                      <button className="action-btn delete-btn">
                        <span>删除</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {existingGroups.length === 0 && (
                <div className="empty-state">
                  <GroupOutlined className="empty-icon" />
                  <p>暂无群组</p>
                  <p className="empty-desc">点击"创建群组"开始创建</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroupPage;
