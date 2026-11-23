// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const gql = tUtils.load("graphql-query");

const generate = (name, variables, options) => gql.generate(name, variables, Object.assign({describeQuery: true}, options), "mutation");

describe("update mutations drop the checksum field", () => {
    tUtils.standardMutationsTest("only checksum is removed, and the input is not modified", () => {
        const folder = {path: "/a", name: "a", checksum: "x", securityZoneName: "z"};
        const query = generate("updateFolders", {folders: [folder]});

        expect(query.variables.folders).toEqual([{path: "/a", name: "a", securityZoneName: "z"}]);
        expect(folder.checksum).toBe("x");
    });
});

describe("delete mutations identify the entities by the ref field", () => {
    tUtils.standardMutationsTest("natural key fields are used by default", () => {
        const query = generate("deleteFolders", {folders: [{goid: "g1", path: "/a", name: "a", checksum: "x"}]});

        expect(query.variables.folders).toEqual([{ref: {path: "/a"}}]);
    });

    tUtils.standardMutationsTest("composite natural keys", () => {
        const query = generate("deleteKeys", {keys: [{goid: "g1", keystoreId: "00", alias: "k", checksum: "x"}]});

        expect(query.variables.keys).toEqual([{ref: {keystoreId: "00", alias: "k"}}]);
    });

    tUtils.standardMutationsTest("goids are used when useRefGoids is on", () => {
        const query = generate("deleteFolders", {folders: [{goid: "g1", path: "/a"}, {path: "/b"}]}, {useRefGoids: true});

        expect(query.variables.folders).toEqual([{ref: {goid: "g1"}}, {ref: {path: "/b"}}]);
    });

    tUtils.standardMutationsTest("entities without any ref field are left as they are", () => {
        const query = generate("deleteFolders", {folders: [{checksum: "irrelevant"}]});

        expect(query.variables.folders).toEqual([{checksum: "irrelevant"}]);
    });

    tUtils.standardMutationsTest("set mutations are not touched", () => {
        const query = generate("setFolders", {folders: [{path: "/a", checksum: "x"}]});

        expect(query.variables.folders).toEqual([{path: "/a", checksum: "x"}]);
    });

    tUtils.standardMutationsTest("composite renamed variables are covered", () => {
        const composite = gql.generateComposite(["updateFolders", "deleteFolders"],
            {folders: [{path: "/a", checksum: "x"}], folders2: [{path: "/b", checksum: "y"}]},
            {describeQuery: true}, {}, "mutation");

        expect(composite.variables.folders).toEqual([{path: "/a"}]);
        expect(composite.variables.folders2).toEqual([{ref: {path: "/b"}}]);
    });
});
