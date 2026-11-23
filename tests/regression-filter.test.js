// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

// Regression tests: the --filter options of export/slice keep working as before.

const tUtils = require("./utils");
const butils = tUtils.load("graphman-bundle");

const bundle = () => ({
    clusterProperties: [
        {name: "cwp-alpha", value: "1", checksum: "a"},
        {name: "cwp-beta", value: "2", checksum: "b"},
        {name: "other-gamma", value: "3", checksum: "c"}
    ],
    folders: [
        {path: "/", checksum: "d"},
        {path: "/apis", name: "apis", checksum: "e"}
    ]
});

const names = (result, section) => (result[section] || []).map(item => item.name || item.path);

// NOTE: before the enhancements, the legacy equals filter used to crash over the entities lacking the field
describe("legacy --filter.by options", () => {
    test("equals", () => {
        const result = bundle();
        butils.filter(result, {by: "name", equals: "cwp-beta"});

        expect(names(result, "clusterProperties")).toEqual(["cwp-beta"]);
    });

    test("startsWith", () => {
        const result = bundle();
        butils.filter(result, {by: "name", startsWith: "cwp-"});

        expect(names(result, "clusterProperties")).toEqual(["cwp-alpha", "cwp-beta"]);
    });

    test("endsWith", () => {
        const result = bundle();
        butils.filter(result, {by: "name", endsWith: "gamma"});

        expect(names(result, "clusterProperties")).toEqual(["other-gamma"]);
    });

    test("contains", () => {
        const result = bundle();
        butils.filter(result, {by: "name", contains: "eta"});

        expect(names(result, "clusterProperties")).toEqual(["cwp-beta"]);
    });

    test("the criteria are chained together by and-logic", () => {
        const result = bundle();
        butils.filter(result, {by: "name", startsWith: "cwp-", endsWith: "alpha"});

        expect(names(result, "clusterProperties")).toEqual(["cwp-alpha"]);
    });

    test("the sections without any matching entity are removed", () => {
        const result = bundle();
        butils.filter(result, {by: "name", equals: "cwp-beta"});

        expect(result.folders).toBeUndefined();
    });

    test("the entities without the field are filtered out", () => {
        const result = bundle();
        butils.filter(result, {by: "name", startsWith: "/"});

        expect(result.folders).toBeUndefined();
    });

    test("without any matching criteria nothing is filtered", () => {
        const result = bundle();
        butils.filter(result, {by: "name"});

        expect(result).toEqual(bundle());
    });

    test("without any filter nothing is filtered", () => {
        const result = bundle();
        butils.filter(result, undefined);

        expect(result).toEqual(bundle());
    });
});

// the section level filters are supported by the enhanced filter (the earlier releases applied the legacy options only)
describe("section level --filter options", () => {
    test("a plain value is an equality check", () => {
        const result = bundle();
        butils.filter(result, {clusterProperties: {name: "cwp-beta"}});

        expect(names(result, "clusterProperties")).toEqual(["cwp-beta"]);
        expect(names(result, "folders")).toEqual(["/", "apis"]);
    });

    test.each([
        ["regex", "^cwp-.*", ["cwp-alpha", "cwp-beta"]],
        ["neq", "cwp-beta", ["cwp-alpha", "other-gamma"]],
        ["eq%", "other", ["other-gamma"]],
        ["%eq", "alpha", ["cwp-alpha"]],
        ["%eq%", "-b", ["cwp-beta"]]
    ])("criteria %s with the separate value", (criteria, value, expected) => {
        const result = bundle();
        butils.filter(result, {clusterProperties: {name: [criteria, value]}});

        expect(names(result, "clusterProperties")).toEqual(expected);
    });

    test.each([
        ["regex.^cwp-.*", ["cwp-alpha", "cwp-beta"]],
        ["neq.cwp-beta", ["cwp-alpha", "other-gamma"]],
        ["eq.cwp-alpha", ["cwp-alpha"]]
    ])("criteria prefixed to the value, %s", (value, expected) => {
        const result = bundle();
        butils.filter(result, {clusterProperties: {name: value}});

        expect(names(result, "clusterProperties")).toEqual(expected);
    });

    test("the fields of a section are chained together by and-logic", () => {
        const result = bundle();
        butils.filter(result, {clusterProperties: {name: ["eq%", "cwp-"], value: "2"}});

        expect(names(result, "clusterProperties")).toEqual(["cwp-beta"]);
    });

    test("an unknown matching criteria doesn't filter anything", () => {
        const result = bundle();
        butils.filter(result, {clusterProperties: {name: ["unknown", "x"]}});

        expect(names(result, "clusterProperties")).toEqual(["cwp-alpha", "cwp-beta", "other-gamma"]);
    });
});
