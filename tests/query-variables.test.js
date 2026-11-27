// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const gql = tUtils.load("graphql-query");

const bundle = () => ({
    folders: [{name: "f1", path: "/f1"}, {name: "f2", path: "/f2"}],
    clusterProperties: [{name: "cwp", value: "1"}],
    properties: {defaultAction: "NEW_OR_UPDATE"}
});

const variablesOf = query => Object.keys(query.variables).sort();

describe("only the variables declared by the operation are sent, along with the bundle properties", () => {
    tUtils.standardMutationsTest("a standard mutation sends only its own input", () => {
        const query = gql.generate("setFolders", bundle(), {}, "mutation");

        expect(variablesOf(query)).toEqual(["folders", "properties"]);
        expect(query.variables.folders).toHaveLength(2);
    });

    test("install-bundle sends the declared sections", () => {
        const query = gql.generate("install-bundle", bundle(), {}, "mutation");

        expect(variablesOf(query)).toEqual(["clusterProperties", "folders", "properties"]);
    });

    test("the properties section of the bundle is kept intact", () => {
        const input = bundle();
        const query = gql.generate("install-bundle", input, {}, "mutation");

        expect(query.variables.properties).toEqual({defaultAction: "NEW_OR_UPDATE"});
    });

    tUtils.standardMutationsTest("a composite sends only the declared variables, without duplicating the bundle sections", () => {
        const query = gql.generateComposite(["setFolders", "deleteFolders"], bundle(), {}, {}, "mutation");

        expect(variablesOf(query)).toEqual(["folders", "properties"]);
        expect(query.variables.folders).toHaveLength(2);
    });

    tUtils.standardMutationsTest("a variable supplied explicitly for the disambiguated name is sent", () => {
        const refs = [{ref: {path: "/f1"}}];
        const query = gql.generateComposite(["setFolders", "deleteFolders"], Object.assign(bundle(), {folders2: refs}), {}, {}, "mutation");

        expect(variablesOf(query)).toEqual(["folders", "folders2", "properties"]);
        expect(query.variables.folders2).toEqual(refs);
    });

    tUtils.standardMutationsTest("a bundle section is not duplicated under the disambiguated name", () => {
        const query = gql.generateComposite(["setFolders", "deleteFolders"], bundle(), {}, {}, "mutation");

        expect(query.variables.folders2).toBeUndefined();
    });

    test("query variables are retained", () => {
        const query = gql.generate("folderByPath", {path: "/f1", unused: "x"}, {}, "query");

        expect(variablesOf(query)).toEqual(["path"]);
    });

    test("default toggles declared by the query are retained", () => {
        const query = gql.generate("all", {}, {includePolicyRevisions: true}, "query");

        expect(variablesOf(query)).toEqual(expect.arrayContaining(["includePolicyRevisions", "includeRoles"]));
    });

    test("the variables of an operation that declares none are dropped", () => {
        const query = gql.generate("sysinfo", {stray: "x"}, {}, "query");

        expect(query.variables).toEqual({});
    });
});

describe("list parameters of the mutations default to an empty list", () => {
    const utils = tUtils.load("graphman-utils");

    tUtils.standardMutationsTest("a standard mutation declares its list parameter with an empty default", () => {
        const query = gql.generate("setFolders", {}, {}, "mutation");

        expect(query.query).toContain("mutation setFolders($folders: [FolderInput!]! = [])");
    });

    tUtils.standardMutationsTest("the nullable list parameter of delete mutation gets the default as well", () => {
        const query = gql.generate("deleteFolders", {}, {}, "mutation");

        expect(query.query).toContain("mutation deleteFolders($folders: [FolderPartialInput!] = [])");
    });

    tUtils.standardMutationsTest("there is no missing variable warning when the input is not supplied", () => {
        const spy = jest.spyOn(utils, "warn").mockImplementation(() => {});

        try {
            gql.generate("setFolders", {}, {}, "mutation");
            gql.generateComposite(["setFolders", "deleteFolders"], {}, {}, {}, "mutation");

            expect(spy.mock.calls.filter(args => String(args[0]).includes("missing variable"))).toEqual([]);
        } finally {
            spy.mockRestore();
        }
    });

    tUtils.standardMutationsTest("composite mutations on the same entity type are still disambiguated", () => {
        const query = gql.generateComposite(["updateFolders", "deleteFolders"], {}, {}, {}, "mutation");

        expect(query.query).toContain("$folders: [FolderPartialInput!]! = []");
        expect(query.query).toContain("$folders2: [FolderPartialInput!] = []");
        expect(query.query).toContain("updateFolders(input: $folders)");
        expect(query.query).toContain("deleteFolders(input: $folders2)");
    });

});
