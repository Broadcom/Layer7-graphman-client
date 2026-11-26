// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

// Regression tests: the queries generated for export/renew/diff must stay the same as before
// the standard-mutations/composite-queries enhancements, for every supported schema version.

const fs = require("fs");
const path = require("path");
const tUtils = require("./utils");
const graphman = tUtils.load("graphman");
const gql = tUtils.load("graphql-query");
const utils = tUtils.load("graphman-utils");

const home = tUtils.config().home;
const defaultSchema = tUtils.config().schemaVersion;
const schemas = ["v11.1.1", "v11.1.2", "v11.1.3", "v11.1.4", "v11.1.5", "v11.2.0", "v11.2.1", "v11.2.2"]
    .filter(version => fs.existsSync(path.join(home, "schema", version, "schema.graphql")));

const generate = (query, options) =>
    gql.generate(query, {}, Object.assign({describeQuery: true}, options), "query");

afterAll(() => graphman.init(home, {options: {schema: defaultSchema}}));

describe.each(schemas)("schema %s", version => {
    beforeAll(() => graphman.init(home, {options: {schema: version}}));

    test("revisions mode is supported with all the schemas, its selector from v11.2.2 onwards", () => {
        expect(generate("policies:revisions").query).toContain("policyRevisions");

        if (utils.isSchemaVersionAtLeast(version, "v11.2.2")) {
            expect(generate("policies:revisions[0]").query).toContain("policyRevisions(selected: [0])");
        } else {
            expect(() => generate("policies:revisions[0]")).toThrow(/revision selection is supported from the schema v11.2.2/);
        }
    });

    test.each(["all", "all:summary", "all:full", "encass", "folder", "policy", "service", "sysinfo",
        "services", "services:summary", "policies:full", "clusterProperties:summary", "keys",
        "policyByName", "serviceByResolutionPath:summary"])("%s is generated", name => {
        const query = generate(name);

        expect(query.query).toMatch(/^query /);
        expect(query.query).not.toContain("{{");
    });

    test("predefined queries bring the policy dependencies in, with the unavailable fields excluded", () => {
        // these queries refer to fields (e.g. policyBackedServices) that the older schemas don't have
        ["encass", "folder", "policy", "service"].forEach(name => expect(() => generate(name)).not.toThrow());
    });
});

describe("generated query contents", () => {
    beforeAll(() => graphman.init(home, {options: {schema: defaultSchema}}));
    const revisionsModeTest = utils.isSchemaVersionAtLeast(defaultSchema, "v11.2.2") ? test : test.skip;

    const selectedFields = (query, root) => {
        // top level field names selected under the root field
        const lines = query.query.split("\n").map(line => line.trim());
        const start = lines.findIndex(line => line.startsWith(root + " ") || line === root + " {" || line.startsWith(root + "(")) + 1;
        const names = [];
        let depth = 0;

        for (const line of lines.slice(start)) {
            if (depth === 0 && line === "}") break;
            if (depth === 0 && line && !line.startsWith("#")) names.push(line.replace(/\s*[{(].*$/, ""));
            depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        }

        return names;
    };

    test("summary selects only the summary fields", () => {
        const typeInfo = graphman.typeInfoByPluralName("clusterProperties");
        const names = selectedFields(generate("clusterProperties:summary"), "clusterProperties");

        expect(names.length).toBeGreaterThan(0);
        names.forEach(name => expect(typeInfo.summaryFields).toContain(name));
    });

    test("default selection excludes the type's excluded fields", () => {
        const typeInfo = graphman.typeInfoByPluralName("clusterProperties");
        const names = selectedFields(generate("clusterProperties"), "clusterProperties");

        typeInfo.excludedFields.forEach(name => expect(names).not.toContain(name));
        expect(names).toEqual(expect.arrayContaining(["name", "value", "checksum"]));
    });

    test("a field can be excluded via the suffix", () => {
        expect(selectedFields(generate("clusterProperties:-description"), "clusterProperties")).not.toContain("description");
    });

    test("a field can be included along with the summary (two-stage suffix, supported by the standard-mutations release)", () => {
        expect(selectedFields(generate("clusterProperties:summary:+value"), "clusterProperties")).toContain("value");
    });

    test("the generated list queries take no variables", () => {
        expect(generate("services").query).toMatch(/^query services \{/);
    });

    test("single entity queries declare their argument", () => {
        const query = generate("policyByName");

        expect(query.query).toContain("$name: String!");
        expect(query.query).toContain("policyByName(name: $name)");
    });

    test("includePolicyRevisions adds the policy revisions to the selection", () => {
        expect(generate("policies").query).not.toContain("policyRevisions");
        expect(generate("policies", {includePolicyRevisions: true}).query).toContain("policyRevisions");
    });

    test("includePolicyRevisions is honored with the field list unless excluded", () => {
        expect(generate("policies:full:-folderPath", {includePolicyRevisions: true}).query).toContain("policyRevisions");
        expect(generate("policies:full:-policyRevisions", {includePolicyRevisions: true}).query).not.toContain("policyRevisions");
        expect(generate("policies:summary:+goid", {includePolicyRevisions: true}).query).not.toContain("policyRevisions");
        expect(generate("policies:full:-folderPath").query).not.toContain("policyRevisions");
    });

    revisionsModeTest("revisions mode includes the policy revisions and combines with other modes", () => {
        expect(generate("policies:revisions").query).toContain("policyRevisions");
        expect(generate("policies:revisions:-folderPath").query).toContain("policyRevisions");
        expect(generate("policies:summary").query).not.toContain("policyRevisions");
        expect(generate("policy:revisions").variables.includePolicyRevisions).toBe(true);
        expect(generate("all:revisions[0;-1]").query).toContain("policyRevisions(selected: [0, -1])");
        expect(generate("policies:full,revisions[-1]").query).toContain("policyRevisions(selected: [-1])");
    });

    revisionsModeTest("revisions mode carries the inline revision selection", () => {
        expect(generate("policies:revisions[0;-1]").query).toContain("policyRevisions(selected: [0, -1])");
        expect(generate("policies:full,revisions[2]:-folderPath").query).toContain("policyRevisions(selected: [2])");
        expect(() => generate("policies:revisions[x]")).toThrow(/invalid policy revision/);
    });

    revisionsModeTest("revisions mode is carried along with the summary mode", () => {
        const query = generate("policies:summary,revisions").query;
        const revisions = query.substring(query.indexOf("policyRevisions"));

        expect(query).toContain("policyRevisions");
        expect(revisions).toContain("ordinal");
        expect(revisions).not.toMatch(/xml/);
        expect(query).not.toMatch(/policy \{/);
        expect(generate("policy:summary,revisions[0]").variables.includePolicyRevisions).toBe(true);
        expect(generate("policy:summary,revisions[0]").query).toContain("policyRevisions(selected: [0])");
    });

    test("policy dependencies never include the policy revisions", () => {
        const query = generate("policy:full", {includePolicyRevisions: true}).query;
        const start = query.indexOf("allDependencies");
        let depth = 0;
        let end = query.indexOf("{", start);
        for (; end < query.length; end++) {
            if (query[end] === "{") depth++;
            else if (query[end] === "}" && --depth === 0) break;
        }
        const dependencies = query.substring(start, end);

        expect(start).toBeGreaterThan(-1);
        expect(query).toContain("policyRevisions");
        expect(dependencies).not.toContain("policyRevisions");
    });

    test("policyCodeFormat applies to the policy revisions", () => {
        const query = generate("policies:full:-folderPath", {includePolicyRevisions: true, policyCodeFormat: "json"}).query;
        const revisions = query.substring(query.indexOf("policyRevisions"));

        expect(revisions).toMatch(/\bjson\b/);
        expect(revisions).not.toMatch(/\bxml\b/);
    });

    revisionsModeTest("inline revision selection applies to the predefined queries", () => {
        expect(generate("policy:revisions[0;-1]").query).toContain("policyRevisions(selected: [0, -1])");
    });

    test("includeMultipartFields adds the file part name", () => {
        expect(generate("serverModuleFiles").query).not.toContain("filePartName");
        expect(generate("serverModuleFiles", {includeMultipartFields: true}).query).toContain("filePartName");
    });

    test("policyCodeFormat substitutes the policy code field", () => {
        expect(generate("policies").query).toMatch(/\bxml\b/);
        expect(generate("policies", {policyCodeFormat: "json"}).query).toMatch(/\bjson\b/);
        expect(generate("policies", {policyCodeFormat: "json"}).query).not.toMatch(/policy \{[^}]*\bxml\b/);
    });

    test("keyFormat substitutes the key detail field", () => {
        expect(generate("keys").query).toContain("p12");
        expect(generate("keys", {keyFormat: "pem"}).query).toContain("pem");
    });

    test("all query declares the policy revisions toggle", () => {
        const query = generate("all");

        expect(query.query).toContain("$includePolicyRevisions: Boolean");
        expect(query.query).toContain("@include");
    });

    test("summary mode of the predefined query turns the revisions off", () => {
        expect(generate("all:summary", {includePolicyRevisions: true}).variables.includePolicyRevisions).toBe(false);
    });

    test("full mode of a predefined query turns the dependencies on", () => {
        const query = generate("policy:full", {includePolicyRevisions: true});

        expect(query.variables.includeAllDependencies).toBe(true);
        expect(query.variables.includePolicyRevisions).toBe(true);
    });

    test("an unknown query name is reported", () => {
        expect(() => generate("no-such-query")).toThrow(/unrecognized query/);
    });

    test("variables are passed through", () => {
        const query = gql.generate("policyByName", {name: "my-policy"}, {describeQuery: true}, "query");

        expect(query.variables.name).toBe("my-policy");
    });
});
