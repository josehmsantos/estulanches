module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: 'rdm/coverage',
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  clearMocks: true
};
