/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageReporters: ['text'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

export default config;
