module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^firebase/app$': '<rootDir>/src/__mocks__/firebase.ts',
    '^firebase/auth$': '<rootDir>/src/__mocks__/firebase.ts',
    '^firebase/firestore$': '<rootDir>/src/__mocks__/firebase.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json',
    },
  },
};