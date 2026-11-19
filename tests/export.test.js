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

test("export cluster properties using --query alias for --using", () => {
    const output = graphman("export", "--gateway", "default",
        "--query", "clusterProperties:summary");

    expect(output["clusterProperties"]).toMatchObject(expect.arrayContaining([{
        goid: expect.any(String),
        name: "cluster.hostname",
        checksum: expect.any(String)
    }]));
});

test("export using deprecated --using still works and warns", () => {
    const output = graphman("export", "--gateway", "default",
        "--using", "clusterProperties:summary");

    expect(output.stdout).toEqual(expect.stringContaining("--using is deprecated, use --query instead"));
    expect(output["clusterProperties"]).toBeDefined();
});

test("export using composite query built from multiple query names", () => {
    const output = graphman("export", "--gateway", "default",
        "--queries", "clusterProperties:summary", "sysinfo");

    expect(output["clusterProperties"]).toMatchObject(expect.arrayContaining([{
        goid: expect.any(String),
        name: "cluster.hostname",
        checksum: expect.any(String)
    }]));
    expect(output["passwordPolicies"]).toBeDefined();
});

test("export composite query auto-disambiguates colliding argument names across queries", () => {
    const output = graphman("export", "--gateway", "default",
        "--queries", "policyByName", "secretByName",
        "--variables.name", "does-not-exist-policy",
        "--variables.name2", "does-not-exist-secret");

    // each query's own $name is resolved independently (policyByName using $name,
    // secretByName using the auto-disambiguated $name2) instead of the old hard
    // "conflicting variable declaration" error or a silently shared single value
    expect(output.stdout).not.toEqual(expect.stringContaining("conflicting variable declaration"));
    expect(output.stdout).not.toEqual(expect.stringContaining("missing variable"));
    expect(output["properties"]).toBeDefined();
});
