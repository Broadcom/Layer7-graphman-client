// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

// Regression tests: command line parameters accepted before the parameter validation was introduced
// are still accepted.

const tUtils = require("./utils");
const parser = tUtils.load("args-parser");
const validator = tUtils.load("args-validator");
const graphman = tUtils.load("graphman");

const operations = ["export", "import", "renew", "diff"].reduce((all, name) => {
    all[name] = tUtils.load("graphman-operation-" + name);
    return all;
}, {});

const parse = (...args) => {
    const params = parser.parse(args);
    delete params.__unknowns;
    return params;
};

const validate = (operation, ...args) => {
    const params = parser.parse(args);
    validator.validate(params, args, operations[operation]);
    return params;
};

beforeAll(() => graphman.init(tUtils.config().home, {options: {}}));

describe("the parser", () => {
    test("name-value pairs", () => {
        expect(parse("--using", "all:summary", "--gateway", "g1")).toEqual({using: "all:summary", gateway: "g1"});
    });

    test("equals notation", () => {
        expect(parse("--a=1", "--b.c=2")).toEqual({a: 1, b: {c: 2}});
    });

    test("values are normalized to numbers and booleans", () => {
        expect(parse("--variables.count", "5", "--variables.flag", "true", "--variables.name", "x"))
            .toEqual({variables: {count: 5, flag: true, name: "x"}});
    });

    test("a flag without value is true", () => {
        expect(parse("--options.excludeGoids", "--gateway", "x")).toEqual({options: {excludeGoids: true}, gateway: "x"});
    });

    test("dot notation builds the complex objects", () => {
        expect(parse("--options.mappings.default.action", "NEW_OR_UPDATE", "--variables.a.b.c", "v")).toEqual({
            options: {mappings: {default: {action: "NEW_OR_UPDATE"}}},
            variables: {a: {b: {c: "v"}}}
        });
    });

    test("repeated values form a list", () => {
        expect(parse("--sections", "services", "policies")).toEqual({sections: ["services", "policies"]});
    });

    test("filters with the matching criteria", () => {
        expect(parse("--filter.services.name", "regex", "a.*")).toEqual({filter: {services: {name: ["regex", "a.*"]}}});
        expect(parse("--filter.by", "name", "--filter.startsWith", "x")).toEqual({filter: {by: "name", startsWith: "x"}});
    });
});

describe("the validator accepts the parameters used by the earlier releases", () => {
    test.each([
        ["export", ["--using", "all:summary", "--gateway", "source-gateway", "--output", "out.json"]],
        ["export", ["--using", "policyByName", "--variables.name", "my-policy", "--options.includePolicyRevisions", "true"]],
        ["export", ["--using", "all", "--filter.by", "name", "--filter.equals", "x"]],
        ["export", ["--using", "all", "--filter.services.name", "regex", "a.*"]],
        ["export", ["--using", "all", "--options.excludeDeprecatedFields", "false", "--options.keyFormat", "pem"]],
        ["export", ["--using", "all", "--options.policyCodeFormat", "json", "--options.schema", "v11.1.1"]],
        ["export", ["--using", "all", "--options.excludeDependencies", "true", "--options.bundleDefaultAction", "NEW_OR_UPDATE"]],
        ["import", ["--input", "a.json", "--gateway", "target-gateway", "--options.bundleDefaultAction", "NEW_OR_UPDATE"]],
        ["import", ["--using", "delete-bundle", "--input", "a.json", "--options.forceDelete", "true"]],
        ["import", ["--input", "a.json", "--options.test", "true", "--options.activate", "false"]],
        ["import", ["--input", "a.json", "--options.mappings.default.action", "NEW_OR_UPDATE"]],
        ["import", ["--input", "a.json", "--options.overrideReplaceRoleAssignees", "true", "--options.excludeGoids"]],
        ["renew", ["--input", "a.json", "--gateway", "g", "--sections", "services", "policies"]],
        ["renew", ["--input", "a.json", "--gateway", "g", "--options.useGoids", "true", "--options.includePolicyRevisions"]],
        ["diff", ["--input-source", "a.json", "--input-target", "@gw", "--output", "x.json", "--options.includeDeletes"]],
        ["diff", ["--input-source", "a.json", "--input-target", "b.json", "--input-mappings", "m.json", "--options.useNoDefMappings", "true"]],
        ["diff", ["--input-source", "@a", "--input-target", "@b", "--options.renewEntities", "true", "--options.includePolicyRevisions", "true"]],
        ["diff", ["--input-report", "r.json", "--options.includeInserts", "false", "--options.includeUpdates", "false"]]
    ])("%s %j", (operation, args) => {
        const log = jest.spyOn(console, "log").mockImplementation(() => {});
        try {
            expect(() => validate(operation, ...args)).not.toThrow();
            expect(log.mock.calls.filter(call => String(call[0]).includes("unknown parameter"))).toEqual([]);
        } finally {
            log.mockRestore();
        }
    });

    test.each([
        ["import", ["--input", "a.json", "--options.comment", "123"], ["options", "comment"], "123"],
        ["import", ["--input", "a.json", "--options.comment", "true"], ["options", "comment"], "true"],
        ["export", ["--using", "all", "--gateway", "1"], ["gateway"], "1"],
        ["export", ["--using", "all", "--output", "1"], ["output"], "1"]
    ])("numbers and booleans are retained as text by the string parameters, %s %j", (operation, args, path, expected) => {
        const params = validate(operation, ...args);

        expect(path.reduce((obj, key) => obj[key], params)).toBe(expected);
    });

    test("a list for a string parameter is still rejected", () => {
        expect(() => validate("export", "--output", "a", "b")).toThrow(/expected type string/);
    });

    test("a value of the wrong type for a boolean parameter is still rejected", () => {
        expect(() => validate("import", "--input", "a.json", "--options.excludeGoids", "maybe")).toThrow(/expected type boolean/);
    });
});
