// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const fs = require("fs");
const tUtils = require("./utils");
const {graphman} = tUtils;

const dir = tUtils.config().workspace;
const sourceFile = dir + "/diff-ignore-source.json";
const targetFile = dir + "/diff-ignore-target.json";
const reportFile = dir + "/diff-ignore.diff-report.json";
const mappingsFile = dir + "/diff-ignore.id-mappings.json";

function write(name, content) {
    const file = dir + "/" + name;
    fs.writeFileSync(file, JSON.stringify(content));
    return file;
}

beforeAll(() => {
    fs.mkdirSync(dir, {recursive: true});
    write("diff-ignore-source.json", {
        clusterProperties: [
            {goid: "s1", name: "cwp-same", value: "1", checksum: "a"},
            {goid: "s2", name: "cluster.new", value: "2", checksum: "b"},
            {goid: "s3", name: "cwp-changed", value: "3", checksum: "c"},
            {goid: "s4", name: "cluster.changed", value: "3", checksum: "c"},
            {goid: "s5", name: "cwp-new", value: "5", checksum: "f"}
        ]
    });
    write("diff-ignore-target.json", {
        clusterProperties: [
            {goid: "t1", name: "cwp-same", value: "1", checksum: "a"},
            {goid: "t3", name: "cwp-changed", value: "9", checksum: "z"},
            {goid: "t4", name: "cluster.changed", value: "9", checksum: "y"},
            {goid: "t6", name: "cluster.extra", value: "4", checksum: "d"},
            {goid: "t7", name: "cwp-extra", value: "4", checksum: "e"}
        ]
    });
});

function diff(...extra) {
    const output = graphman("diff", "--input-source", sourceFile, "--input-target", targetFile,
        "--options.includeDeletes", "true",
        "--output-report", reportFile, "--output-id-mappings", mappingsFile, ...extra);
    return {
        names: (output.clusterProperties || []).map(x => x.name).sort(),
        deleteMappings: ((output.properties || {}).mappings || {}).clusterProperties || [],
        report: JSON.parse(fs.readFileSync(reportFile, "utf8")),
        idMappings: JSON.parse(fs.readFileSync(mappingsFile, "utf8")).mappings
    };
}

test("without ignore filters nothing is ignored", () => {
    const result = diff();
    expect(result.names).toEqual(expect.arrayContaining(["cluster.new", "cluster.changed", "cluster.extra", "cwp-new"]));
    expect(result.report.ignored).toEqual({});
});

test("ignore filters from a file leave matching entities out of the bundle and list them in the report", () => {
    const file = write("diff-ignore-filters.json", {clusterProperties: {name: ["regex", "^cluster[.]"]}});
    const result = diff("--input-ignore-filters", file);

    expect(result.names.filter(x => x.startsWith("cluster."))).toEqual([]);
    expect(result.names).toEqual(expect.arrayContaining(["cwp-new", "cwp-changed", "cwp-extra"]));

    const ignored = result.report.ignored.clusterProperties;
    expect(ignored.map(x => x.name + ":" + x.category).sort()).toEqual([
        "cluster.changed:updates", "cluster.extra:deletes", "cluster.new:inserts"]);
    expect(ignored.every(x => x.rule)).toBe(true);
});

test("goid mappings are still computed for ignored entities", () => {
    const file = write("diff-ignore-filters.json", {clusterProperties: {name: ["regex", "^cluster[.]"]}});
    const result = diff("--input-ignore-filters", file);
    expect(result.idMappings.goids).toEqual(expect.arrayContaining([{source: "s4", target: "t4"}]));
});

test("ignore filters from the command line", () => {
    const result = diff("--ignore-filter.clusterProperties.name", "eq%", "cwp-");
    expect(result.names.filter(x => x.startsWith("cwp-"))).toEqual([]);
    expect(result.names).toEqual(expect.arrayContaining(["cluster.new", "cluster.changed", "cluster.extra"]));
});

test("fields of a filter are and-ed, filters of a section are or-ed", () => {
    const file = write("diff-ignore-filters.json", {
        clusterProperties: [{name: ["regex", "^cluster"], value: "9"}, {name: "cwp-new"}]
    });
    const result = diff("--input-ignore-filters", file);

    // cluster.changed matches on the target value; cluster.new / cluster.extra do not satisfy both fields
    expect(result.names).not.toContain("cluster.changed");
    expect(result.names).not.toContain("cwp-new");
    expect(result.names).toEqual(expect.arrayContaining(["cluster.new", "cluster.extra"]));
});

test("file and command line filters are combined", () => {
    const file = write("diff-ignore-filters.json", {clusterProperties: {name: "cwp-new"}});
    const result = diff("--input-ignore-filters", file, "--ignore-filter.clusterProperties.name", "eq", "cwp-extra");
    expect(result.names).not.toContain("cwp-new");
    expect(result.names).not.toContain("cwp-extra");
    expect(result.names).toContain("cluster.new");
});
