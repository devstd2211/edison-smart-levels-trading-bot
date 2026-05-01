module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/core/src', '<rootDir>/packages/web-server/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'packages/core/src/**/*.ts',
    'packages/web-server/src/**/*.ts',
    '!packages/core/src/**/*.test.ts',
    '!packages/core/src/__tests__/**',
    '!packages/web-server/src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
