// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const fs = require("fs");
const tUtils = require("./utils");
const graphmanModule = tUtils.load("graphman");
const utils = tUtils.load("graphman-utils");
const importOperation = tUtils.load("graphman-operation-import");

const run = (...args) => tUtils.graphmanWithInput("", ...args);

describe("failures exit with a non-zero code", () => {
    test("unsupported operation", () => {
        const result = run("unknown-operation");

        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain("unsupported operation: unknown-operation");
    });

    test("unknown gateway profile", () => {
        const result = run("export", "--query", "services:summary", "--gateway", "unknown-gateway");

        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain("unknown-gateway gateway details are missing");
    });

    test("missing input file", () => {
        const result = run("import", "--input", "samples/does-not-exist.json", "--gateway", "target-gateway");

        expect(result.status).toBe(1);
    });

    test("parameter with an invalid type", () => {
        expect(run("diff", "--input-source", "a.json", "--input-target", "b.json", "--options.includeInserts", "maybe").status).toBe(1);
    });

    test("successful operation exits with zero", () => {
        expect(run("version").status).toBe(0);
    });
});

describe("invalid values exit with a non-zero code", () => {
    const dir = tUtils.config().workspace;
    const bundle = dir + "/exit-codes-bundle.json";

    beforeAll(() => {
        fs.mkdirSync(dir, {recursive: true});
        fs.writeFileSync(bundle, JSON.stringify({clusterProperties: [{name: "cwp", value: "1", checksum: "a"}]}));
    });

    test("--options.scope with an unknown value", () => {
        const result = run("diff", "--input-source", bundle, "--input-target", bundle, "--options.scope", "Full");

        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain("expected one of auto, full");
    });

    test("--options.deleteScope with an unknown value", () => {
        const result = run("diff", "--input-source", bundle, "--input-target", bundle, "--options.deleteScope", "ALL");

        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain("expected one of source, all");
    });

    test("ignore filter without any criteria", () => {
        const filters = dir + "/exit-codes-ignore-filters.json";
        fs.writeFileSync(filters, JSON.stringify({clusterProperties: {}}));

        const result = run("diff", "--input-source", bundle, "--input-target", bundle, "--input-ignore-filters", filters);

        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain("at least one field criteria");
    });

    test("unknown query mode", () => {
        const result = run("describe", "--query", "services:sumary");

        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain("unknown query mode or field 'sumary'");
    });

    test("predefined query in a composite", () => {
        const result = run("describe", "--queries", "services", "sysinfo");

        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain("'sysinfo' is a predefined query/mutation");
    });
});

describe("an unreachable gateway is reported", () => {
    let savedExitCode;

    beforeEach(() => {
        savedExitCode = process.exitCode;
        process.exitCode = undefined;
    });

    afterEach(() => {
        process.exitCode = savedExitCode;
    });

    test("the request error sets the exit code and never calls back", done => {
        const callback = jest.fn();
        utils.extensions([]);

        graphmanModule.invoke({
            protocol: "http:", host: "127.0.0.1", hostname: "127.0.0.1", port: 1, path: "/graphman",
            method: "POST", headers: {}, body: {query: "{a}"}
        }, {}, callback);

        setTimeout(() => {
            expect(process.exitCode).toBe(1);
            expect(callback).not.toHaveBeenCalled();
            done();
        }, 1000);
    });
});

describe("import options", () => {
    test("useRefGoids is a known boolean option, off by default", () => {
        expect(importOperation.paramsSchema.options.useRefGoids).toBe("boolean");

        const params = importOperation.initParams({}, {options: {}});
        expect(params.options.useRefGoids).toBe(false);
    });
});
