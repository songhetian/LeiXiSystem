'use client';

import { useState } from 'react';
import { Modal, Input, Button, Checkbox, Message, Empty } from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus, IconRefresh, IconCheck } from '@arco-design/web-react/icon';
import type { QuickActionsApi, QuickActionDef } from '@/hooks/use-quick-actions';

export interface QuickActionsManagerProps {
  visible: boolean;
  onClose: () => void;
  api: QuickActionsApi;
  /** 自定义项的图标渲染器（与首页入口池保持同一套图标风格） */
  renderIcon?: (action: QuickActionDef) => React.ReactNode;
}

/**
 * 快捷操作管理面板：预定义入口显隐勾选 + 自定义入口的增 / 改 / 删 + 恢复默认。
 * 数据由 useQuickActions 统一托管（localStorage 持久化），本组件只做交互。
 */
export default function QuickActionsManager({ visible, onClose, api, renderIcon }: QuickActionsManagerProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newPath, setNewPath] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editPath, setEditPath] = useState('');

  const handleAdd = () => {
    const err = api.addCustom(newLabel, newPath);
    if (err) {
      Message.error(err);
      return;
    }
    Message.success('已添加快捷入口');
    setNewLabel('');
    setNewPath('');
  };

  const startEdit = (item: QuickActionDef) => {
    setEditingKey(item.key);
    setEditLabel(item.label);
    setEditPath(item.path);
  };

  const saveEdit = () => {
    if (!editingKey) return;
    const err = api.updateCustom(editingKey, { label: editLabel, path: editPath });
    if (err) {
      Message.error(err);
      return;
    }
    Message.success('已保存');
    setEditingKey(null);
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      title="管理快捷操作"
      footer={
        <div className="lx-qa-footer">
          <Button
            icon={<IconRefresh />}
            onClick={() => {
              api.reset();
              Message.success('已恢复默认');
            }}
          >
            恢复默认
          </Button>
          <Button type="primary" onClick={onClose}>
            完成
          </Button>
        </div>
      }
      style={{ width: 560 }}
      maskClosable
    >
      {/* 预定义入口：勾选即显示 */}
      <div className="lx-qa-section">
        <div className="lx-qa-section-title">
          显示入口
          <span className="lx-qa-hint">取消勾选后从首页隐藏，随时可恢复</span>
        </div>
        <div className="lx-qa-pool">
          {api.pool.map((item) => {
            const checked = !api.hiddenKeys.includes(item.key);
            return (
              <label
                key={item.key}
                className={`lx-qa-pool-item ${checked ? 'is-on' : ''}`}
                data-testid={`qa-pool-${item.key}`}
              >
                <Checkbox
                  checked={checked}
                  onChange={() => api.toggle(item.key)}
                  aria-label={`${checked ? '隐藏' : '显示'}${item.label}`}
                />
                <span className="lx-qa-pool-ic">{renderIcon?.(item)}</span>
                <span className="lx-qa-pool-label">{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 自定义入口：增删改 */}
      <div className="lx-qa-section">
        <div className="lx-qa-section-title">
          自定义入口
          <span className="lx-qa-hint">可添加任意系统页面链接</span>
        </div>

        {api.custom.length === 0 ? (
          <Empty description="还没有自定义入口" style={{ padding: '12px 0' }} />
        ) : (
          <div className="lx-qa-custom-list">
            {api.custom.map((item) =>
              editingKey === item.key ? (
                <div className="lx-qa-custom-row is-editing" key={item.key}>
                  <Input
                    size="small"
                    value={editLabel}
                    onChange={setEditLabel}
                    placeholder="名称"
                    style={{ width: 120 }}
                    aria-label="入口名称"
                  />
                  <Input
                    size="small"
                    value={editPath}
                    onChange={setEditPath}
                    placeholder="/路径"
                    aria-label="入口路径"
                  />
                  <Button size="small" type="primary" icon={<IconCheck />} onClick={saveEdit}>
                    保存
                  </Button>
                  <Button size="small" onClick={() => setEditingKey(null)}>
                    取消
                  </Button>
                </div>
              ) : (
                <div className="lx-qa-custom-row" key={item.key}>
                  <span className="lx-qa-pool-ic">{renderIcon?.(item)}</span>
                  <span className="lx-qa-custom-label">{item.label}</span>
                  <code className="lx-qa-custom-path">{item.path}</code>
                  <Button
                    size="mini"
                    type="text"
                    icon={<IconEdit />}
                    onClick={() => startEdit(item)}
                    aria-label={`编辑${item.label}`}
                  />
                  <Button
                    size="mini"
                    type="text"
                    status="danger"
                    icon={<IconDelete />}
                    onClick={() => {
                      api.removeCustom(item.key);
                      Message.success('已删除');
                    }}
                    aria-label={`删除${item.label}`}
                  />
                </div>
              ),
            )}
          </div>
        )}

        <div className="lx-qa-add-row">
          <Input
            size="small"
            value={newLabel}
            onChange={setNewLabel}
            placeholder="名称，如：我的排班"
            style={{ width: 140 }}
            aria-label="新入口名称"
          />
          <Input
            size="small"
            value={newPath}
            onChange={setNewPath}
            placeholder="路径，如：/attendance/my-schedule"
            aria-label="新入口路径"
          />
          <Button size="small" type="primary" icon={<IconPlus />} onClick={handleAdd}>
            添加
          </Button>
        </div>
      </div>
    </Modal>
  );
}
