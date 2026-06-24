import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal, Input, Select, Space, Tag, Empty, Button } from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  SaveOutlined,
  CloseOutlined,
  MinusOutlined
} from '@ant-design/icons';
import api from '../../../api';

const DeviceModelEditor = ({ isOpen, deviceId, onClose, onSave, categories, forms }) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [formId, setFormId] = useState('');
  const [description, setDescription] = useState('');
  
  const [compTypes, setCompTypes] = useState([]); 
  const [selectedTypeId, setSelectedCompTypeId] = useState(null); 
  const [availableComponents, setAvailableComponents] = useState([]); 
  const [assembledItems, setAssembledItems] = useState([]); 

  useEffect(() => {
    if (isOpen) {
      fetchCompTypes();
      if (deviceId) fetchDeviceDetails();
      else resetForm();
    }
  }, [isOpen, deviceId]);

  const resetForm = () => {
    setName(''); setCategoryId(''); setFormId(''); setDescription(''); setAssembledItems([]);
  };

  const fetchDeviceDetails = async () => {
    try {
      const res = await api.get(`/assets/devices/${deviceId}`);
      if (res.data.success) {
        const d = res.data.data;
        setName(d.name);
        setCategoryId(d.category_id);
        setFormId(d.form_id);
        setDescription(d.description || '');
        setAssembledItems(d.template.map(t => ({
          id: t.component_id,
          component_id: t.component_id,
          name: t.name,
          type_name: t.type_name,
          quantity: t.quantity
        })));
      }
    } catch (e) { toast.error('加载详情失败'); }
  };

  const fetchCompTypes = async () => {
    const res = await api.get('/assets/component-types');
    if (res.data.success) {
      setCompTypes(res.data.data);
      if (res.data.data.length > 0 && !selectedTypeId) setSelectedCompTypeId(res.data.data[0].id);
    }
  };

  useEffect(() => {
    if (selectedTypeId) fetchComponentsByType(selectedTypeId);
  }, [selectedTypeId]);

  const fetchComponentsByType = async (typeId) => {
    const res = await api.get(`/assets/components?type_id=${typeId}`);
    if (res.data.success) setAvailableComponents(res.data.data);
  };

  const addComponent = (comp) => {
    const exists = assembledItems.find(item => item.component_id === comp.id);
    if (exists) {
      setAssembledItems(assembledItems.map(item => 
        item.component_id === comp.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setAssembledItems([...assembledItems, {
        id: comp.id,
        component_id: comp.id,
        name: comp.name,
        type_name: comp.type_name,
        quantity: 1
      }]);
    }
  };

  const handleSubmit = async () => {
    if (!name || !categoryId || !formId) return toast.error('请完善基础信息');
    try {
      const payload = {
        name, category_id: categoryId, form_id: formId, description, 
        template: assembledItems.map(item => ({ component_id: item.component_id, quantity: item.quantity }))
      };
      const res = deviceId ? await api.put(`/assets/devices/${deviceId}`, payload) : await api.post('/assets/devices', payload);
      if (res.data.success) {
        toast.success('保存成功');
        onSave?.();
        onClose();
      }
    } catch (e) { toast.error('操作失败'); }
  };

  return (
    <Modal
      title={deviceId ? "编辑设备型号" : "组装新设备"}
      open={isOpen}
      onCancel={onClose}
      onOk={handleSubmit}
      width={1000}
      centered
      okText="保存发布"
      cancelText="取消"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex h-[600px] border-t border-gray-100">
        {/* 1. 左侧：分类导航 */}
        <div className="w-40 border-r border-gray-100 bg-gray-50/50 py-4">
          {compTypes.map(type => (
            <div 
              key={type.id} 
              onClick={() => setSelectedCompTypeId(type.id)}
              className={`px-6 py-3 cursor-pointer transition-all text-sm ${selectedTypeId === type.id ? 'bg-white text-blue-600 font-bold border-r-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {type.name}
            </div>
          ))}
        </div>

        {/* 2. 中间：备选配件 */}
        <div className="w-64 border-r border-gray-100 flex flex-col">
          <div className="p-3 bg-gray-50/30 text-xs font-bold text-gray-400 uppercase">点击添加配件</div>
          <div className="flex-1 overflow-y-auto">
            {availableComponents.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无数据" className="mt-10" /> : 
              availableComponents.map(comp => (
                <div 
                  key={comp.id} 
                  onClick={() => addComponent(comp)}
                  className="px-4 py-3 border-b border-gray-50 hover:bg-blue-50 cursor-pointer group transition-colors"
                >
                  <div className="text-sm font-medium text-gray-700">{comp.name}</div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">{comp.model || '标准规格'}</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* 3. 右侧：工作区 */}
        <div className="flex-1 flex flex-col bg-white">
          {/* 基础信息 */}
          <div className="p-6 border-b border-gray-100 bg-gray-50/20">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[11px] text-gray-400 mb-1 font-bold">设备名称</div>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="如: ThinkPad X1 Carbon" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-gray-400 mb-1 font-bold">业务分类</div>
                  <Select className="w-full" value={categoryId} onChange={setCategoryId} options={categories.map(c => ({ label: c.name, value: c.id }))} />
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 mb-1 font-bold">设备形态</div>
                  <Select className="w-full" value={formId} onChange={setFormId} options={forms.map(f => ({ label: f.name, value: f.id }))} />
                </div>
              </div>
            </div>
          </div>

          {/* 已选配件清单 */}
          <div className="p-3 bg-gray-50/30 text-xs font-bold text-gray-400 uppercase border-b border-gray-100">配置清单</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {assembledItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <PlusOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                <p className="text-xs">请从左侧选择硬件构成</p>
              </div>
            ) : (
              assembledItems.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg hover:border-blue-200 transition-all bg-white group">
                  <div className="flex-1">
                    <div className="text-xs text-blue-500 font-bold mb-0.5">{item.type_name}</div>
                    <div className="text-sm font-medium text-gray-800">{item.name}</div>
                  </div>
                  <div className="flex items-center bg-gray-50 rounded px-2 py-1 gap-3">
                    <MinusOutlined className="cursor-pointer text-xs hover:text-blue-600" onClick={() => item.quantity > 1 && setAssembledItems(assembledItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i))} />
                    <span className="text-sm font-bold min-w-[20px] text-center">{item.quantity}</span>
                    <PlusOutlined className="cursor-pointer text-xs hover:text-blue-600" onClick={() => setAssembledItems(assembledItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))} />
                  </div>
                  <DeleteOutlined className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors" onClick={() => setAssembledItems(assembledItems.filter(i => i.id !== item.id))} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeviceModelEditor;