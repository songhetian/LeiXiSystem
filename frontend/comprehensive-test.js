const http = require('http');

const testCases = [
  { path: '/', title: '工作台', checks: ['工作台', '快捷操作', '待办事项'] },
  { path: '/employees', title: '员工管理', checks: ['员工管理', '姓名', '工号', '新增员工'] },
  { path: '/employees/transactions', title: '员工异动', checks: ['员工异动'] },
  { path: '/attendance/punch', title: '打卡', checks: ['打卡'] },
  { path: '/attendance/shifts', title: '班次管理', checks: ['班次管理'] },
  { path: '/attendance/schedules', title: '排班管理', checks: ['排班管理'] },
  { path: '/attendance/daily', title: '考勤日报', checks: ['考勤日报'] },
  { path: '/attendance/monthly', title: '考勤月报', checks: ['考勤月报'] },
  { path: '/attendance/vacation/leave', title: '请假记录', checks: ['请假记录'] },
  { path: '/attendance/vacation/overtime', title: '加班记录', checks: ['加班记录'] },
  { path: '/attendance/punch-makeup', title: '补卡申请', checks: ['补卡申请'] },
  { path: '/approval/todo', title: '待办审批', checks: ['待办审批'] },
  { path: '/approval/settings', title: '流程设置', checks: ['流程设置'] },
  { path: '/approval/submissions', title: '我的申请', checks: ['我的申请'] },
  { path: '/expense/my', title: '我的报销', checks: ['我的报销'] },
  { path: '/expense/approval', title: '报销审批', checks: ['报销审批'] },
  { path: '/payroll/my-payslips', title: '我的工资条', checks: ['我的工资条'] },
  { path: '/knowledge', title: '知识库', checks: ['知识库'] },
  { path: '/knowledge/admin', title: '知识库管理', checks: ['知识库管理'] },
  { path: '/reports', title: '报表中心', checks: ['报表中心'] },
  { path: '/notifications', title: '我的通知', checks: ['我的通知'] },
  { path: '/system/departments', title: '组织架构', checks: ['部门列表'] },
  { path: '/system/users', title: '用户管理', checks: ['用户管理'] },
  { path: '/system/roles', title: '角色权限', checks: ['角色权限'] },
  { path: '/system/broadcasts', title: '公告管理', checks: ['公告管理'] },
  { path: '/profile', title: '个人中心', checks: ['个人中心'] },
];

function checkPage(testCase) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3004,
      path: testCase.path,
      headers: {
        'Cookie': 'token=dev-token; user=admin',
      }
    };
    
    http.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const hasGarbled = data.includes('�');
        const failedChecks = [];
        
        for (const check of testCase.checks) {
          if (!data.includes(check)) {
            failedChecks.push(check);
          }
        }
        
        resolve({
          path: testCase.path,
          title: testCase.title,
          status: res.statusCode,
          hasGarbled,
          failedChecks,
          size: data.length
        });
      });
    }).on('error', (e) => {
      resolve({ 
        path: testCase.path, 
        title: testCase.title, 
        status: 'error', 
        error: e.message 
      });
    });
  });
}

async function main() {
  console.log('Running comprehensive page tests...\n');
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const testCase of testCases) {
    process.stdout.write(`Testing ${testCase.path}... `);
    const result = await checkPage(testCase);
    results.push(result);
    
    if (result.status === 200 && !result.hasGarbled && result.failedChecks.length === 0) {
      console.log('✓ PASS');
      passed++;
    } else {
      console.log('✗ FAIL');
      failed++;
      if (result.status !== 200) console.log(`  Status: ${result.status}`);
      if (result.hasGarbled) console.log('  Garbled text detected');
      if (result.failedChecks.length > 0) {
        console.log(`  Missing content: ${result.failedChecks.join(', ')}`);
      }
    }
    
    // 稍微延迟避免触发过多编译
    await new Promise(res => setTimeout(res, 300));
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed pages:');
    results.filter(r => r.status !== 200 || r.hasGarbled || r.failedChecks.length > 0)
      .forEach(r => {
        console.log(`  - ${r.path} (${r.title})`);
        if (r.status !== 200) console.log(`    Status: ${r.status}`);
        if (r.hasGarbled) console.log('    Garbled: yes');
        if (r.failedChecks?.length) console.log(`    Missing: ${r.failedChecks.join(', ')}`);
      });
  }
}

main();
