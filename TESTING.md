# Testing Guide

This document describes how to run and write tests for the Graphman Client.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Test Setup](#test-setup)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: Version 16.15.0 or higher
- **npm**: Comes with Node.js
- **Layer7 API Gateway**: Required for integration tests (optional for unit tests)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Broadcom/Layer7-graphman-client.git
cd graphman-client
```

2. Install dependencies:
```bash
npm install
```

This will install:
- `jest` (v29.7.0) - Testing framework
- `diff` (v5.2.0) - Optional dependency for diff operations

## Test Setup

### Environment Configuration

1. **Set GRAPHMAN_HOME environment variable**:

   **Linux/Mac:**
   ```bash
   export GRAPHMAN_HOME=/path/to/graphman-client
   export GRAPHMAN_ENTRYPOINT=./graphman.sh
   ```

   **Windows (Command Prompt):**
   ```cmd
   set GRAPHMAN_HOME=C:\path\to\graphman-client
   set GRAPHMAN_ENTRYPOINT=graphman.bat
   ```

2. **Configure Gateway Connection** (for integration tests):

   Edit `graphman.configuration` file:
   ```json
   {
     "gateways": {
       "default": {
         "address": "https://your-gateway:8443",
         "username": "admin",
         "password": "password",
         "rejectUnauthorized": false,
         "allowMutations": false
       },
       "source-gateway": {
         "address": "https://source-gateway:8443",
         "username": "admin",
         "password": "password",
         "rejectUnauthorized": false,
         "allowMutations": false
       },
       "target-gateway": {
         "address": "https://target-gateway:8443",
         "username": "admin",
         "password": "password",
         "rejectUnauthorized": false,
         "allowMutations": true
       }
     }
   }
   ```

3. **Initialize Test Configuration** (optional):

   ```bash
   node tests/init.js
   ```

   This script:
   - Adds test script to `package.json`
   - Configures gateway profiles for testing

## Running Tests

### Run All Tests

```bash
npm test
```

Or directly with Jest:
```bash
npx jest
```

### Run Specific Test File

```bash
npm test -- tests/combine.test.js
```

Or:
```bash
npx jest tests/combine.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="combine"
```

### Run Tests in Watch Mode

```bash
npx jest --watch
```

### Run Tests with Coverage

```bash
npx jest --coverage
```

### Verbose Output

```bash
npm test -- --verbose
```

## Test Structure

### Test Directory Layout

```
tests/
├── init.js                           # Test initialization script
├── utils.js                          # Test utilities and helpers
├── utils.test.js                     # Tests for utilities
├── args-parser.test.js               # Command-line argument parsing tests
├── combine.test.js                   # Combine operation tests
├── diff.test.js                      # Diff operation tests
├── export.test.js                    # Export operation tests
├── bundle.import-sanitizer.test.js   # Bundle sanitization tests
├── global-policies.test.js           # Global policies tests
├── keys.test.js                      # Key management tests
└── standard-bundle.mutations.test.js # Standard bundle mutation tests
```

### Test Categories

1. **Unit Tests**: Test individual functions and modules
   - `utils.test.js`
   - `args-parser.test.js`

2. **Operation Tests**: Test Graphman operations
   - `combine.test.js`
   - `diff.test.js`
   - `export.test.js`

3. **Integration Tests**: Test with Gateway (require running Gateway)
   - `standard-bundle.mutations.test.js`
   - `keys.test.js`

## Writing Tests

### Basic Test Structure

```javascript
// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

describe("operation name", () => {
    
    test("should do something", () => {
        const output = graphman("operation", 
            "--param1", "value1",
            "--param2", "value2");
        
        expect(output.someField).toBeDefined();
        expect(output.someArray).toHaveLength(2);
    });
});
```

### Using Test Utilities

#### Execute Graphman Commands

```javascript
const {graphman} = require("./utils");

// Execute command and get JSON output
const output = graphman("export", 
    "--gateway", "default",
    "--using", "all");

console.log(output.services);
```

#### Load Modules

```javascript
const tUtils = require("./utils");
const utils = tUtils.load("graphman-utils");

// Use loaded module
const encoded = utils.base64StringEncode("test");
```

#### Create Test Files

```javascript
const fs = require('fs');
const path = require('path');
const tUtils = require("./utils");

function createTestBundle(filename, content) {
    const testDir = tUtils.config().workspace;
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    const filepath = path.join(testDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    return filepath;
}
```

### Common Test Patterns

#### Testing Command Output

```javascript
test("should export services", () => {
    const output = graphman("export", 
        "--using", "services",
        "--gateway", "default");
    
    expect(output.services).toBeDefined();
    expect(Array.isArray(output.services)).toBe(true);
});
```

#### Testing Error Conditions

```javascript
test("should throw error when parameter missing", () => {
    expect(() => {
        graphman("combine");
    }).toThrow();
});
```

#### Testing Array Contents

```javascript
test("should contain expected entities", () => {
    const output = graphman("combine", 
        "--inputs", "bundle1.json", "bundle2.json");
    
    expect(output.services).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "Service1"}),
        expect.objectContaining({name: "Service2"})
    ]));
});
```

#### Testing Object Properties

```javascript
test("should have correct properties", () => {
    const output = graphman("export", "--using", "service");
    
    expect(output.services[0]).toMatchObject({
        name: "MyService",
        enabled: true,
        resolutionPath: "/myservice"
    });
});
```

## Test Utilities

### Available Utilities (tests/utils.js)

#### `config(cfg)`
Get or set test configuration.

```javascript
const config = tUtils.config();
console.log(config.home);        // GRAPHMAN_HOME path
console.log(config.workspace);   // Test workspace directory
console.log(config.schemaVersion); // Current schema version
```

#### `load(moduleName)`
Load a Graphman module for testing.

```javascript
const utils = tUtils.load("graphman-utils");
const butils = tUtils.load("graphman-bundle");
```

#### `graphman(...args)`
Execute Graphman command and return JSON output.

```javascript
const output = graphman("export", 
    "--gateway", "default",
    "--using", "all",
    "--output", "output.json");
```

#### `metadata()`
Get schema metadata.

```javascript
const metadata = tUtils.metadata();
console.log(metadata.types);
console.log(metadata.bundleTypes);
```

#### `readFileAsJson(path)`
Read and parse JSON file.

```javascript
const data = tUtils.readFileAsJson("samples/bundle.json");
```

## Troubleshooting

### Common Issues

#### 1. GRAPHMAN_HOME not set

**Error:**
```
Cannot find module './modules/graphman-utils'
```

**Solution:**
```bash
export GRAPHMAN_HOME=/path/to/graphman-client
```

#### 2. Gateway not accessible

**Error:**
```
Error: connect ECONNREFUSED
```

**Solution:**
- Verify Gateway is running
- Check `graphman.configuration` has correct Gateway address
- Ensure network connectivity
- For integration tests, use `--testPathIgnorePatterns` to skip them

#### 3. Test workspace directory issues

**Error:**
```
ENOENT: no such file or directory
```

**Solution:**
The test workspace is automatically created at `$GRAPHMAN_HOME/build/tests`. Ensure write permissions.

#### 4. Module not found

**Error:**
```
Cannot find module 'jest'
```

**Solution:**
```bash
npm install
```

## Test Coverage

Generate coverage report:

```bash
npm run test:coverage
```

Or using Jest directly:
```bash
npx jest --coverage
```

Coverage report will be generated in `coverage/` directory.

View HTML report:
```bash
open coverage/lcov-report/index.html  # Mac
xdg-open coverage/lcov-report/index.html  # Linux
start coverage/lcov-report/index.html  # Windows
```

### Generate All Reports

Use the provided scripts to generate comprehensive test reports:

**Linux/Mac:**
```bash
./generate-test-reports.sh
```

**Windows:**
```bash
generate-test-reports.bat
```

**Or using npm:**
```bash
npm run test:report
```

For detailed information about test reporting, see:
- [TEST-REPORTING.md](./TEST-REPORTING.md) - Complete test reporting guide
- [TEST-REPORTS-QUICK-REFERENCE.md](./TEST-REPORTS-QUICK-REFERENCE.md) - Quick reference

## Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on other tests
2. **Clean Up**: Remove temporary files created during tests
3. **Use Descriptive Names**: Test names should clearly describe what is being tested
4. **Test Edge Cases**: Include tests for error conditions and boundary cases
5. **Mock External Dependencies**: For unit tests, mock Gateway connections
6. **Keep Tests Fast**: Unit tests should run quickly; separate slow integration tests
7. **Document Complex Tests**: Add comments explaining non-obvious test logic

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Graphman Wiki](https://github.com/Broadcom/Layer7-graphman-client/wiki)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#-testing-and-overall-quality-practices)

## Contributing

When adding new features:

1. Write tests for new functionality
2. Ensure all existing tests pass
3. Update this document if adding new test utilities
4. Follow existing test patterns and conventions

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/Broadcom/Layer7-graphman-client/issues)
- Check the [Wiki](https://github.com/Broadcom/Layer7-graphman-client/wiki)

