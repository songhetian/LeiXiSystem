const BASE_URL = 'http://localhost:3001/api/v1';

async function testAPI(name, method, path, body = null, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  
  const options = { method, headers, credentials: 'include' };
  if (body) options.body = JSON.stringify(body);
  
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const setCookie = res.headers.get('set-cookie');
    const data = await res.json();
    const duration = Date.now() - start;
    const status = data.code === 0 ? 'PASS' : `FAIL (code=${data.code})`;
    console.log(`[${status}] ${name} - ${method} ${path} (${duration}ms)`);
    if (data.code !== 0) {
      console.log(`       错误: ${data.message}`);
    }
    return { success: data.code === 0, data, setCookie, cookie: setCookie || cookie };
  } catch (err) {
    console.log(`[FAIL] ${name} - ${method} ${path} - 网络错误: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('雷犀系统后端 API 功能测试');
  console.log('='.repeat(60));
  console.log('');

  let passCount = 0;
  let failCount = 0;
  let cookie = null;

  // 1. 健康检查
  const health = await testAPI('健康检查', 'GET', '/health');
  health.success ? passCount++ : failCount++;
  console.log('');

  // 2. 登录
  console.log('--- 认证模块 ---');
  const loginResult = await testAPI('管理员登录', 'POST', '/auth/login', {
    username: 'admin',
    password: '123456'
  });
  loginResult.success ? passCount++ : failCount++;
  cookie = loginResult.setCookie;
  
  const loginStaff = await testAPI('员工登录', 'POST', '/auth/login', {
    username: 'staff',
    password: '123456'
  });
  loginStaff.success ? passCount++ : failCount++;
  console.log('');

  if (!cookie) {
    console.log('登录失败，终止测试');
    return;
  }

  // 3. 系统管理
  console.log('--- 系统管理模块 ---');
  const tests1 = [
    ['获取用户列表', 'GET', '/system/users?page=1&pageSize=10'],
    ['获取角色列表', 'GET', '/system/roles'],
    ['获取权限列表', 'GET', '/system/permissions'],
    ['获取部门列表', 'GET', '/system/departments'],
    ['获取职位列表', 'GET', '/system/positions'],
    ['获取公告列表', 'GET', '/system/broadcasts?page=1&pageSize=10'],
    ['获取操作日志', 'GET', '/system/logs?page=1&pageSize=10'],
  ];
  for (const [name, method, path] of tests1) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 4. 员工管理
  console.log('--- 员工管理模块 ---');
  const tests2 = [
    ['获取员工列表', 'GET', '/employees?page=1&pageSize=10'],
  ];
  for (const [name, method, path] of tests2) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 5. 考勤管理
  console.log('--- 考勤管理模块 ---');
  const tests3 = [
    ['获取班次列表', 'GET', '/attendance/shifts?page=1&pageSize=10'],
    ['获取排班列表', 'GET', '/attendance/schedules?page=1&pageSize=10'],
    ['获取考勤日报', 'GET', '/attendance/daily?page=1&pageSize=10'],
    ['获取考勤月报', 'GET', '/attendance/monthly?page=1&pageSize=10'],
    ['获取请假记录', 'GET', '/attendance/leave-records?page=1&pageSize=10'],
    ['获取加班记录', 'GET', '/attendance/overtime-records?page=1&pageSize=10'],
    ['获取补卡申请', 'GET', '/attendance/makeup?page=1&pageSize=10'],
    ['获取打卡设备', 'GET', '/attendance/devices?page=1&pageSize=10'],
    ['获取打卡流水', 'GET', '/attendance/punch-logs?page=1&pageSize=10'],
    ['考勤设置', 'GET', '/attendance/settings'],
  ];
  for (const [name, method, path] of tests3) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 6. 假期管理
  console.log('--- 假期管理模块 ---');
  const tests4 = [
    ['获取假期类型', 'GET', '/attendance/vacation/types'],
    ['获取假期余额', 'GET', '/attendance/vacation/balances?page=1&pageSize=10'],
  ];
  for (const [name, method, path] of tests4) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 7. 审批中心
  console.log('--- 审批中心模块 ---');
  const tests5 = [
    ['获取待办审批', 'GET', '/approval/todo?page=1&pageSize=10'],
    ['获取我发起的审批', 'GET', '/approval/submissions?page=1&pageSize=10'],
    ['获取审批组', 'GET', '/approval/groups?page=1&pageSize=10'],
    ['获取审批流程', 'GET', '/approval/workflows?page=1&pageSize=10'],
  ];
  for (const [name, method, path] of tests5) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 8. 薪资管理
  console.log('--- 薪资管理模块 ---');
  const tests6 = [
    ['获取薪资项目', 'GET', '/payroll/items'],
    ['获取薪资批次', 'GET', '/payroll/runs?page=1&pageSize=10'],
    ['我的工资条', 'GET', '/payslips/me?page=1&pageSize=10'],
  ];
  for (const [name, method, path] of tests6) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 9. 报销管理
  console.log('--- 报销管理模块 ---');
  const tests7 = [
    ['获取报销类型', 'GET', '/reimbursements/types'],
    ['我的报销', 'GET', '/reimbursements/mine?page=1&pageSize=10'],
    ['待审批报销', 'GET', '/reimbursements/pending?page=1&pageSize=10'],
  ];
  for (const [name, method, path] of tests7) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 10. 知识库
  console.log('--- 知识库模块 ---');
  const tests8 = [
    ['获取知识分类', 'GET', '/knowledge/categories'],
    ['获取知识文章', 'GET', '/knowledge/articles?page=1&pageSize=10'],
    ['知识统计', 'GET', '/knowledge/stats/summary'],
  ];
  for (const [name, method, path] of tests8) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 11. 报表中心
  console.log('--- 报表中心模块 ---');
  const tests9 = [
    ['考勤月报报表', 'GET', '/reports/attendance-monthly?month=2026-08'],
    ['人力成本报表', 'GET', '/reports/labor-cost?month=2026-08'],
    ['员工结构报表', 'GET', '/reports/employee-structure'],
  ];
  for (const [name, method, path] of tests9) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 12. 仪表盘
  console.log('--- 仪表盘模块 ---');
  const tests10 = [
    ['仪表盘统计', 'GET', '/dashboard/stats'],
    ['考勤趋势', 'GET', '/dashboard/attendance-trend?days=7'],
    ['部门统计', 'GET', '/dashboard/department-stats'],
  ];
  for (const [name, method, path] of tests10) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 13. 通知中心
  console.log('--- 通知中心模块 ---');
  const tests11 = [
    ['获取通知列表', 'GET', '/notifications?page=1&pageSize=10'],
    ['获取公告列表(公开)', 'GET', '/broadcasts?page=1&pageSize=10'],
    ['公告未读数', 'GET', '/broadcasts/unread-count'],
  ];
  for (const [name, method, path] of tests11) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  // 14. 设置
  console.log('--- 系统设置模块 ---');
  const tests12 = [
    ['获取系统设置', 'GET', '/settings'],
  ];
  for (const [name, method, path] of tests12) {
    const r = await testAPI(name, method, path, null, cookie);
    r.success ? passCount++ : failCount++;
  }
  console.log('');

  console.log('='.repeat(60));
  console.log(`测试完成: 通过 ${passCount} / 失败 ${failCount} / 总计 ${passCount + failCount}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
