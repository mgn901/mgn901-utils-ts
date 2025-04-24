/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageReporters: ['text'],
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.jsx'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};

export default config;
