# Jest Test Reporting Guide

This guide explains how to capture and generate various test reports for the Graphman Client project.

## Table of Contents

- [Quick Start](#quick-start)
- [Report Types](#report-types)
- [Running Tests with Reports](#running-tests-with-reports)
- [Report Formats](#report-formats)
- [CI/CD Integration](#cicd-integration)
- [Viewing Reports](#viewing-reports)

## Quick Start

### Install Dependencies

```bash
npm install
```

This installs:
- `jest` - Testing framework
- `jest-junit` - JUnit XML reporter for CI/CD
- `jest-html-reporter` - HTML test report generator

### Generate All Reports

```bash
npm run test:report
```

This generates:
- Console output with coverage summary
- HTML coverage report in `coverage/lcov-report/`
- LCOV coverage data in `coverage/lcov.info`

## Report Types

### 1. Console Output (Default)

**Command:**
```bash
npm test
```

**Output:**
- Test results in terminal
- Pass/fail status for each test
- Summary of test suites and tests

**Example:**
```
PASS  tests/combine.test.js
  combine command
    ✓ should throw error when --inputs parameter is missing (15ms)
    ✓ should combine two bundles with non-overlapping entities (45ms)
    ...

Test Suites: 20 passed, 20 total
Tests:       187 passed, 187 total
Snapshots:   0 total
Time:        12.345 s
```

### 2. Coverage Report

**Command:**
```bash
npm run test:coverage
```

**Generates:**
- `coverage/lcov-report/index.html` - Interactive HTML report
- `coverage/coverage-final.json` - JSON coverage data
- `coverage/lcov.info` - LCOV format for tools
- Console coverage summary

**Coverage Metrics:**
- **Statements**: Percentage of statements executed
- **Branches**: Percentage of conditional branches taken
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

**Example Console Output:**
```
--------------------------|---------|----------|---------|---------|-------------------
File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
--------------------------|---------|----------|---------|---------|-------------------
All files                 |   85.23 |    78.45 |   82.67 |   85.89 |                   
 modules                  |   87.45 |    80.12 |   85.34 |   88.01 |                   
  graphman-bundle.js      |   92.34 |    85.67 |   90.12 |   93.45 | 45-48,123         
  graphman-operation-*.js |   84.56 |    76.89 |   81.23 |   85.67 | ...               
  graphman-utils.js       |   88.90 |    82.34 |   87.56 |   89.12 | 234-240           
--------------------------|---------|----------|---------|---------|-------------------
```

### 3. JUnit XML Report (for CI/CD)

**Command:**
```bash
npm run test:ci
```

**Generates:**
- `test-reports/junit.xml` - JUnit XML format

**Use Cases:**
- Jenkins integration
- Azure DevOps
- GitLab CI
- GitHub Actions
- CircleCI

**Example XML:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests" tests="187" failures="0" errors="0" time="12.345">
  <testsuite name="combine command" tests="15" failures="0" errors="0" time="2.456">
    <testcase classname="combine command" name="should combine two bundles" time="0.045"/>
    ...
  </testsuite>
</testsuites>
```

### 4. HTML Test Report

**Command:**
```bash
npm test -- --reporters=jest-html-reporter
```

**Configuration** (add to `jest.config.js`):
```javascript
reporters: [
  'default',
  [
    'jest-html-reporter',
    {
      pageTitle: 'Graphman Client Test Report',
      outputPath: 'test-reports/test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      theme: 'darkTheme',
      dateFormat: 'yyyy-mm-dd HH:MM:ss'
    }
  ]
]
```

### 5. Cobertura XML Report (for Azure DevOps)

**Command:**
```bash
npm test -- --coverage --coverageReporters=cobertura
```

**Generates:**
- `coverage/cobertura-coverage.xml`

**Use Case:**
- Azure DevOps code coverage visualization

### 6. JSON Report

**Command:**
```bash
npm test -- --json --outputFile=test-reports/test-results.json
```

**Generates:**
- `test-reports/test-results.json` - Complete test results in JSON

**Use Cases:**
- Custom report processing
- Integration with custom dashboards
- Programmatic analysis

## Running Tests with Reports

### Standard Test Run

```bash
npm test
```

### Test with Coverage

```bash
npm run test:coverage
```

### Test with Verbose Output

```bash
npm run test:verbose
```

### Test in Watch Mode

```bash
npm run test:watch
```

### Test Specific File with Coverage

```bash
npm test -- tests/combine.test.js --coverage
```

### Test with Multiple Reporters

```bash
npm test -- --coverage \
  --coverageReporters=html \
  --coverageReporters=text \
  --coverageReporters=lcov \
  --coverageReporters=cobertura
```

### CI/CD Test Run

```bash
npm run test:ci
```

This runs tests with:
- Coverage collection
- JUnit XML output
- Optimized for CI environments
- Limited workers for resource management

## Report Formats

### HTML Coverage Report

**Location:** `coverage/lcov-report/index.html`

**Features:**
- Interactive file browser
- Line-by-line coverage highlighting
- Branch coverage visualization
- Sortable tables
- Drill-down into files

**View:**
```bash
# Windows
start coverage/lcov-report/index.html

# Mac
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html
```

### LCOV Report

**Location:** `coverage/lcov.info`

**Format:** Text-based coverage data

**Use Cases:**
- SonarQube integration
- Codecov.io
- Coveralls
- Code Climate

**Upload to Codecov:**
```bash
bash <(curl -s https://codecov.io/bash) -f coverage/lcov.info
```

### Text Summary

**Command:**
```bash
npm test -- --coverage --coverageReporters=text-summary
```

**Output:** Compact coverage summary in console

### JSON Coverage

**Location:** `coverage/coverage-final.json`

**Use Cases:**
- Custom processing
- Trend analysis
- Comparison between runs

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run tests with coverage
      run: npm run test:ci
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Publish Test Results
      uses: EnricoMi/publish-unit-test-result-action@v2
      if: always()
      with:
        files: test-reports/junit.xml
    
    - name: Upload Test Reports
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-reports
        path: |
          test-reports/
          coverage/
```

### Jenkins

```groovy
pipeline {
    agent any
    
    stages {
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Test') {
            steps {
                sh 'npm run test:ci'
            }
        }
    }
    
    post {
        always {
            junit 'test-reports/junit.xml'
            
            publishHTML([
                reportDir: 'coverage/lcov-report',
                reportFiles: 'index.html',
                reportName: 'Coverage Report'
            ])
            
            cobertura coberturaReportFile: 'coverage/cobertura-coverage.xml'
        }
    }
}
```

### Azure DevOps

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18.x'
  displayName: 'Install Node.js'

- script: npm install
  displayName: 'Install dependencies'

- script: npm run test:ci
  displayName: 'Run tests'

- task: PublishTestResults@2
  condition: always()
  inputs:
    testResultsFormat: 'JUnit'
    testResultsFiles: 'test-reports/junit.xml'
    failTaskOnFailedTests: true

- task: PublishCodeCoverageResults@1
  condition: always()
  inputs:
    codeCoverageTool: 'Cobertura'
    summaryFileLocation: 'coverage/cobertura-coverage.xml'
    reportDirectory: 'coverage/lcov-report'
```

### GitLab CI

```yaml
test:
  image: node:18
  stage: test
  script:
    - npm install
    - npm run test:ci
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    when: always
    reports:
      junit: test-reports/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
      - test-reports/
```

## Viewing Reports

### Open HTML Coverage Report

**Windows:**
```cmd
start coverage\lcov-report\index.html
```

**Mac:**
```bash
open coverage/lcov-report/index.html
```

**Linux:**
```bash
xdg-open coverage/lcov-report/index.html
```

### View Test Results in Terminal

```bash
npm test -- --verbose
```

### View Coverage Summary

```bash
npm test -- --coverage --coverageReporters=text-summary
```

### View Specific File Coverage

```bash
npm test -- --coverage --collectCoverageFrom=modules/graphman-bundle.js
```

## Advanced Configuration

### Custom Coverage Thresholds

Edit `jest.config.js`:

```javascript
coverageThresholds: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  './modules/graphman-operation-*.js': {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

### Exclude Files from Coverage

```javascript
coveragePathIgnorePatterns: [
  '/node_modules/',
  '/tests/',
  '/build/',
  'graphman-extension-.*\\.js'
]
```

### Custom Reporters

```javascript
reporters: [
  'default',
  ['jest-junit', { outputDirectory: './test-reports' }],
  ['jest-html-reporter', { 
    pageTitle: 'Test Report',
    outputPath: 'test-reports/test-report.html'
  }]
]
```

## Troubleshooting

### Coverage Not Generated

**Issue:** No coverage directory created

**Solution:**
```bash
npm test -- --coverage --collectCoverageFrom='modules/**/*.js'
```

### JUnit XML Not Generated

**Issue:** `jest-junit` not installed

**Solution:**
```bash
npm install --save-dev jest-junit
```

### HTML Report Not Opening

**Issue:** File path issues

**Solution:**
- Check file exists: `ls coverage/lcov-report/index.html`
- Use absolute path
- Check file permissions

### Low Coverage Numbers

**Issue:** Coverage thresholds not met

**Solution:**
- Add more tests
- Adjust thresholds in `jest.config.js`
- Use `--coverage --verbose` to see uncovered lines

## Best Practices

1. **Always Run Coverage Before Commits**
   ```bash
   npm run test:coverage
   ```

2. **Review HTML Coverage Report**
   - Identify untested code
   - Focus on critical paths
   - Aim for >80% coverage

3. **Use CI/CD Reports**
   - Track coverage trends
   - Fail builds on coverage drops
   - Generate reports on every PR

4. **Archive Reports**
   - Save reports for each release
   - Compare coverage over time
   - Document coverage improvements

5. **Focus on Quality**
   - Coverage percentage is not everything
   - Write meaningful tests
   - Test edge cases and error paths

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/configuration)
- [Jest Coverage Options](https://jestjs.io/docs/configuration#coveragereporters-arraystring--string-options)
- [jest-junit Documentation](https://github.com/jest-community/jest-junit)
- [LCOV Format](http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php)

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/Broadcom/Layer7-graphman-client/issues)
- Check existing test examples in `tests/` directory

