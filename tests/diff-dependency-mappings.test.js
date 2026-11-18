// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const fs = require("fs");
const tUtils = require("./utils");
const {graphman} = tUtils;

const dir = tUtils.config().workspace;
const reportFile = dir + "/diff-deps.diff-report.json";
const mappingsFile = dir + "/diff-deps.id-mappings.json";

function write(name, content) {
    const file = dir + "/" + name;
    fs.writeFileSync(file, JSON.stringify(content));
    return file;
}

function service(policy) {
    return {
        goid: "svc-goid", guid: "svc-guid", name: "svc", resolutionPath: "/svc", serviceType: "WEB_API",
        resolvers: {}, checksum: "s1", policy: policy
    };
}

const CODE = {
    All: [
        {Include: {policyName: "frag-1", policyGuid: "src-frag-guid"}},
        {Encapsulated: {encassName: "encass-1", encassGuid: "src-encass-guid"}},
        {Include: {policyName: "frag-missing", policyGuid: "src-missing-guid"}}
    ]
};

const TARGET = {
    policies: [{goid: "tf", guid: "tgt-frag-guid", name: "frag-1", policyType: "FRAGMENT", checksum: "f"}],
    encassConfigs: [{goid: "te", guid: "tgt-encass-guid", name: "encass-1", checksum: "e"}]
};

function diff(sourceBundle, targetBundle) {
    const source = write("diff-deps-source.json", sourceBundle);
    const target = write("diff-deps-target.json", targetBundle);
    const output = graphman("diff", "--input-source", source, "--input-target", target,
        "--output-report", reportFile, "--output-id-mappings", mappingsFile);
    return {output, guids: JSON.parse(fs.readFileSync(mappingsFile, "utf8")).mappings.guids};
}

beforeAll(() => fs.mkdirSync(dir, {recursive: true}));

test("include and encapsulated references are mapped even when not part of the source bundle", () => {
    const {output, guids} = diff({services: [service({code: CODE})]}, TARGET);

    expect(guids).toEqual(expect.arrayContaining([
        {source: "src-frag-guid", target: "tgt-frag-guid"},
        {source: "src-encass-guid", target: "tgt-encass-guid"}
    ]));
    expect(guids.find(x => x.source === "src-missing-guid")).toBeUndefined();

    const code = JSON.stringify(output.services[0].policy.code);
    expect(code).toContain("tgt-frag-guid");
    expect(code).toContain("tgt-encass-guid");
    expect(code).not.toContain("src-frag-guid");
});

test("policy json is inspected as well", () => {
    const {guids} = diff({services: [service({json: JSON.stringify(CODE)})]}, TARGET);
    expect(guids).toEqual(expect.arrayContaining([{source: "src-frag-guid", target: "tgt-frag-guid"}]));
});

test("a reference is not mapped twice when the fragment is part of both bundles", () => {
    const {guids} = diff({
        services: [service({code: CODE})],
        policies: [{goid: "sf", guid: "src-frag-guid", name: "frag-1", policyType: "FRAGMENT", checksum: "x"}]
    }, TARGET);

    expect(guids.filter(x => x.source === "src-frag-guid")).toEqual([{source: "src-frag-guid", target: "tgt-frag-guid"}]);
});

test("nothing is mapped when the references are already in sync", () => {
    const {guids} = diff({services: [service({code: CODE})]}, {
        policies: [{goid: "tf", guid: "src-frag-guid", name: "frag-1", policyType: "FRAGMENT", checksum: "f"}],
        encassConfigs: [{goid: "te", guid: "src-encass-guid", name: "encass-1", checksum: "e"}]
    });
    expect(guids).toEqual([]);
});
