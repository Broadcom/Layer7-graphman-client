// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const gql = tUtils.load("graphql-query");
const butils = tUtils.load("graphman-bundle");
const validator = tUtils.load("args-validator");

const generate = suffix => gql.generate("services" + suffix, {}, {describeQuery: true}, "query");

describe("invalid query modes are rejected", () => {
    test.each([":sumary", ":summary,foo", ":none", ":-*"])("services%s", suffix => {
        expect(() => generate(suffix)).toThrow();
    });

    test.each([":summary", ":-name", ":none:name", ":full"])("services%s is accepted", suffix => {
        expect(() => generate(suffix)).not.toThrow();
    });
});

describe("invalid ignore filters are rejected", () => {
    test("empty rule", () => expect(() => butils.buildIgnoreMatcher({services: {}})).toThrow(/at least one field/));
    test("unknown criteria", () => expect(() => butils.buildIgnoreMatcher({services: {name: ["bad", "x"]}})).toThrow(/unsupported matching criteria/));
    test("valid rule", () => expect(() => butils.buildIgnoreMatcher({services: {name: "x"}})).not.toThrow());
});

describe("enum parameters", () => {
    const operation = {paramsSchema: {options: {scope: "enum:auto|full"}}};

    test("invalid value is rejected", () => {
        expect(() => validator.validate({options: {scope: "Full"}}, [], operation)).toThrow(/one of auto, full/);
    });

    test("valid value is accepted", () => {
        expect(() => validator.validate({options: {scope: "full"}}, [], operation)).not.toThrow();
    });
});
