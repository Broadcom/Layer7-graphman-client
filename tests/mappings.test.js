/*
 * Copyright ©  2026. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const tUtils = require("./utils");
const {graphman} = tUtils;

test("generate mappings - flat identity fields for pre-11.1.1 schema (v11.1.00)", () => {
    const output = graphman("mappings",
        "--input", "samples/cluster-properties.json",
        "--mappings.action", "IGNORE",
        "--mappings.level", "2",
        "--options.schema", "v11.1.00");

    expect(output.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({action: "IGNORE", name: "greetings"}),
        expect.not.objectContaining({source: expect.anything()})
    ]));
});

test("generate mappings - flat identity fields for pre-11.1.1 schema (v11.0.00-CR03)", () => {
    const output = graphman("mappings",
        "--input", "samples/cluster-properties.json",
        "--mappings.action", "IGNORE",
        "--mappings.level", "2",
        "--options.schema", "v11.0.00-CR03");

    expect(output.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({action: "IGNORE", name: "greetings"}),
        expect.not.objectContaining({source: expect.anything()})
    ]));
});

test("generate mappings - nested source for v11.1.1", () => {
    const output = graphman("mappings",
        "--input", "samples/cluster-properties.json",
        "--mappings.action", "IGNORE",
        "--mappings.level", "2",
        "--options.schema", "v11.1.1");

    expect(output.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({action: "IGNORE", source: {name: "greetings"}})
    ]));
});

test("generate mappings - nested source for the default schema", () => {
    const output = graphman("mappings",
        "--input", "samples/cluster-properties.json",
        "--mappings.action", "IGNORE",
        "--mappings.level", "2");

    expect(output.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({action: "IGNORE", source: {name: "greetings"}})
    ]));
});
