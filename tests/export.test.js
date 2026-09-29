// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

test("export entities with unknown query", () => {
    const output = graphman("export",
        "--using", "unknown-query");

    expect(output.stdout).toEqual(expect.stringContaining("unrecognized query unknown-query"));
});

test("export entities with unknown gateway profile", () => {
    const output = graphman("export",
        "--using", "all:summary",
        "--gateway", "unknown-gateway");

    expect(output.stdout).toEqual(expect.stringContaining("unknown-gateway gateway details are missing"));
});

test("try importing few cluster properties using default gateway profile", () => {
    const output  = graphman("import",
        "--input", "samples/cluster-properties.json");
    expect(output.stdout).toEqual(expect.stringContaining("default gateway is not opted for mutations, ignoring the operation"));
});

test("export cluster properties using default gateway profile", () => {
    const output = graphman("export", "--gateway", "default",
        "--using", "clusterProperties:summary");

    expect(output["clusterProperties"]).toMatchObject(expect.arrayContaining([{
        goid: expect.any(String),
        name: "cluster.hostname",
        checksum: expect.any(String)
    }]));
});
