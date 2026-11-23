// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

// Regression tests: diff of two bundles keeps classifying the entities and capturing the id-mappings as before.

const fs = require("fs");
const path = require("path");
const tUtils = require("./utils");
const graphman = tUtils.load("graphman");
const utils = tUtils.load("graphman-utils");
const parser = tUtils.load("args-parser");
const differ = tUtils.load("graphman-operation-diff");

const workspace = path.join(tUtils.config().workspace, "regression-diff");
let counter = 0;

beforeAll(() => {
    fs.mkdirSync(workspace, {recursive: true});
    graphman.init(tUtils.config().home, {options: {schema: tUtils.config().schemaVersion}});
});

function write(name, content) {
    const file = path.join(workspace, name);
    fs.writeFileSync(file, JSON.stringify(content));
    return file;
}

/**
 * Runs the diff of the two bundles, and returns the output bundle, report and id-mappings
 */
async function diff(source, target, options = [], extra = []) {
    const id = ++counter;
    const output = path.join(workspace, `out-${id}.json`);
    const config = graphman.configuration();
    const params = differ.initParams(parser.parse([
        "--input-source", write(`source-${id}.json`, source),
        "--input-target", write(`target-${id}.json`, target),
        "--output", output, ...options, ...extra]), config);
    utils.extensions(config.options.extensions);
    differ.run(params);

    const read = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    for (let i = 0; i < 50 && !fs.existsSync(output); i++) await new Promise(resolve => setTimeout(resolve, 20));

    return {
        bundle: read(output),
        report: read(output.replace(/\.json$/, ".diff-report.json")),
        mappings: read(output.replace(/\.json$/, ".id-mappings.json"))
    };
}

const names = (section) => (section || []).map(item => item.name);

describe("classification of the entities", () => {
    const source = {
        clusterProperties: [
            {goid: "1", name: "cwp-same", value: "1", checksum: "a"},
            {goid: "2", name: "cwp-new", value: "2", checksum: "b"},
            {goid: "3", name: "cwp-changed", value: "30", checksum: "c2"}
        ]
    };

    const target = {
        clusterProperties: [
            {goid: "1", name: "cwp-same", value: "1", checksum: "a"},
            {goid: "3", name: "cwp-changed", value: "3", checksum: "c1"},
            {goid: "4", name: "cwp-extra", value: "4", checksum: "d"}
        ]
    };

    test("inserts, updates and deletes are reported", async () => {
        const result = await diff(source, target, ["--options.includeDeletes", "true"]);

        expect(names(result.report.inserts.clusterProperties)).toEqual(["cwp-new"]);
        expect(names(result.report.updates.clusterProperties)).toEqual(["cwp-changed"]);
        expect(names(result.report.deletes.clusterProperties)).toEqual(["cwp-extra"]);
    });

    test("the details of an update are captured", async () => {
        const result = await diff(source, target);

        const details = result.report.diffs.clusterProperties[0];
        expect(details.name).toBe("cwp-changed");
        expect(details.details.map(item => item.path)).toEqual(expect.arrayContaining(["$.value"]));
    });

    test("the output bundle holds the inserts and updates by default", async () => {
        const result = await diff(source, target);

        expect(names(result.bundle.clusterProperties).sort()).toEqual(["cwp-changed", "cwp-new"]);
    });

    test("the deletes are included in the output bundle on demand, as the delete mappings", async () => {
        const result = await diff(source, target, ["--options.includeDeletes", "true"]);

        expect(result.bundle.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
            expect.objectContaining({action: "DELETE", source: {name: "cwp-extra"}})
        ]));
    });

    test("the inserts and updates can be left out of the output bundle", async () => {
        const inserts = await diff(source, target, ["--options.includeUpdates", "false"]);
        const updates = await diff(source, target, ["--options.includeInserts", "false"]);

        expect(names(inserts.bundle.clusterProperties)).toEqual(["cwp-new"]);
        expect(names(updates.bundle.clusterProperties)).toEqual(["cwp-changed"]);
    });

    test("nodef mappings are used for the deletes on demand", async () => {
        const result = await diff(source, target, ["--options.includeDeletes", "true", "--options.useNoDefMappings", "true"]);

        expect(result.bundle.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
            expect.objectContaining({action: "DELETE", nodef: true})
        ]));
    });

    test("identical bundles have no differences", async () => {
        const result = await diff(source, source, ["--options.includeDeletes", "true"]);

        expect(result.report.inserts).toEqual({});
        expect(result.report.updates).toEqual({});
        expect(result.report.deletes).toEqual({});
    });
});

describe("the checksum comparison", () => {
    test("a different checksum with the same content is not an update", async () => {
        const result = await diff(
            {clusterProperties: [{goid: "1", name: "cwp", value: "1", checksum: "a"}]},
            {clusterProperties: [{goid: "1", name: "cwp", value: "1", checksum: "b"}]});

        expect(result.report.updates).toEqual({});
    });

    test("a target entity without the checksum is ignored", async () => {
        const result = await diff(
            {clusterProperties: [{goid: "1", name: "cwp", value: "1", checksum: "a"}]},
            {clusterProperties: [{goid: "1", name: "cwp", value: "2"}]});

        expect(result.report.updates).toEqual({});
        expect(result.report.inserts).toEqual({});
    });

    test("a source entity without the checksum is compared by the content", async () => {
        const result = await diff(
            {clusterProperties: [{goid: "1", name: "cwp", value: "2"}]},
            {clusterProperties: [{goid: "1", name: "cwp", value: "1", checksum: "a"}]});

        expect(names(result.report.updates.clusterProperties)).toEqual(["cwp"]);
    });
});

describe("the entity matching", () => {
    test("the entities are matched by the identity fields", async () => {
        const result = await diff(
            {clusterProperties: [{goid: "9", name: "cwp", value: "1", checksum: "a"}]},
            {clusterProperties: [{goid: "1", name: "cwp", value: "1", checksum: "a"}]});

        expect(result.report.inserts).toEqual({});
        expect(result.report.updates).toEqual({});
    });

    test("the entities having multiple identity fields are matched by all of them", async () => {
        const result = await diff(
            {keys: [{keystoreId: "00", alias: "k1", checksum: "a"}, {keystoreId: "01", alias: "k2", checksum: "b"}]},
            {keys: [{keystoreId: "00", alias: "k1", checksum: "a"}, {keystoreId: "00", alias: "k2", checksum: "b"}]},
            ["--options.includeDeletes", "true"]);

        expect(result.report.inserts.keys.map(item => item.alias)).toEqual(["k2"]);
        expect(result.report.inserts.keys[0].keystoreId).toBe("01");
        expect(result.report.deletes.keys.map(item => item.keystoreId)).toEqual(["00"]);
    });
});

describe("the id-mappings", () => {
    test("goid mappings are captured when the goids of the matching entities differ", async () => {
        const result = await diff(
            {clusterProperties: [{goid: "1", name: "cwp", value: "1", checksum: "a"}]},
            {clusterProperties: [{goid: "9", name: "cwp", value: "1", checksum: "a"}]});

        expect(result.mappings.mappings.goids).toEqual([{source: "1", target: "9"}]);
        expect(result.mappings.mappings.guids).toEqual([]);
    });

    test("guid mappings are captured when the guids of the matching entities differ", async () => {
        const result = await diff(
            {policyFragments: [{goid: "1", guid: "g-1", name: "frag", checksum: "a"}]},
            {policyFragments: [{goid: "1", guid: "g-2", name: "frag", checksum: "a"}]});

        expect(result.mappings.mappings.guids).toEqual([{source: "g-1", target: "g-2"}]);
        expect(result.mappings.mappings.goids).toEqual([]);
    });

    test("no mappings are captured when the ids are same", async () => {
        const bundle = {clusterProperties: [{goid: "1", name: "cwp", value: "1", checksum: "a"}]};
        const result = await diff(bundle, bundle);

        expect(result.mappings.mappings).toEqual({goids: [], guids: []});
    });

    test("the input mappings match the differently named entities", async () => {
        const mappings = write("input-mappings.json", {
            mappings: {clusterProperties: [{source: {name: "regex:^cwp-src"}, target: {name: "cwp-tgt"}}]}
        });

        const result = await diff(
            {clusterProperties: [{goid: "1", name: "cwp-src-1", value: "1", checksum: "a"}]},
            {clusterProperties: [{goid: "7", name: "cwp-tgt", value: "1", checksum: "a"}]},
            [], ["--input-mappings", mappings]);

        expect(result.mappings.mappings.goids).toEqual([{source: "1", target: "7"}]);
    });
});

describe("the diff report", () => {
    test("is the input of the diff bundle generation", async () => {
        const source = {clusterProperties: [{goid: "1", name: "cwp-new", value: "1", checksum: "a"}]};
        const first = await diff(source, {clusterProperties: []});

        const report = write("report.json", first.report);
        const output = path.join(workspace, "from-report.json");
        const params = differ.initParams(parser.parse(["--input-report", report, "--output", output]), graphman.configuration());
        differ.run(params);

        expect(names(JSON.parse(fs.readFileSync(output, "utf8")).clusterProperties)).toEqual(["cwp-new"]);
    });

    test("not enough input parameters are reported", () => {
        const params = differ.initParams(parser.parse(["--input-source", "a.json"]), graphman.configuration());

        expect(() => differ.run(params)).toThrow(/not enough input parameters/);
    });
});
