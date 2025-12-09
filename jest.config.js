export default {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: ['index.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  transform: {},
};
