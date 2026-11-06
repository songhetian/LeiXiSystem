'use client';

import { useMemo, useState } from 'react';
import { Button, Message, Modal, Popover, Radio, Select } from '@arco-design/web-react';
import { IconInfoCircle } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import {
  approvalApi,
  WorkflowRoleBinding,
  WorkflowRoleBindingList,
  WorkflowRoleBindMode,
} from '@/services/approval';
import { BUSINESS_MODULE_LABELS } from '@/lib/workflow-codes';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { notifyError } from '@/lib/request';

const BINDINGS_KEY = 'config:approval:workflow-role-bindings';

/**
 * 业务模块的分类色：只用在模块标题前的 6px 圆点上。
 * 一色一义（考勤=青 / 报销=橙 / 员工事务=靛 / 通用=中性），
 * 与首页、侧栏的业务域色同一套语汇，不再给每个模块配一个自选色相。
 */
const MODULE_TONE: Record<string, string> = {
  attendance: 'var(--lx-teal)',
  reimbursement: 'var(--lx-coral)',
  employees: 'var(--lx-indigo)',
  general: 'var(--lx-text-4)',
};

const STATUS_LABEL: Record<string, string> = {
  active: '启用',
  inactive: '停用',
  draft: '草稿',
};

const MODE_LABEL: Record<WorkflowRoleBindMode, string> = {
  replace: '覆盖',
  append: '追加',
  remove: '移除',
};

const MODE_HINT: Record<WorkflowRoleBindMode, string> = {
  replace: '把这批流程的适用角色整体替换为所选集（原有绑定会被清掉）',
  append: '在现有基础上补充所选角色，已有绑定保持不变',
  remove: '从这批流程中移除所选角色，其它角色的绑定不受影响',
};

interface RoleGroup {
  module: string;
  label: string;
  items: WorkflowRoleBinding[];
  bound: number;
}

/**
 * 流程适用角色：审批流程的适用角色管理。
 *
 * 方向是 **流程 → 角色**（一条流程适用哪些角色），所以同一角色天然可以出现在
 * 多条流程里：请假、加班、报销都适用「普通员工」是常态。
 *
 * 逐条配置太慢（13 条流程要点 13 次），因此提供两级快捷：
 * - 行内：一条流程一键「全部角色 / 清空」；
 * - 页头：批量设置 —— 一次把同一组角色覆盖到全部流程或某个业务模块，
 *   后端在一个事务里写完，不会出现「一半新一半旧」的中间态。
 */
export default function RoleWorkflowPage() {
  const { can } = usePermission();
  const managePerm = can('approval:workflow:manage');

  const { data, loading, error, revalidate } = useCachedData<WorkflowRoleBindingList>(
    BINDINGS_KEY,
    async () => {
      const res = await approvalApi.listWorkflowRoleBindings();
      if (res.code === 0 && res.data) return res.data;
      throw new Error(res.message || '获取流程角色配置失败');
    },
  );

  // Arco 的 Select 是**完全受控**的（props 里有 value 就永远用 props 的值，内部 setValue 被忽略），
  // 所以「点完直接依赖服务端返回的新值」会出现一次回弹：新标签当场消失，等 revalidate 回来才重新出现。
  // 这里挂一个乐观值顶上，写入结束（成功或失败）再摘掉，回落成服务端的真实绑定。
  const [pendingRoles, setPendingRoles] = useState<Record<number, number[]>>({});
  /**
   * 正在保存的流程集合。只记一条会漏：第二行开始保存时，第一行会因为「当前保存的不是它」
   * 被解除禁用，同一条流程就能并发出两个全量覆盖的写，落库顺序还不保证。
   */
  const [savingIds, setSavingIds] = useState<number[]>([]);

  /** 该行当前应显示的角色：写入中的乐观值优先，否则用服务端值 */
  const roleIdsOf = (w: WorkflowRoleBinding) => pendingRoles[w.id] ?? w.roles.map((r) => r.id);

  // ---- 批量设置 ----
  const [bulkOpen, setBulkOpen] = useState(false);
  /** 'all' 或业务模块 key；从模块头的「批量设置」进入时预填该模块 */
  const [bulkScope, setBulkScope] = useState<string>('all');
  const [bulkRoleIds, setBulkRoleIds] = useState<number[]>([]);
  const [bulkMode, setBulkMode] = useState<WorkflowRoleBindMode>('replace');
  const [bulkSaving, setBulkSaving] = useState(false);

  const roleOptions = useMemo(
    () =>
      (data?.roles ?? []).map((r) => ({
        label: r.name,
        value: r.id,
        // 搜索口径：姓名 + 编码。Arco 用 options 数组时只透传 value/disabled/extra，
        // 自定义字段会被丢掉，所以搜索串必须放在 extra 里
        extra: `${r.name} ${r.code}`,
      })),
    [data?.roles],
  );

  const allRoleIds = useMemo(() => (data?.roles ?? []).map((r) => r.id), [data?.roles]);

  // 模块按业务顺序排（考勤 → 报销 → 员工事务 → 通用），而不是按英文 module 字母序：
  // 后端只能按内部值排，'reimbursement' 会排到 'employees'/'general' 后面，读起来是乱的
  const groups = useMemo<RoleGroup[]>(() => {
    const order = Object.keys(BUSINESS_MODULE_LABELS);
    const rank = (m: string) => (order.includes(m) ? order.indexOf(m) : order.length);
    const sorted = [...(data?.workflows ?? [])].sort(
      (a, b) => rank(a.module) - rank(b.module) || a.id - b.id,
    );
    const map = new Map<string, WorkflowRoleBinding[]>();
    for (const w of sorted) {
      if (!map.has(w.module)) map.set(w.module, []);
      map.get(w.module)!.push(w);
    }
    return Array.from(map, ([module, items]) => ({
      module,
      label: BUSINESS_MODULE_LABELS[module] ?? module,
      items,
      bound: items.filter((w) => w.roles.length > 0).length,
    }));
  }, [data?.workflows]);

  const workflows = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const boundCount = workflows.filter((w) => w.roles.length > 0).length;

  /** 批量设置实际会写到的流程 */
  const bulkTargets = useMemo(
    () => (bulkScope === 'all' ? workflows : workflows.filter((w) => w.module === bulkScope)),
    [bulkScope, workflows],
  );
  const bulkScopeLabel =
    bulkScope === 'all' ? '全部流程' : (BUSINESS_MODULE_LABELS[bulkScope] ?? bulkScope);
  const bulkRoleNames = useMemo(
    () =>
      bulkRoleIds
        .map((id) => data?.roles.find((r) => r.id === id)?.name)
        .filter(Boolean)
        .join('、'),
    [bulkRoleIds, data?.roles],
  );

  const handleChange = async (workflow: WorkflowRoleBinding, roleIds: number[]) => {
    setSavingIds((ids) => (ids.includes(workflow.id) ? ids : [...ids, workflow.id]));
    try {
      const res = await approvalApi.setWorkflowRoles(workflow.id, roleIds);
      if (res.code === 0) {
        Message.success(
          roleIds.length > 0
            ? `「${workflow.name}」已适用于 ${roleIds.length} 个角色`
            : `「${workflow.name}」已解除全部角色`,
        );
        await revalidate();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      notifyError(e, '保存失败');
    } finally {
      setSavingIds((ids) => ids.filter((id) => id !== workflow.id));
      // 成功时服务端值已经等于乐观值，失败时正好回弹到服务端的真实绑定
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[workflow.id];
        return next;
      });
    }
  };

  const openBulk = (scope: string) => {
    setBulkScope(scope);
    setBulkRoleIds([]);
    setBulkMode('replace');
    setBulkOpen(true);
  };

  const bulkSubmitDisabled =
    bulkTargets.length === 0 || (bulkMode !== 'replace' && bulkRoleIds.length === 0);

  const handleBulkSave = async () => {
    if (bulkSubmitDisabled) return;
    setBulkSaving(true);
    try {
      const res = await approvalApi.setWorkflowRolesBatch({
        workflowIds: bulkTargets.map((w) => w.id),
        roleIds: bulkRoleIds,
        mode: bulkMode,
      });
      if (res.code === 0) {
        const n = bulkTargets.length;
        const m = bulkRoleIds.length;
        // affected 是**实际落库的行数**：追加时已有绑定会被跳过、移除时有的流程本来就没绑，
        // 用请求参数（n × m）当结果报出去会夸大改动量
        const affected = res.data?.affected ?? 0;
        Message.success(
          bulkMode === 'replace'
            ? m > 0
              ? `已把 ${n} 条流程的适用角色设为 ${m} 个角色`
              : `已清空 ${n} 条流程的适用角色`
            : bulkMode === 'append'
              ? `已为 ${n} 条流程追加 ${affected} 条绑定`
              : `已从 ${n} 条流程中移除 ${affected} 条绑定`,
        );
        setBulkOpen(false);
        await revalidate();
      } else {
        // 批量失败必须留在弹窗里：关掉弹窗用户就看不到到底哪一步没成
        Message.error(res.message || '批量保存失败');
      }
    } catch (e) {
      notifyError(e, '批量保存失败');
    } finally {
      setBulkSaving(false);
    }
  };

  const renderRoles = (w: WorkflowRoleBinding) => {
    if (!managePerm) {
      return w.roles.length > 0 ? (
        <div className="rw-tags">
          {w.roles.map((r) => (
            <span key={r.id} className="rw-tag">
              {r.name}
            </span>
          ))}
        </div>
      ) : (
        <span className="rw-muted">未指定</span>
      );
    }
    return (
      <Select
        mode="multiple"
        allowClear
        showSearch
        placeholder="未指定角色"
        style={{ width: '100%' }}
        options={roleOptions}
        value={roleIdsOf(w)}
        loading={savingIds.includes(w.id)}
        disabled={savingIds.includes(w.id)}
        onChange={(v) => {
          const next = (v as number[]) ?? [];
          setPendingRoles((prev) => ({ ...prev, [w.id]: next }));
          void handleChange(w, next);
        }}
        filterOption={(input, option) => {
          const props = (option as unknown as { props?: Record<string, unknown> })?.props;
          const text = `${String(props?.children ?? '')} ${String(props?.extra ?? '')}`;
          return text.toLowerCase().includes(input.toLowerCase());
        }}
      />
    );
  };

  const renderRow = (w: WorkflowRoleBinding) => {
    const currentIds = roleIdsOf(w);
    const allSelected = allRoleIds.length > 0 && allRoleIds.every((id) => currentIds.includes(id));
    const rowBusy = savingIds.includes(w.id);
    return (
      <div className="rw-row" key={w.id}>
        <div className="rw-name">
          <span className="rw-name-title">{w.name}</span>
          <span className="rw-name-code">{w.code}</span>
        </div>
        <span className="rw-status" data-status={w.status}>
          {STATUS_LABEL[w.status] ?? w.status}
          {w.status !== 'active' && <em className="rw-status-note">绑定暂不生效</em>}
        </span>
        {/* 一行里有 13 个同构的多选框与「全部角色/清空」，读屏只念控件本身会失去上下文，
            用 group + aria-label 把「哪条流程的」绑上去 */}
        <div className="rw-roles" role="group" aria-label={`${w.name} 的适用角色`}>
          {renderRoles(w)}
        </div>
        {managePerm && (
          <div className="rw-ops">
            <Button
              type="text"
              size="mini"
              className="rw-op"
              aria-label={`${w.name}：套用全部角色`}
              disabled={rowBusy || allSelected || allRoleIds.length === 0}
              onClick={() => handleChange(w, allRoleIds)}
            >
              全部角色
            </Button>
            <Button
              type="text"
              size="mini"
              className="rw-op"
              aria-label={`${w.name}：清空适用角色`}
              disabled={rowBusy || currentIds.length === 0}
              onClick={() => handleChange(w, [])}
            >
              清空
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer
      action={
        <div className="rw-header-actions">
          <span className="rw-header-stat">
            {workflows.length} 条流程 · {boundCount} 条已指定角色
          </span>
          {managePerm && (
            <Button type="primary" onClick={() => openBulk('all')}>
              批量设置
            </Button>
          )}
        </div>
      }
    >
      <div className="rw-intro">
        <span>
          一条流程可适用于多个角色，角色也可以出现在多条流程里。逐条改太慢时用「批量设置」，
          一次把同一组角色套到全部流程或某个业务模块。
        </span>
        <Popover
          position="br"
          content={
            <div className="rw-rules">
              <p>
                <strong>什么时候生效</strong>
                ：业务已在「流程设置」配好流程时以那里为准；这里的绑定用于该业务尚未配置流程时，
                按申请人角色兜底。
              </p>
              <p>
                <strong>多条流程同角色</strong>
                ：同一角色可以绑定多条流程；若兜底时同时命中多条，固定取流程 ID 最小的一条，
                同一申请重复发起始终走同一条审批链。
              </p>
            </div>
          }
        >
          <button type="button" className="rw-rules-trigger">
            <IconInfoCircle /> 配置规则
          </button>
        </Popover>
      </div>

      <DataState
        loading={loading && workflows.length === 0}
        skeleton
        skeletonType="card"
        skeletonRows={4}
        loadingText="正在加载流程角色配置"
        error={error}
        onRetry={revalidate}
        isEmpty={!loading && !!data && workflows.length === 0}
        emptyText="还没有可配置的审批流程，先到「流程设置」新建流程"
      >
        {groups.map((g) => (
          <section className="pro-card rw-group" key={g.module}>
            <div className="rw-group-head">
              <div className="rw-group-title">
                <span
                  className="rw-group-dot"
                  style={{ background: MODULE_TONE[g.module] ?? 'var(--lx-text-4)' }}
                  aria-hidden
                />
                {g.label}
                <span className="rw-group-count">
                  {g.items.length} 条流程 · {g.bound} 条已指定角色
                </span>
              </div>
              {managePerm && (
                <Button size="mini" onClick={() => openBulk(g.module)}>
                  本组批量设置
                </Button>
              )}
            </div>
            <div className="rw-rows">{g.items.map(renderRow)}</div>
          </section>
        ))}
      </DataState>

      <Modal
        title="批量设置适用角色"
        visible={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        onOk={handleBulkSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={bulkSaving}
        okButtonProps={{ disabled: bulkSubmitDisabled }}
        style={{ width: 600 }}
        unmountOnExit
      >
        <div className="rw-field">
          <div className="rw-field-label">应用范围</div>
          <Radio.Group
            type="button"
            value={bulkScope}
            onChange={(v) => setBulkScope(String(v))}
            className="rw-field-radio"
          >
            <Radio value="all">全部 {workflows.length} 条</Radio>
            {groups.map((g) => (
              <Radio value={g.module} key={g.module}>
                {g.label} {g.items.length} 条
              </Radio>
            ))}
          </Radio.Group>
        </div>

        <div className="rw-field">
          <div className="rw-field-label">
            角色
            <button
              type="button"
              className="rw-field-link"
              onClick={() =>
                setBulkRoleIds(bulkRoleIds.length === allRoleIds.length ? [] : allRoleIds)
              }
            >
              {bulkRoleIds.length === allRoleIds.length ? '清空选择' : '全选'}
            </button>
          </div>
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="选择要套用的角色"
            style={{ width: '100%' }}
            options={roleOptions}
            value={bulkRoleIds}
            onChange={(v) => setBulkRoleIds((v as number[]) ?? [])}
            filterOption={(input, option) => {
              const props = (option as unknown as { props?: Record<string, unknown> })?.props;
              const text = `${String(props?.children ?? '')} ${String(props?.extra ?? '')}`;
              return text.toLowerCase().includes(input.toLowerCase());
            }}
          />
        </div>

        <div className="rw-field">
          <div className="rw-field-label">写入方式</div>
          <Radio.Group
            type="button"
            value={bulkMode}
            onChange={(v) => setBulkMode(v as WorkflowRoleBindMode)}
            className="rw-field-radio"
          >
            {(Object.keys(MODE_LABEL) as WorkflowRoleBindMode[]).map((m) => (
              <Radio value={m} key={m}>
                {MODE_LABEL[m]}
              </Radio>
            ))}
          </Radio.Group>
          <div className="rw-field-hint">{MODE_HINT[bulkMode]}</div>
        </div>

        {/* 落库前先说清后果：覆盖会把未选中的旧绑定一起清掉，写错一行就是 13 条一起变 */}
        <div className={`rw-bulk-summary${bulkMode === 'replace' && bulkRoleIds.length === 0 ? ' is-warn' : ''}`}>
          {bulkTargets.length === 0
            ? '当前范围没有流程'
            : bulkRoleIds.length === 0
              ? bulkMode === 'replace'
                ? `将清空「${bulkScopeLabel}」${bulkTargets.length} 条流程的全部适用角色`
                : '请先选择角色'
              : `将把「${bulkScopeLabel}」${bulkTargets.length} 条流程的适用角色${
                  bulkMode === 'remove' ? '移除' : bulkMode === 'append' ? '追加' : '设为'
                }：${bulkRoleNames}`}
        </div>
      </Modal>
    </PageContainer>
  );
}
