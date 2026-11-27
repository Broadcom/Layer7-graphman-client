// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const graphmanModule = tUtils.load("graphman");

describe("schema version comparison", () => {
    test.each([
        ["v11.2.2", true],
        ["v11.2.3", true],
        ["v11.10.0", true],
        ["v12.0.0", true],
        ["v11.2.1", false],
        ["v11.2.0", false],
        ["v11.1.5", false],
        ["v11.1.4", false],
        ["v11.1.00", false],
        ["v11.0.00-CR03", false],
        ["unknown", false]
    ])("%s is at least v11.2.2: %s", (version, expected) => {
        expect(graphmanModule.isSchemaVersionAtLeast(version, "v11.2.2")).toBe(expected);
    });
});

describe("standard mutations are limited to the schema v11.2.2 onwards", () => {
    function run(schema, ...args) {
        const result = tUtils.graphmanWithInput("", ...args, "--options.schema", schema);
        return result.stdout + result.stderr;
    }

    test("a standard mutation is rejected for older schemas", () => {
        const output = run("v11.2.1", "describe", "--queries", "setFolders");

        expect(output).toContain("standard mutations are supported from the schema v11.2.2 onwards");
        expect(output).toContain("unrecognized query or mutation setFolders");
    });

    test("in-built mutations are not listed for older schemas", () => {
        const output = run("v11.2.1", "describe");

        expect(output).toContain("available in-built queries:");
        expect(output).not.toContain("available in-built mutations:");
    });

    test("a standard mutation is generated for the schema v11.2.2", () => {
        const output = run("v11.2.2", "describe", "--queries", "setFolders");

        expect(output).toContain("setFolders(input: $folders)");
    });

    test("in-built mutations are listed for the schema v11.2.2", () => {
        expect(run("v11.2.2", "describe")).toContain("available in-built mutations:");
    });
});

describe("standard mutation details in the schema metadata", () => {
    const utils = tUtils.load("graphman-utils");
    const gqlschema = tUtils.load("graphql-schema");

    // rebuilds the metadata from the schema files, without overwriting the pre-compiled metadata file
    function rebuild(schemaVersion) {
        let captured = null;
        const spy = jest.spyOn(utils, "writeFile").mockImplementation((file, content) => {
            captured = JSON.parse(JSON.stringify(content));
        });

        try {
            gqlschema.build("v-test", schemaVersion, true);
        } finally {
            spy.mockRestore();
        }

        return captured;
    }

    const hasPartialInputs = metadata => Object.keys(metadata.types).some(name => name.endsWith("PartialInput"));

    test.each(["v11.1.4", "v11.1.5", "v11.2.0", "v11.2.1"])("%s metadata does not capture the mutation details", version => {
        const metadata = rebuild(version);

        expect(metadata.types["Mutation"]).toBeUndefined();
        expect(hasPartialInputs(metadata)).toBe(false);
    });

    test("v11.2.2 metadata captures the mutation details", () => {
        const metadata = rebuild("v11.2.2");

        expect(metadata.types["Mutation"].fields.length).toBeGreaterThan(0);
        expect(hasPartialInputs(metadata)).toBe(true);
    });
});
