/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(test|spec)\\.ts$',
  // e2e 需要真实 MySQL/Redis，默认 npm test 不跑；用 npm run test:e2e 单独执行
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e\\.test\\.ts$'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@lei/shared$': '<rootDir>/../shared/src/index.ts',
  },
  testEnvironment: 'node',
  testTimeout: 20000,
};
