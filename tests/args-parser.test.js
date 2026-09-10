// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const parser = tUtils.load("args-parser");

test("test simple arguments", () => {
    const params = parser.parse([
        "--using", "serviceByResolutionPath",
        "--gateway", "ssg-source",
        "--includePolicyRevisions", "false",
        "--revision", "111"
    ]);

    expect(params).toMatchObject({
        "using": "serviceByResolutionPath",
        "gateway": "ssg-source",
        "includePolicyRevisions": false,
        "revision": 111
    });
});

test("test complex arguments", () => {
    const params = parser.parse([
        "--using", "serviceByResolutionPath",
        "--gateway=ssg-source", // argument with implicit value
        "--includePolicyRevisions", // argument with no explicit value
        "--variables.resolutionPath", "/hello-world",
        "--variables.baseUris", "http://example.com", "http://example2.com", // arrays
        "--variables.revision", "123", // number
        "--using", "serviceByResolvers", //overwrite the argument
        "--variables.revision", "456", //overwrite the complex argument
        "--includeRoles" // last argument with no explicit value
    ]);

    expect(params).toMatchObject({
        "using": "serviceByResolvers",
        "gateway": "ssg-source",
        "includePolicyRevisions": true,
        "variables": {
            "resolutionPath": "/hello-world",
            "baseUris": ["http://example.com", "http://example2.com"],
            "revision": 456
        },
        "includeRoles": true
    });
});

test("test controlled array of plain values using trailing +", () => {
    const params = parser.parse([
        "--roles.+", "Admin",
        "--roles.+", "User"
    ]);

    expect(params).toMatchObject({
        "roles": ["Admin", "User"]
    });
});

test("test controlled array of records using mid-path +", () => {
    const params = parser.parse([
        "--input.+.name", "foo",
        "--input.value", "bar",
        "--input.+.name", "baz",
        "--input.value", "qux"
    ]);

    expect(params).toMatchObject({
        "input": [
            {"name": "foo", "value": "bar"},
            {"name": "baz", "value": "qux"}
        ]
    });
});

test("test controlled array of records with a nested leaf array", () => {
    const params = parser.parse([
        "--rules.+.name", "r1",
        "--rules.roles.+", "Admin",
        "--rules.roles.+", "Editor",
        "--rules.+.name", "r2",
        "--rules.roles.+", "Viewer"
    ]);

    expect(params).toMatchObject({
        "rules": [
            {"name": "r1", "roles": ["Admin", "Editor"]},
            {"name": "r2", "roles": ["Viewer"]}
        ]
    });
});
