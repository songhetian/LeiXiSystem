const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotsDir = path.join(__dirname, '../docs/screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  console.log('🚀 启动 [雷犀系统] 全量功能捕获引擎...');
  const browser = await chromium.launch({ headless: false }); 
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const baseUrl = 'http://localhost:5173';

  try {
    console.log('🔑 正在执行超级管理员物理登录...');
    await page.goto(baseUrl);
    await page.fill('input[placeholder*="账号"]', 'admin');
    await page.fill('input[placeholder*="密码"]', '123456');
    await page.click('button:has-text("登录")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✅ 登录成功，开始物理穿透全量功能...');

    const categories = {
      '01_核心看板': ['dashboard', 'admin-dashboard'],
      '02_人事管理': ['user-employee', 'user-changes', 'user-approval', 'user-reset-password', 'user-permission', 'user-role-management', 'system-logs', 'org-department', 'org-position'],
      '03_考勤流转': ['attendance-home', 'attendance-records', 'attendance-makeup', 'attendance-leave-apply', 'attendance-leave-records', 'attendance-overtime-apply', 'attendance-overtime-records', 'attendance-stats', 'attendance-department', 'attendance-shift', 'attendance-schedule', 'attendance-smart-schedule', 'attendance-approval', 'attendance-settings'],
      '04_假期财务': ['vacation-details', 'vacation-summary', 'quota-config', 'my-payslips', 'payslip-management', 'reimbursement-apply', 'reimbursement-list', 'reimbursement-approval', 'reimbursement-settings'],
      '05_后勤资产': ['logistics-device-mgmt', 'logistics-device-list', 'asset-request-audit', 'inventory-management'],
      '06_质检系统': ['quality-score', 'quality-tags', 'quality-platform-shop', 'quality-case-library', 'quality-case-categories', 'quality-recommendation'],
      '07_知识库': ['knowledge-articles', 'knowledge-base', 'my-knowledge'],
      '08_信息系统': ['messaging-broadcast', 'broadcast-management', 'notification-settings', 'messaging-chat', 'messaging-group-management', 'notification-center', 'notification-sender'],
      '09_考核系统': ['assessment-exams', 'assessment-plans', 'assessment-categories', 'my-exams', 'my-exam-results', 'exam-results', 'assessment-management'],
      '10_个人中心': ['personal-info', 'my-todo', 'my-schedule', 'my-notifications', 'my-assets', 'my-memos', 'employee-memos']
    };

    for (const [catName, tabs] of Object.entries(categories)) {
      const catDir = path.join(screenshotsDir, catName);
      if (!fs.existsSync(catDir)) fs.mkdirSync(catDir);

      for (const tab of tabs) {
        console.log(`📸 正在穿透 [${catName}] -> [${tab}]...`);
        try {
          await page.evaluate((tabName) => {
            localStorage.setItem('activeTab', JSON.stringify({ name: tabName, params: {} }));
            window.location.reload();
          }, tab);

          await page.waitForLoadState('networkidle', { timeout: 10000 });
          await page.waitForTimeout(2500); // 等待 React 渲染和动画

          // 物理清理遮挡物
          await page.evaluate(() => {
            const items = document.querySelectorAll('.sonner-toast, .ant-modal-mask, .ant-modal-wrap');
            items.forEach(i => i.remove());
          });

          await page.screenshot({ 
            path: path.join(catDir, `${tab}.png`),
            fullPage: true 
          });
        } catch (e) {
          console.warn(`⚠️ 跳过 [${tab}], 渲染超时或路径不存在`);
        }
      }
    }

    console.log('🏁 雷犀全量功能物理截图已全部完成！文件位于 docs/screenshots/');

  } catch (error) {
    console.error('❌ 自动化引擎崩溃:', error);
  } finally {
    await browser.close();
  }
})();
