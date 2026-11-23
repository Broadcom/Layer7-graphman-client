// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

// Regression tests: export, import and renew operations keep working as before, irrespective of
// the gateway (the gateway invocation is stubbed to return canned responses).

const fs = require("fs");
const path = require("path");
const tUtils = require("./utils");
const graphman = tUtils.load("graphman");
const utils = tUtils.load("graphman-utils");
const parser = tUtils.load("args-parser");

const exporter = tUtils.load("graphman-operation-export");
const importer = tUtils.load("graphman-operation-import");
const renewer = tUtils.load("graphman-operation-renew");

const workspace = tUtils.config().workspace;
let requests;
let responder;
let invokeSpy;
let savedMutations;
let savedExitCode;

function run(operation, ...args) {
    const config = graphman.configuration();
    const params = operation.initParams(parser.parse(args), config);
    utils.extensions(config.options.extensions);
    operation.run(params);
}

function outputFile(name) {
    return path.join(workspace, name);
}

function readOutput(name) {
    return JSON.parse(fs.readFileSync(outputFile(name), "utf8"));
}

function writeBundle(name, bundle) {
    fs.writeFileSync(outputFile(name), JSON.stringify(bundle));
    return outputFile(name);
}

beforeAll(() => {
    fs.mkdirSync(workspace, {recursive: true});
    graphman.init(tUtils.config().home, {options: {schema: tUtils.config().schemaVersion}});
});

beforeEach(() => {
    requests = [];
    responder = () => ({data: {}});
    savedExitCode = process.exitCode;
    invokeSpy = jest.spyOn(graphman, "invoke").mockImplementation((request, opContext, callback) => {
        requests.push(request);
        callback(responder(request), null, opContext);
    });

    const gateways = graphman.configuration().gateways;
    if (!gateways["target-gateway"]) gateways["target-gateway"] = Object.assign({}, gateways["default"]);
    savedMutations = gateways["target-gateway"].allowMutations;
    gateways["target-gateway"].allowMutations = true;
});

afterEach(() => {
    invokeSpy.mockRestore();
    graphman.configuration().gateways["target-gateway"].allowMutations = savedMutations;
    process.exitCode = savedExitCode;
});

describe("export", () => {
    const exported = () => ({
        data: {
            clusterProperties: [
                {goid: "2", name: "cwp-b", value: "2", checksum: "b"},
                {goid: "1", name: "cwp-a", value: "1", checksum: "a"},
                {goid: "1", name: "cwp-a", value: "1", checksum: "a"}
            ],
            folders: [{goid: "3", path: "/apis", name: "apis", checksum: "f"}]
        }
    });

    test("uses the 'all' query of the default gateway by default", () => {
        responder = exported;
        run(exporter, "--output", outputFile("export-default.json"));

        expect(requests).toHaveLength(1);
        expect(requests[0].body.query).toMatch(/^query all\b/);
        expect(requests[0].method).toBe("POST");
        expect(requests[0].path).toContain("/graphman");
    });

    test("writes the sorted bundle without the duplicates", () => {
        responder = exported;
        run(exporter, "--output", outputFile("export-sorted.json"));

        const bundle = readOutput("export-sorted.json");
        expect(bundle.clusterProperties.map(item => item.name)).toEqual(["cwp-a", "cwp-b"]);
        expect(bundle.folders).toHaveLength(1);
    });

    test("sends the query variables", () => {
        responder = exported;
        run(exporter, "--using", "policyByName", "--variables.name", "my-policy", "--output", outputFile("export-variables.json"));

        expect(requests[0].body.query).toContain("policyByName(name: $name)");
        expect(requests[0].body.variables.name).toBe("my-policy");
    });

    test("a summary query selects the summary fields only", () => {
        responder = exported;
        run(exporter, "--using", "clusterProperties:summary", "--output", outputFile("export-summary.json"));

        expect(requests[0].body.query).toMatch(/^query clusterProperties\b/);
        expect(requests[0].body.query).not.toContain("description");
    });

    test("--using is still accepted, along with --query (the alias added by the standard-mutations release)", () => {
        responder = exported;
        run(exporter, "--using", "clusterProperties", "--output", outputFile("export-using.json"));
        run(exporter, "--query", "clusterProperties", "--output", outputFile("export-query.json"));

        expect(requests.map(request => request.body.query)).toEqual([requests[0].body.query, requests[0].body.query]);
    });

    test("the legacy filter is applied to the exported entities", () => {
        responder = exported;
        run(exporter, "--filter.by", "name", "--filter.startsWith", "cwp-a", "--output", outputFile("export-filter.json"));

        const bundle = readOutput("export-filter.json");
        expect(bundle.clusterProperties.map(item => item.name)).toEqual(["cwp-a"]);
        expect(bundle.folders).toBeUndefined();
    });

    test("the section level filter is applied to the exported entities (supported by the enhanced filter)", () => {
        responder = exported;
        run(exporter, "--filter.clusterProperties.name", "eq", "cwp-b", "--output", outputFile("export-section-filter.json"));

        const bundle = readOutput("export-section-filter.json");
        expect(bundle.clusterProperties.map(item => item.name)).toEqual(["cwp-b"]);
        expect(bundle.folders).toHaveLength(1);
    });

    test("nothing is written when the gateway returns no data", () => {
        responder = () => ({errors: [{message: "boom"}]});
        fs.rmSync(outputFile("export-nodata.json"), {force: true});
        run(exporter, "--output", outputFile("export-nodata.json"));

        expect(fs.existsSync(outputFile("export-nodata.json"))).toBe(false);
    });

    test("a mutation is not exported", () => {
        expect(() => run(exporter, "--using", "install-bundle", "--output", outputFile("export-mutation.json"))).toThrow(/export operation/);
        expect(requests).toHaveLength(0);
    });

    test("an unknown gateway profile is reported", () => {
        expect(() => run(exporter, "--gateway", "unknown-gateway")).toThrow(/unknown-gateway gateway details are missing/);
    });
});

describe("import", () => {
    const bundleFile = () => writeBundle("import-bundle.json", {
        clusterProperties: [
            {goid: "1", name: "cwp-a", value: "1", checksum: "a"},
            {goid: "2", name: "cwp-b", value: "2", checksum: "b"}
        ]
    });

    const response = () => ({
        data: {
            setClusterProperties: {detailedStatus: [{status: "CREATED", description: "ok"}]},
            setFolders: {detailedStatus: []}
        }
    });

    test("uses the install-bundle mutation by default", () => {
        responder = response;
        run(importer, "--input", bundleFile(), "--gateway", "target-gateway", "--output", outputFile("import-default.json"));

        expect(requests).toHaveLength(1);
        expect(requests[0].body.query).toMatch(/^mutation installBundle\b/);
        expect(requests[0].body.variables.clusterProperties.map(item => item.name)).toEqual(["cwp-a", "cwp-b"]);
        expect(requests[0].body.variables.properties).toBeDefined();
    });

    test("the mutation result is written, without the empty statuses", () => {
        responder = response;
        run(importer, "--input", bundleFile(), "--gateway", "target-gateway", "--output", outputFile("import-result.json"));

        const result = readOutput("import-result.json");
        expect(result.data.setClusterProperties.detailedStatus).toHaveLength(1);
        expect(result.data.setFolders).toBeUndefined();
    });

    test("--using is still accepted", () => {
        responder = response;
        run(importer, "--using", "install-bundle", "--input", bundleFile(), "--gateway", "target-gateway",
            "--output", outputFile("import-using.json"));

        expect(requests[0].body.query).toMatch(/^mutation installBundle\b/);
    });

    test("delete-bundle deletes the entities by default", () => {
        responder = response;
        run(importer, "--using", "delete-bundle", "--input", bundleFile(), "--gateway", "target-gateway",
            "--output", outputFile("import-delete.json"));

        expect(requests[0].body.query).toMatch(/^mutation deleteBundle\b/);
        expect(requests[0].body.variables.properties.defaultAction).toBe("DELETE");
    });

    test("the bundle default action is overridden using the options", () => {
        responder = response;
        run(importer, "--input", bundleFile(), "--gateway", "target-gateway",
            "--options.bundleDefaultAction", "NEW_OR_EXISTING", "--output", outputFile("import-action.json"));

        expect(requests[0].body.variables.properties.defaultAction).toBe("NEW_OR_EXISTING");
    });

    test("the goids are excluded using the options", () => {
        responder = response;
        run(importer, "--input", bundleFile(), "--gateway", "target-gateway",
            "--options.excludeGoids", "--output", outputFile("import-nogoids.json"));

        requests[0].body.variables.clusterProperties.forEach(item => expect(item.goid).toBeUndefined());
    });

    test("the request level options are sent as the query string", () => {
        responder = response;
        run(importer, "--input", bundleFile(), "--gateway", "target-gateway",
            "--options.comment", "hello", "--options.forceDelete", "true", "--output", outputFile("import-qs.json"));

        expect(requests[0].path).toContain("comment=hello");
        expect(requests[0].path).toContain("forceDelete=true");
    });

    test("the variables take precedence over the input bundle (--variables.<name>.+ notation is supported by the standard-mutations release)", () => {
        responder = response;
        run(importer, "--input", bundleFile(), "--gateway", "target-gateway",
            "--variables.clusterProperties.+.name", "cwp-z", "--output", outputFile("import-variables.json"));

        expect(requests[0].body.variables.clusterProperties.map(item => item.name)).toEqual(["cwp-z"]);
    });

    test("the gateway not opted for mutations is left alone", () => {
        graphman.configuration().gateways["target-gateway"].allowMutations = false;
        run(importer, "--input", bundleFile(), "--gateway", "target-gateway");

        expect(requests).toHaveLength(0);
    });

    test("the input is required", () => {
        expect(() => run(importer, "--gateway", "target-gateway")).toThrow(/--input/);
    });

    test("a query is not imported", () => {
        expect(() => run(importer, "--using", "all", "--input", bundleFile(), "--gateway", "target-gateway"))
            .toThrow(/query/);
        expect(requests).toHaveLength(0);
    });
});

describe("renew", () => {
    const bundleFile = () => writeBundle("renew-bundle.json", {
        clusterProperties: [
            {goid: "1", name: "cwp-a", value: "old-1", checksum: "a"},
            {goid: "2", name: "cwp-b", value: "old-2", checksum: "b"}
        ],
        folders: [{goid: "3", path: "/apis", checksum: "f"}]
    });

    const renewed = () => ({
        data: {
            e1: {goid: "1", name: "cwp-a", value: "new-1", checksum: "a2"},
            e2: {goid: "2", name: "cwp-b", value: "new-2", checksum: "b2"}
        }
    });

    function runRenew(output, ...extra) {
        run(renewer, "--input", bundleFile(), "--gateway", "default", "--output", outputFile(output), ...extra);
        return new Promise(resolve => setTimeout(resolve, 200)).then(() => readOutput(output));
    }

    test("the entities of the bundle are renewed from the gateway", async () => {
        responder = request => request.body.query.includes("clusterProperty") ? renewed() : {data: {f1: {goid: "3", path: "/apis", checksum: "f2"}}};
        const bundle = await runRenew("renew-all.json");

        expect(bundle.clusterProperties.map(item => item.value)).toEqual(["new-1", "new-2"]);
        expect(bundle.folders[0].checksum).toBe("f2");
    });

    test("one query per entity type is made", async () => {
        responder = request => request.body.query.includes("clusterProperty") ? renewed() : {data: {f1: {goid: "3", path: "/apis"}}};
        await runRenew("renew-queries.json");

        expect(requests).toHaveLength(2);
        const clusterQuery = requests.find(request => request.body.query.includes("clusterProperty")).body;
        expect(clusterQuery.variables).toMatchObject({name1: "cwp-a", name2: "cwp-b"});
    });

    test("only the requested sections are renewed", async () => {
        responder = renewed;
        const bundle = await runRenew("renew-sections.json", "--sections", "clusterProperties");

        expect(requests).toHaveLength(1);
        expect(bundle.clusterProperties.map(item => item.value)).toEqual(["new-1", "new-2"]);
        expect(bundle.folders).toEqual([{goid: "3", path: "/apis", checksum: "f"}]);
    });

    test("a failure of the gateway is reported with a non-zero exit code", async () => {
        responder = () => ({errors: [{message: "boom"}]});
        process.exitCode = undefined;
        fs.rmSync(outputFile("renew-failure.json"), {force: true});
        run(renewer, "--input", bundleFile(), "--gateway", "default", "--output", outputFile("renew-failure.json"));
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(process.exitCode).toBe(1);
        expect(fs.existsSync(outputFile("renew-failure.json"))).toBe(false);
    });

    test("the gateway is required", () => {
        expect(() => run(renewer, "--input", bundleFile())).toThrow(/--gateway parameter is missing/);
    });

    test("an unknown gateway profile is reported", () => {
        expect(() => run(renewer, "--input", bundleFile(), "--gateway", "unknown-gateway"))
            .toThrow(/unknown-gateway gateway details are missing/);
    });
});
