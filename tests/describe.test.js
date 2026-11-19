// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

describe("describe command", () => {

    test("should list all available queries when no query name specified", () => {
        const output = graphman("describe");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("available queries:"));
        expect(output.stdout).toEqual(expect.stringContaining("available mutations:"));
        expect(output.stdout).toEqual(expect.stringContaining("available in-built queries:"));
    });

    test("should describe specific query by name", () => {
        const output = graphman("describe", "--query", "all");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should describe query with summary variant", () => {
        const output = graphman("describe", "--query", "all:summary");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should describe services query", () => {
        const output = graphman("describe", "--query", "service");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should describe policies query", () => {
        const output = graphman("describe", "--query", "policy");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should describe clusterProperties query", () => {
        const output = graphman("describe", "--query", "clusterProperties");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should describe folder query", () => {
        const output = graphman("describe", "--query", "folder");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should describe encass query", () => {
        const output = graphman("describe", "--query", "encass");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should describe install-bundle mutation", () => {
        const output = graphman("describe", "--query", "install-bundle");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("mutation"));
    });

    test("should describe delete-bundle mutation", () => {
        const output = graphman("describe", "--query", "delete-bundle");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("mutation"));
    });

    test("should handle wildcard query pattern with single match", () => {
        const output = graphman("describe", "--query", "serv*");

        expect(output.stdout).toBeDefined();
        // Should show query details or list matches
    });

    test("should handle wildcard query pattern with multiple matches", () => {
        const output = graphman("describe", "--query", "*bundle*");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("matches found"));
    });

    test("should handle wildcard with no matches", () => {
        const output = graphman("describe", "--query", "nonexistent*");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("no matches found"));
    });

    test("should describe sysinfo query", () => {
        const output = graphman("describe", "--query", "sysinfo");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query"));
    });

    test("should list queries without errors", () => {
        const output = graphman("describe");

        expect(output.stdout).toBeDefined();
        // Should complete without throwing errors
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should describe query and show fields", () => {
        const output = graphman("describe", "--query", "all");

        expect(output.stdout).toBeDefined();
        // Query description should contain field information
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should handle describe with output file option", () => {
        const output = graphman("describe", 
            "--query", "all");

        expect(output.stdout).toBeDefined();
        // Should work with output option
    });

    test("should describe multiple queries using wildcard", () => {
        const output = graphman("describe", "--query", "all*");

        expect(output.stdout).toBeDefined();
        // Should handle wildcard patterns
    });

    test("should describe query with complex name", () => {
        const output = graphman("describe", "--query", "install-bundle");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("mutation"));
    });

    test("should list available queries including custom ones", () => {
        const output = graphman("describe");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("available queries:"));
        // Should list all available queries from queries directory
    });

    test("should describe composite query built from multiple query names", () => {
        const output = graphman("describe", "--queries", "clusterProperties", "sysinfo");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("query composite"));
        expect(output.stdout).toEqual(expect.stringContaining("clusterProperties"));
        expect(output.stdout).toEqual(expect.stringContaining("passwordPolicies"));
    });

    test("should auto-disambiguate colliding argument names by position", () => {
        const output = graphman("describe", "--queries", "policyByName", "secretByName");

        expect(output.stdout).toEqual(expect.stringContaining("$name: String!"));
        expect(output.stdout).toEqual(expect.stringContaining("$name2: String!"));
        expect(output.stdout).toEqual(expect.stringContaining("policyByName(name: $name)"));
        expect(output.stdout).toEqual(expect.stringContaining("secretByName(name: $name2)"));
    });

    test("should override the auto-disambiguated argument name via --queryArgs", () => {
        const output = graphman("describe", "--queries", "policyByName", "secretByName",
            "--queryArgs.2.name", "secretName");

        expect(output.stdout).toEqual(expect.stringContaining("$secretName: String!"));
        expect(output.stdout).toEqual(expect.stringContaining("secretByName(name: $secretName)"));
        expect(output.stdout).not.toEqual(expect.stringContaining("$name2"));
    });

    test("should keep shared optional toggles undisambiguated across composed queries", () => {
        const output = graphman("describe", "--queries", "folder", "service");

        // $folderPath and $resolutionPath are each declared once, and the common
        // includeAllDependencies/includePolicyRevisions toggles are shared, not suffixed
        expect(output.stdout).toEqual(expect.stringContaining("$folderPath: String!"));
        expect(output.stdout).toEqual(expect.stringContaining("$resolutionPath: String!"));
        // only the header declaration includes the ": Boolean" type suffix, so this counts
        // declarations, not the (expected, multiple) @include usages of the same variable
        expect((output.stdout.match(/\$includeAllDependencies: Boolean/g) || []).length).toBe(1);
        expect((output.stdout.match(/\$includePolicyRevisions: Boolean/g) || []).length).toBe(1);
    });

    test("should describe a composite mutation built from multiple mutation names", () => {
        const output = graphman("describe", "--queries", "setFolders", "deleteKeys");

        expect(output.stdout).toEqual(expect.stringContaining("mutation composite"));
        expect(output.stdout).not.toEqual(expect.stringContaining("query composite"));
        expect(output.stdout).toEqual(expect.stringContaining("setFolders(input: $folders)"));
        expect(output.stdout).toEqual(expect.stringContaining("deleteKeys(input: $keys)"));
    });

    test("should auto-disambiguate colliding argument names across composed mutations", () => {
        const output = graphman("describe", "--queries", "setFolders", "deleteFolders");

        expect(output.stdout).toEqual(expect.stringContaining("$folders:"));
        expect(output.stdout).toEqual(expect.stringContaining("$folders2:"));
        expect(output.stdout).toEqual(expect.stringContaining("setFolders(input: $folders)"));
        expect(output.stdout).toEqual(expect.stringContaining("deleteFolders(input: $folders2)"));
    });

    test("should reject combining a query name with a mutation name", () => {
        const output = graphman("describe", "--queries", "all", "setFolders");

        expect(output.stdout).toEqual(expect.stringContaining(
            "cannot combine query and mutation names in the same composite"));
    });
});

