module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
  ],
  coverageDirectory: 'progress/coverage',
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Timing-based perf suite is CPU-bound, so it fails under parallel Jest workers on shared CI
  // runners. It runs alone via `npm run test:perf` and the CI benchmark step.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', ...(process.env.RUN_PERF ? [] : ['/tests/performance/'])],
  collectCoverage: process.env.CI ? true : false,
  verbose: true,
};
