// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const diff = tUtils.load("graphman-operation-diff");

describe("mappings captured before renewing the entities are retained", () => {
    test("base mappings are kept, duplicates dropped, new ones added", () => {
        const base = {goids: [{source: "a", target: "b"}], guids: [{source: "g1", target: "g2"}]};
        const extra = {goids: [{source: "a", target: "b"}, {source: "c", target: "d"}], guids: []};

        expect(diff.mergeMappings(base, extra)).toEqual({
            goids: [{source: "a", target: "b"}, {source: "c", target: "d"}],
            guids: [{source: "g1", target: "g2"}]
        });
    });

    test("the inputs are not modified", () => {
        const base = {goids: [{source: "a", target: "b"}], guids: []};
        diff.mergeMappings(base, {goids: [{source: "c", target: "d"}], guids: []});

        expect(base.goids).toHaveLength(1);
    });
});
