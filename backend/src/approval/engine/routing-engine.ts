export interface WorkflowNode {
  id: string | number;
  nodeKey?: string;
  name: string;
  type: 'role' | 'user' | 'group' | 'department_manager' | 'start' | 'end';
  roleCode?: string;
  userId?: number;
  groupId?: number;
  approvalGroupId?: number;
  order: number;
  condition?: NodeCondition;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  signType?: 'all' | 'any';
}

export interface NodeCondition {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  value: number | string;
}

export interface Approver {
  userId: number;
  required: boolean;
}

export interface ApproverCandidate {
  type: 'role' | 'user' | 'group' | 'department_manager';
  roleCode?: string;
  userId?: number;
  groupId?: number;
}

export interface RoutingContext {
  applicantDepartmentId?: number;
  applicantRoleCodes?: string[];
  formData?: Record<string, any>;
  roleUsers?: Record<string, number[]>;
  groups?: Record<number, number[]>;
  departmentManagers?: Record<number, number>;
}

export interface ChainItem {
  nodeId: string | number;
  nodeKey: string;
  nodeName: string;
  order: number;
  approver: ApproverCandidate;
  approvers?: Approver[];
  signType?: 'all' | 'any';
}

function getCondition(node: WorkflowNode): NodeCondition | undefined {
  if (node.condition) return node.condition;
  if (node.conditionField && node.conditionOperator && node.conditionValue !== undefined) {
    return {
      field: node.conditionField,
      operator: node.conditionOperator as any,
      value: node.conditionValue,
    };
  }
  return undefined;
}

function evaluateCondition(condition: NodeCondition | undefined, formData: Record<string, any>): boolean {
  if (!condition) return true;
  const { field, operator, value } = condition;
  const actual = formData?.[field];
  if (actual === undefined || actual === null) return false;

  switch (operator) {
    case 'gt':
      return Number(actual) > Number(value);
    case 'gte':
      return Number(actual) >= Number(value);
    case 'lt':
      return Number(actual) < Number(value);
    case 'lte':
      return Number(actual) <= Number(value);
    case 'eq':
      return String(actual) === String(value);
    case 'neq':
      return String(actual) !== String(value);
    default:
      return true;
  }
}

export function resolveNextApprovers(
  node: WorkflowNode,
  ctx: RoutingContext,
): ApproverCandidate | null {
  const condition = getCondition(node);
  if (!evaluateCondition(condition, ctx.formData || {})) {
    return null;
  }

  switch (node.type) {
    case 'role':
      return { type: 'role', roleCode: node.roleCode };
    case 'user':
      return { type: 'user', userId: node.userId };
    case 'group':
      return { type: 'group', groupId: node.approvalGroupId || node.groupId };
    case 'department_manager': {
      const deptId = ctx.applicantDepartmentId;
      const managerId = deptId !== undefined ? ctx.departmentManagers?.[deptId] : undefined;
      if (managerId !== undefined && managerId !== null) {
        return { type: 'department_manager', userId: managerId };
      }
      return null;
    }
    default:
      return null;
  }
}

export function resolveApproverList(
  nodes: WorkflowNode[],
  nodeKey: string,
  ctx: RoutingContext,
): Approver[] {
  const node = nodes.find(n => (n.nodeKey || String(n.id)) === nodeKey);
  if (!node) return [];

  const condition = getCondition(node);
  if (!evaluateCondition(condition, ctx.formData || {})) {
    return [];
  }

  const signType = node.signType;
  const required = signType === undefined ? true : signType === 'all';

  let userIds: number[] = [];

  switch (node.type) {
    case 'role':
      if (ctx.roleUsers && node.roleCode) {
        userIds = ctx.roleUsers[node.roleCode] || [];
      }
      break;
    case 'user':
      if (node.userId !== undefined && node.userId !== null) {
        userIds = [node.userId];
      }
      break;
    case 'group':
      const groupId = node.approvalGroupId || node.groupId;
      if (ctx.groups && groupId !== undefined && groupId !== null) {
        userIds = ctx.groups[groupId] || [];
      }
      break;
    case 'department_manager': {
      const deptId = ctx.applicantDepartmentId;
      const managerId = deptId !== undefined ? ctx.departmentManagers?.[deptId] : undefined;
      if (managerId !== undefined && managerId !== null) {
        userIds = [managerId];
      }
      break;
    }
    default:
      return [];
  }

  return userIds.map(userId => ({ userId, required }));
}

export function buildApprovalChain(
  nodes: WorkflowNode[],
  ctx: RoutingContext = {},
): ChainItem[] {
  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  const chain: ChainItem[] = [];

  for (const node of sorted) {
    if (node.type === 'start' || node.type === 'end') continue;

    const approver = resolveNextApprovers(node, ctx);
    if (!approver) continue;

    const approvers = resolveApproverList(nodes, node.nodeKey || String(node.id), ctx);

    chain.push({
      nodeId: node.id,
      nodeKey: node.nodeKey || String(node.id),
      nodeName: node.name,
      order: node.order,
      approver,
      approvers,
      signType: node.signType,
    });
  }

  return chain;
}
