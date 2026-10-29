// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphmanWithInput} = tUtils;
const fs = require('fs');
const path = require('path');
const workspace = tUtils.config().workspace;

function createTestBundle(filename, content) {
    if (!fs.existsSync(workspace)) {
        fs.mkdirSync(workspace, {recursive: true});
    }

    const filepath = path.join(workspace, filename);
    fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    return filepath;
}

const BUNDLE = {
    clusterProperties: [{name: "zz-prop", value: "1"}, {name: "aa-prop", value: "2"}],
    services: [{name: "Service1", resolutionPath: "/service1"}]
};

describe("standard input support", () => {

    test("revise should read the bundle from the standard input", () => {
        const output = graphmanWithInput(JSON.stringify(BUNDLE),
            "revise", "--input", "-", "--options.logSink", "stderr");

        expect(output.status).toBe(0);

        const bundle = JSON.parse(output.stdout);
        expect(bundle.clusterProperties).toHaveLength(2);
        expect(bundle.services).toHaveLength(1);
    });

    test("slice should read the bundle from the standard input", () => {
        const output = graphmanWithInput(JSON.stringify(BUNDLE),
            "slice", "--input", "-", "--sections", "clusterProperties", "--options.logSink", "stderr");

        expect(output.status).toBe(0);

        const bundle = JSON.parse(output.stdout);
        expect(bundle.clusterProperties).toHaveLength(2);
        expect(bundle.services).toBeUndefined();
    });

    test("combine should merge the standard input with a file bundle", () => {
        const bundleFile = createTestBundle("stdin-combine.json", {
            clusterProperties: [{name: "from-file", value: "F"}]
        });

        const output = graphmanWithInput(JSON.stringify({clusterProperties: [{name: "from-stdin", value: "S"}]}),
            "combine", "--inputs", "-", bundleFile, "--options.logSink", "stderr");

        expect(output.status).toBe(0);

        const bundle = JSON.parse(output.stdout);
        expect(bundle.clusterProperties).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "from-stdin"}),
            expect.objectContaining({name: "from-file"})
        ]));
    });

    test("validate should read the bundle from the standard input", () => {
        const output = graphmanWithInput(JSON.stringify(BUNDLE), "validate", "--input", "-");

        expect(output.status).toBe(0);
        expect(output.stdout).not.toContain("[error]");
    });

    test("operations should be pipeable, with the logs kept off the standard output", () => {
        const sliced = graphmanWithInput(JSON.stringify(BUNDLE),
            "slice", "--input", "-", "--sections", "clusterProperties", "--options.logSink", "stderr");
        const revised = graphmanWithInput(sliced.stdout,
            "revise", "--input", "-", "--options.logSink", "stderr");

        expect(revised.status).toBe(0);
        expect(revised.stderr).toContain("[info]");

        const bundle = JSON.parse(revised.stdout);
        expect(bundle.clusterProperties).toHaveLength(2);
        expect(bundle.services).toBeUndefined();
    });

    test("standard input should be readable only once", () => {
        const output = graphmanWithInput(JSON.stringify(BUNDLE),
            "combine", "--inputs", "-", "-", "--options.logSink", "stderr");

        expect(output.stderr).toContain("standard input is already consumed");
    });

    test("should report a friendly error when nothing is piped in", () => {
        const output = graphmanWithInput("", "revise", "--input", "-", "--options.logSink", "stderr");

        expect(output.stderr).toContain("no data piped to the standard input");
    });

    test("should report a friendly error when the standard input is not json", () => {
        const output = graphmanWithInput("not a bundle",
            "revise", "--input", "-", "--options.logSink", "stderr");

        expect(output.stderr).toContain("standard input is not a valid json bundle");
    });

    test("logs should stay on the standard output by default", () => {
        const output = graphmanWithInput(JSON.stringify(BUNDLE), "revise", "--input", "-");

        expect(output.status).toBe(0);
        expect(output.stdout).toContain("[info]");
        expect(output.stderr).not.toContain("[info]");
    });
});
