import request from '@/lib/request';

// ========== 绩效周期 ==========

/** 绩效周期状态：draft-草稿 / active-进行中 / closed-已结束 */
export type PerformanceCycleStatus = 'draft' | 'active' | 'closed';

export interface PerformanceCycle {
  id: number;
  name: string;
  /** 周期类型：temporary-临时 / quarterly-季度 / yearly-年度 */
  type: string;
  startDate: string;
  endDate: string;
  selfReviewDeadline?: string | null;
  managerReviewDeadline?: string | null;
  calibrationDeadline?: string | null;
  status: PerformanceCycleStatus;
  createdAt?: string;
  updatedAt?: string;
  /** 关联统计：目标数 / 评审数 */
  _count?: { goals: number; reviews: number };
}

export interface PerformanceCycleCreateDto {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  selfReviewDeadline?: string;
  managerReviewDeadline?: string;
  calibrationDeadline?: string;
  status?: PerformanceCycleStatus;
}

export interface PerformanceCycleUpdateDto extends Partial<PerformanceCycleCreateDto> {}

// ========== 绩效目标 ==========

export interface PerformanceGoal {
  id: number;
  cycleId: number;
  employeeId: number;
  title: string;
  description?: string | null;
  weight?: number;
  targetValue?: string | null;
  actualValue?: string | null;
  progress?: number;
  status?: string;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PerformanceGoalCreateDto {
  cycleId: number;
  employeeId: number;
  title: string;
  description?: string;
  weight?: number;
  targetValue?: string;
  actualValue?: string;
  progress?: number;
  status?: string;
  dueDate?: string;
}

export interface PerformanceGoalUpdateDto extends Partial<Omit<PerformanceGoalCreateDto, 'cycleId' | 'employeeId'>> {}

// ========== 绩效评估 ==========

export interface PerformanceReview {
  id: number;
  cycleId: number;
  employeeId: number;
  reviewerId?: number | null;
  status?: string;
  selfScore?: number | null;
  managerScore?: number | null;
  finalScore?: number | null;
  rating?: string | null;
  selfComment?: string | null;
  managerComment?: string | null;
  developmentPlan?: string | null;
  promotionRecommendation?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PerformanceReviewCreateDto {
  cycleId: number;
  employeeId: number;
  reviewerId?: number | null;
  status?: string;
}

export interface PerformanceReviewUpdateDto extends Partial<PerformanceReviewCreateDto> {
  selfScore?: number;
  managerScore?: number;
  finalScore?: number;
  rating?: string;
  selfComment?: string;
  managerComment?: string;
  comment?: string;
  developmentPlan?: string;
  promotionRecommendation?: boolean;
}

// ========== 通用返回结构 ==========

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: {
    list: T[];
    total: number;
  };
}

export interface ItemResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export interface ActionResult {
  code: number;
  message?: string;
  data?: { success?: boolean };
}

// ========== API ==========

export const performanceApi = {
  // 绩效周期
  listCycles(_params: Record<string, unknown> = {}): Promise<ListResult<PerformanceCycle>> {
    return request.get('/performance/cycles', { params: _params });
  },
  createCycle(data: PerformanceCycleCreateDto): Promise<ItemResult<PerformanceCycle>> {
    return request.post('/performance/cycles', data);
  },
  updateCycle(id: number, data: PerformanceCycleUpdateDto): Promise<ItemResult<PerformanceCycle>> {
    return request.put(`/performance/cycles/${id}`, data);
  },
  deleteCycle(id: number): Promise<ActionResult> {
    return request.delete(`/performance/cycles/${id}`);
  },
  // 绩效目标
  listGoals(_params: Record<string, unknown> = {}): Promise<ListResult<PerformanceGoal>> {
    return request.get('/performance/goals', { params: _params });
  },
  createGoal(data: PerformanceGoalCreateDto): Promise<ItemResult<PerformanceGoal>> {
    return request.post('/performance/goals', data);
  },
  updateGoal(id: number, data: PerformanceGoalUpdateDto): Promise<ItemResult<PerformanceGoal>> {
    return request.put(`/performance/goals/${id}`, data);
  },
  deleteGoal(id: number): Promise<ActionResult> {
    return request.delete(`/performance/goals/${id}`);
  },
  // 绩效评估
  listReviews(_params: Record<string, unknown> = {}): Promise<ListResult<PerformanceReview>> {
    return request.get('/performance/reviews', { params: _params });
  },
  createReview(data: PerformanceReviewCreateDto): Promise<ItemResult<PerformanceReview>> {
    return request.post('/performance/reviews', data);
  },
  updateReview(id: number, data: PerformanceReviewUpdateDto): Promise<ItemResult<PerformanceReview>> {
    return request.put(`/performance/reviews/${id}`, data);
  },
  deleteReview(id: number): Promise<ActionResult> {
    return request.delete(`/performance/reviews/${id}`);
  },
};

// ========== OKR 目标 ==========

export interface OkrObjective {
  id: number;
  title: string;
  /** 目标类型：personal-个人 / department-部门 */
  type: string;
  period: string;
  ownerId?: number | null;
  departmentId?: number | null;
  /** 目标整体进度 0-100 */
  progress?: number;
  /** 状态：active-进行中 / completed-已完成 */
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  keyResults?: OkrKeyResult[];
}

export interface OkrObjectiveCreateDto {
  title: string;
  type?: string;
  period: string;
  ownerId?: number | null;
  departmentId?: number | null;
  progress?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface OkrObjectiveUpdateDto extends Partial<OkrObjectiveCreateDto> {}

// ========== OKR 关键结果 ==========

export interface OkrKeyResult {
  id: number;
  objectiveId: number;
  title: string;
  initialValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OkrKeyResultCreateDto {
  title: string;
  initialValue?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  progress?: number;
}

export interface OkrKeyResultUpdateDto extends Partial<OkrKeyResultCreateDto> {}

// ========== OKR API ==========

export const okrApi = {
  listObjectives(_params: Record<string, unknown> = {}): Promise<ListResult<OkrObjective>> {
    return request.get('/okr/objectives', { params: _params });
  },
  createObjective(data: OkrObjectiveCreateDto): Promise<ItemResult<OkrObjective>> {
    return request.post('/okr/objectives', data);
  },
  updateObjective(id: number, data: OkrObjectiveUpdateDto): Promise<ItemResult<OkrObjective>> {
    return request.put(`/okr/objectives/${id}`, data);
  },
  deleteObjective(id: number): Promise<ActionResult> {
    return request.delete(`/okr/objectives/${id}`);
  },
  listKeyResults(objectiveId: number): Promise<ListResult<OkrKeyResult>> {
    return request.get(`/okr/objectives/${objectiveId}/key-results`);
  },
  createKeyResult(objectiveId: number, data: OkrKeyResultCreateDto): Promise<ItemResult<OkrKeyResult>> {
    return request.post(`/okr/objectives/${objectiveId}/key-results`, data);
  },
  updateKeyResult(id: number, data: OkrKeyResultUpdateDto): Promise<ItemResult<OkrKeyResult>> {
    return request.put(`/okr/key-results/${id}`, data);
  },
};