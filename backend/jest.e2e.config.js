/** @type {import('jest').Config} */
// e2e 专用配置：需要真实 MySQL/Redis（见 .env），通过 npm run test:e2e 执行
const base = require('./jest.config');

module.exports = {
  ...base,
  testRegex: '.*\\.e2e\\.test\\.ts$',
  testPathIgnorePatterns: ['/node_modules/'],
};
