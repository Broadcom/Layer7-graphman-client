// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const fs = require("fs");
const tUtils = require("./utils");
const {graphman} = tUtils;

const dir = tUtils.config().workspace;
const sourceFile = dir + "/diff-scope-source.json";
const targetFile = dir + "/diff-scope-target.json";

beforeAll(() => {
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(sourceFile, JSON.stringify({
        clusterProperties: [
            {name: "cwp-same", value: "1", checksum: "a"},
            {name: "cwp-new", value: "2", checksum: "b"},
            {name: "cwp-changed", value: "3", checksum: "c"}
        ]
    }));
    fs.writeFileSync(targetFile, JSON.stringify({
        clusterProperties: [
            {name: "cwp-same", value: "1", checksum: "a"},
            {name: "cwp-changed", value: "9", checksum: "z"},
            {name: "cwp-extra", value: "4", checksum: "d"}
        ],
        trustedCerts: [
            {name: "cert-extra", checksum: "e"}
        ]
    }));
});

function diff(...extra) {
    return graphman("diff", "--input-source", sourceFile, "--input-target", targetFile,
        "--options.includeInserts", "false", "--options.includeUpdates", "false",
        "--options.includeDeletes", "true", ...extra);
}

test("deletes are limited to entity types present in the source bundle by default", () => {
    const output = diff();
    expect(output.clusterProperties.map(x => x.name)).toEqual(["cwp-extra"]);
    expect(output.trustedCerts).toBeUndefined();
});

test("deleteScope=all reports deletes for every target entity type", () => {
    const output = diff("--options.deleteScope", "all");
    expect(output.clusterProperties.map(x => x.name)).toEqual(["cwp-extra"]);
    expect(output.trustedCerts.map(x => x.name)).toEqual(["cert-extra"]);
});

test("inserts and updates are identified via keyed matching", () => {
    const output = graphman("diff", "--input-source", sourceFile, "--input-target", targetFile);
    expect(output.clusterProperties.map(x => x.name).sort()).toEqual(["cwp-changed", "cwp-new"]);
});
