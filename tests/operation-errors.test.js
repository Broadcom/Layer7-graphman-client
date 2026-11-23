// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");

function run(...args) {
    const result = tUtils.graphmanWithInput("", ...args);
    return result.stdout + result.stderr;
}

const IMPORT_INPUT = ["--input", "samples/folder/entities.json", "--gateway", "target-gateway"];

describe("export works with the GraphQL query fields", () => {
    test("unknown query is reported as an unrecognized query", () => {
        const output = run("export", "--query", "unknown-query");

        expect(output).toContain("unrecognized query unknown-query");
        expect(output).not.toContain("unrecognized mutation");
    });

    test("unknown query in the composite is reported as an unrecognized query", () => {
        expect(run("export", "--queries", "services", "unknown-query")).toContain("unrecognized query unknown-query");
    });

    test("a mutation is reported as a mismatch", () => {
        expect(run("export", "--query", "setFolders")).toContain(
            "export operation works with the GraphQL query fields, but the specified one is a mutation");
    });

    test("a standard mutation is reported as an unrecognized query for older schemas", () => {
        expect(run("export", "--query", "setFolders", "--options.schema", "v11.2.1")).toContain(
            "unrecognized query setFolders");
    });
});

describe("import works with the GraphQL mutation fields", () => {
    test("unknown mutation is reported as an unrecognized mutation", () => {
        const output = run("import", "--query", "unknown-mutation", ...IMPORT_INPUT);

        expect(output).toContain("unrecognized mutation unknown-mutation");
        expect(output).not.toContain("unrecognized query");
    });

    test("unknown mutation in the composite is reported as an unrecognized mutation", () => {
        expect(run("import", "--queries", "setFolders", "unknown-mutation", ...IMPORT_INPUT)).toContain(
            "unrecognized mutation unknown-mutation");
    });

    test("a query is reported as a mismatch", () => {
        expect(run("import", "--query", "services", ...IMPORT_INPUT)).toContain(
            "import operation works with the GraphQL mutation fields, but the specified one is a query");
    });
});
