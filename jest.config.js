const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^pdfjs-dist/build/pdf\.worker\.entry$': '<rootDir>/test-files/emptyMock.js',
    '^idb$': '<rootDir>/test-files/idbMock.js',
  },
  // Ensure Jest terminates even if open handles remain (avoids manual Ctrl+C)
  forceExit: true,
  detectOpenHandles: true,
};

module.exports = createJestConfig(customJestConfig); 