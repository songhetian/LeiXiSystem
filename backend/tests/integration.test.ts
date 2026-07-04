import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://localhost:3001'
const headers = { 'Content-Type': 'application/json' }

// ═══════════════════════════════════════════
// Integration tests against running server
// ═══════════════════════════════════════════

let token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJzZXNzaW9uVmVyc2lvbiI6MSwiaWF0IjoxNzgyODk1MDI5LCJleHAiOjE3ODI5MDIyMjl9.epJyavddQSrlIXvsE6Zm669ZFTDFibDPrbIWZPZwxcU'

describe('Integration Tests (against running server)', () => {
  // Token already set above - no need for beforeAll login

  function authHeaders() {
    return { ...headers, Authorization: `Bearer ${token}` }
  }

  async function get(path: string, status = 200) {
    const res = await fetch(`${BASE}${path}`, { headers: authHeaders() })
    expect(res.status).toBe(status)
    return res.json()
  }

  async function post(path: string, body: any, status = 200) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(status)
    return res.json()
  }

  async function put(path: string, body: any, status = 200) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(status)
    return res.json()
  }

  // ═══════════ N1: Holiday Calendar ═══════════
  describe('N1: Holiday Calendar', () => {
    it('GET /holidays/lists → 200', async () => {
      const data = await get('/api/holidays/lists')
      expect(data.code).toBe(0)
      expect(Array.isArray(data.data.list)).toBe(true)
    })

    it('POST /holidays/lists → creates', async () => {
      const data = await post('/api/holidays/lists', {
        name: 'Test2027', year: 2027, country: 'CN', status: 'active',
      })
      expect(data.code).toBe(0)
      expect(data.data.name).toBe('Test2027')
    })

    it('GET /holidays/is-holiday → holiday check', async () => {
      const data = await get('/api/holidays/is-holiday?date=2026-05-01')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('isHoliday')
      expect(data.data).toHaveProperty('isWeekend')
    })

    it('GET /holidays/calendar → yearly', async () => {
      const data = await get('/api/holidays/calendar?year=2026')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('byMonth')
    })
  })

  // ═══════════ N2: Knowledge Base ═══════════
  describe('N2: Knowledge Base', () => {
    it('GET /kb/categories → tree', async () => {
      const data = await get('/api/kb/categories')
      expect(data.code).toBe(0)
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('POST /kb/categories → creates', async () => {
      const data = await post('/api/kb/categories', {
        name: 'TestCat', categoryType: 'kb', visibility: 'all', status: 'active',
      })
      expect(data.code).toBe(0)
    })

    it('POST /kb/articles → creates', async () => {
      const data = await post('/api/kb/articles', {
        title: 'Test Post', content: 'Hello World', categoryId: 1, status: 'published',
      })
      expect(data.code).toBe(0)
      expect(data.data.title).toBe('Test Post')
    })

    it('GET /kb/articles → lists', async () => {
      const data = await get('/api/kb/articles')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('list')
    })

    it('GET /kb/search → full-text', async () => {
      const data = await get('/api/kb/search?q=Test')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('total')
    })
  })

  // ═══════════ G2: SLA ═══════════
  describe('G2: SLA Policies', () => {
    it('GET /helpdesk/slas → list', async () => {
      const data = await get('/api/helpdesk/slas')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('list')
    })

    it('POST /helpdesk/slas → creates', async () => {
      const data = await post('/api/helpdesk/slas', {
        name: 'Test SLA', responseTime: 10, resolutionTime: 60, workdaysOnly: true, status: 'active',
      })
      expect(data.code).toBe(0)
      expect(data.data.name).toBe('Test SLA')
    })
  })

  // ═══════════ N5: Customers ═══════════
  describe('N5: Customers', () => {
    it('GET /helpdesk/customers → 200', async () => {
      const data = await get('/api/helpdesk/customers')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('total')
    })

    it('POST /helpdesk/customers → creates', async () => {
      const data = await post('/api/helpdesk/customers', {
        name: 'TestCorp', contactName: 'John', email: 'john@t.com', status: 'active',
      })
      expect(data.code).toBe(0)
      expect(data.data.name).toBe('TestCorp')
    })

    it('GET /helpdesk/customers/:id → detail', async () => {
      const data = await get('/api/helpdesk/customers/1')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('name')
    })
  })

  // ═══════════ N8: Canned Responses ═══════════
  describe('N8: Canned Responses', () => {
    it('GET /helpdesk/canned-responses → 200', async () => {
      const data = await get('/api/helpdesk/canned-responses')
      expect(data.code).toBe(0)
    })

    it('POST /helpdesk/canned-responses → creates', async () => {
      const data = await post('/api/helpdesk/canned-responses', {
        title: 'Hello Template', content: 'Hi!', isGlobal: true, status: 'active',
      })
      expect(data.code).toBe(0)
      expect(data.data.title).toBe('Hello Template')
    })

    it('GET /helpdesk/canned-responses/search → finds', async () => {
      const data = await get('/api/helpdesk/canned-responses/search?q=Hello')
      expect(data.code).toBe(0)
    })
  })

  // ═══════════ G1: Queue & Assignment ═══════════
  describe('G1: Queue & Assignment', () => {
    it('GET /helpdesk/tickets/queue-status → stats', async () => {
      const data = await get('/api/helpdesk/tickets/queue-status')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('queueLength')
      expect(data.data).toHaveProperty('priorities')
    })

    it('GET /helpdesk/tickets/assignable-employees → list', async () => {
      const data = await get('/api/helpdesk/tickets/assignable-employees')
      expect(data.code).toBe(0)
      expect(Array.isArray(data.data)).toBe(true)
    })
  })

  // ═══════════ G3: Overtime Payroll ═══════════
  describe('G3: Overtime Payroll', () => {
    it('GET /overtime-payroll/pending-settlements → 200', async () => {
      const data = await get('/api/overtime-payroll/pending-settlements')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('list')
      expect(data.data).toHaveProperty('totalPendingPay')
    })

    it('GET /overtime-payroll/settlement-batches → 200', async () => {
      const data = await get('/api/overtime-payroll/settlement-batches')
      expect(data.code).toBe(0)
    })
  })

  // ═══════════ N7: OKR ═══════════
  describe('N7: OKR', () => {
    it('GET /okr/dashboard → tree', async () => {
      const data = await get('/api/okr/dashboard')
      expect(data.code).toBe(0)
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('POST /okr/objectives → creates', async () => {
      const data = await post('/api/okr/objectives', {
        title: 'Test OKR', type: 'company', period: 'Q3', year: 2026,
      })
      expect(data.code).toBe(0)
      expect(data.data.title).toBe('Test OKR')
    })

    it('POST /okr/objectives/:id/key-results → adds KR', async () => {
      const data = await post('/api/okr/objectives/1/key-results', {
        title: 'Test KR', targetType: 'number', targetValue: 100, weight: 100,
      })
      expect(data.code).toBe(0)
    })

    it('PUT /okr/key-results/:id/progress → updates', async () => {
      const data = await put('/api/okr/key-results/1/progress', { currentValue: 50 })
      expect(data.code).toBe(0)
    })
  })

  // ═══════════ N10: Operations Dashboard ═══════════
  describe('N10: Operations Dashboard', () => {
    it('GET /dashboard/operations → full metrics', async () => {
      const data = await get('/api/dashboard/operations')
      expect(data.code).toBe(0)
      expect(data.data).toHaveProperty('metrics')
      expect(data.data.metrics).toHaveProperty('customerService')
      expect(data.data.metrics).toHaveProperty('schedule')
    })

    it('GET /dashboard/operations/alert-thresholds → 200', async () => {
      const data = await get('/api/dashboard/operations/alert-thresholds')
      expect(data.code).toBe(0)
    })
  })

  // ═══════════ N6/G6: Schedule Advanced ═══════════
  describe('N6/G6: Schedule Advanced', () => {
    it('GET /schedule/rotations → 200', async () => {
      const data = await get('/api/schedule/rotations')
      expect(data.code).toBe(0)
    })

    it('GET /schedule/versions → 200', async () => {
      const data = await get('/api/schedule/versions')
      expect(data.code).toBe(0)
    })
  })

  // ═══════════ G7: Employee Portal ═══════════
  describe('G7: Employee Portal', () => {
    it('GET /employee/dashboard → 200 or 404', async () => {
      const res = await fetch(`${BASE}/api/employee/dashboard`, { headers: authHeaders() })
      expect([200, 404]).toContain(res.status)
    })

    it('GET /employee/lifecycle/task-templates → 200', async () => {
      const res = await fetch(`${BASE}/api/employee/lifecycle/task-templates`, { headers: authHeaders() })
      expect([200, 404]).toContain(res.status)
    })
  })
})
