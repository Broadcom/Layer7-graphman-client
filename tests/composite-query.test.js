// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const gql = tUtils.load("graphql-query");

const composite = (...names) => gql.generateComposite(names, {}, {describeQuery: true}, {}, "query");

describe("a root field can be selected only once in a composite query", () => {
    test("the same query with a different suffix is rejected", () => {
        expect(() => composite("policyByName", "policyByName:summary")).toThrow(
            /duplicate root field 'policyByName' .* 'policyByName' and 'policyByName:summary'/);
    });

    test("the queries with different suffixes of a list query are rejected", () => {
        expect(() => composite("services:summary", "services:dependencies")).toThrow(/duplicate root field 'services'/);
    });

    test("the predefined queries/mutations cannot be combined", () => {
        expect(() => composite("all", "services")).toThrow(/'all' is a predefined query\/mutation and cannot be used in a composite/);
        expect(() => composite("services", "sysinfo:summary")).toThrow(/'sysinfo' is a predefined/);
        expect(() => gql.generateComposite(["install-bundle", "setFolders"], {}, {}, {}, "mutation")).toThrow(/'install-bundle' is a predefined/);
        expect(() => gql.generateComposite(["delete-bundle"], {}, {}, {}, "mutation")).toThrow(/'delete-bundle' is a predefined/);
    });

    test("the same query repeated is rejected", () => {
        expect(() => composite("policyByName", "policyByName")).toThrow(/duplicate root field 'policyByName'/);
    });

    test("different root fields are combined", () => {
        const query = composite("policyByName", "serviceByResolutionPath:summary");

        expect(query.query).toContain("policyByName(name: $name)");
        expect(query.query).toContain("serviceByResolutionPath(");
    });

    tUtils.standardMutationsTest("the same mutation repeated is rejected", () => {
        expect(() => gql.generateComposite(["setFolders", "setFolders"], {}, {}, {}, "mutation")).toThrow(
            /duplicate root field 'setFolders'/);
    });

    tUtils.standardMutationsTest("different mutations on the same entity type are combined", () => {
        const query = gql.generateComposite(["setFolders", "deleteFolders"], {}, {}, {}, "mutation");

        expect(query.query).toContain("setFolders(input: $folders)");
        expect(query.query).toContain("deleteFolders(input: $folders2)");
    });
});
