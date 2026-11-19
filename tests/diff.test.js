// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

test("generate diff bundle using existing report - with default options", () => {
    const output = graphman("diff",
        "--input-report", "samples/diff-report.sample.json");

    expect(output.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "cwp-new-1"}),
        expect.objectContaining({name: "cwp-new-2"}),
        expect.objectContaining({name: "cwp-modified-1"}),
        expect.objectContaining({name: "cwp-modified-2"}),
        expect.not.objectContaining({name: "cwp-delete-1"}),
        expect.not.objectContaining({name: "cwp-delete-2"})
    ]));

    expect(output.policies).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "policy-new-1"})
    ]));

    expect(output.services).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "service-new-1"}),
        expect.objectContaining({name: "service-modified-1"}),
        expect.not.objectContaining({name: "service-delete-1"})
    ]));

    expect(output.trustedCerts).toBeUndefined();
});

test("generate diff bundle using existing report - with includeInserts only option", () => {
    const output = graphman("diff",
        "--input-report", "samples/diff-report.sample.json",
        "--options.includeInserts", "true",
        "--options.includeUpdates",  "false");

    expect(output.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "cwp-new-1"}),
        expect.objectContaining({name: "cwp-new-2"}),
        expect.not.objectContaining({name: "cwp-modified-1"}),
        expect.not.objectContaining({name: "cwp-modified-2"}),
        expect.not.objectContaining({name: "cwp-delete-1"}),
        expect.not.objectContaining({name: "cwp-delete-2"})
    ]));

    expect(output.policies).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "policy-new-1"})
    ]));

    expect(output.services).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "service-new-1"}),
        expect.not.objectContaining({name: "service-modified-1"}),
        expect.not.objectContaining({name: "service-delete-1"})
    ]));

    expect(output.trustedCerts).toBeUndefined();
});

test("generate diff bundle using existing report - with includeUpdates only option", () => {
    const output = graphman("diff",
        "--input-report", "samples/diff-report.sample.json",
        "--options.includeInserts", "false",
        "--options.includeUpdates", "true");

    expect(output.clusterProperties).toEqual(expect.arrayContaining([
        expect.not.objectContaining({name: "cwp-new-1"}),
        expect.not.objectContaining({name: "cwp-new-2"}),
        expect.objectContaining({name: "cwp-modified-1"}),
        expect.objectContaining({name: "cwp-modified-2"}),
        expect.not.objectContaining({name: "cwp-delete-1"}),
        expect.not.objectContaining({name: "cwp-delete-2"})
    ]));

    expect(output.policies).toBeUndefined();

    expect(output.services).toEqual(expect.arrayContaining([
        expect.not.objectContaining({name: "service-new-1"}),
        expect.objectContaining({name: "service-modified-1"}),
        expect.not.objectContaining({name: "service-delete-1"})
    ]));

    expect(output.trustedCerts).toBeUndefined();
});

test("generate diff bundle using existing report - with includeDeletes only options", () => {
    const output = graphman("diff",
        "--input-report", "samples/diff-report.sample.json",
        "--options.includeInserts", "false",
        "--options.includeUpdates", "false",
        "--options.includeDeletes", "true");

    expect(output.clusterProperties).toEqual(expect.arrayContaining([
        expect.not.objectContaining({name: "cwp-new-1"}),
        expect.not.objectContaining({name: "cwp-new-2"}),
        expect.not.objectContaining({name: "cwp-modified-1"}),
        expect.not.objectContaining({name: "cwp-modified-2"}),
        expect.objectContaining({name: "cwp-delete-1"}),
        expect.objectContaining({name: "cwp-delete-2"})
    ]));

    expect(output.policies).toBeUndefined();

    expect(output.services).toEqual(expect.arrayContaining([
        expect.not.objectContaining({name: "service-new-1"}),
        expect.not.objectContaining({name: "service-modified-1"}),
        expect.objectContaining({name: "service-delete-1"})
    ]));

    expect(output.trustedCerts).toEqual(expect.arrayContaining([
        expect.objectContaining({name: "cert-delete-1"})
    ]));

    expect(output.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({action: "DELETE", source: {name: "cwp-delete-1"}}),
        expect.objectContaining({action: "DELETE", source: {name: "cwp-delete-2"}}),
        expect.not.objectContaining({nodef: expect.anything()})
    ]));

    expect(output.properties.mappings.services).toEqual(expect.arrayContaining([
        expect.objectContaining({action: "DELETE", source: {resolutionPath: "/service-delete-1", serviceType: "WEB_API"}}),
        expect.not.objectContaining({nodef: expect.anything()})
    ]));

    expect(output.properties.mappings.trustedCerts).toEqual(expect.arrayContaining([
        expect.objectContaining({action: "DELETE", source: {thumbprint: "MXAEyUit8a29J+JDoWfGY6lam34="}}),
        expect.not.objectContaining({nodef: expect.anything()})
    ]));
});

test("generate diff bundle using existing report - with includeDeletes only  and useNoDefMappings options", () => {
    const output = graphman("diff",
        "--input-report", "samples/diff-report.sample.json",
        "--options.includeInserts", "false",
        "--options.includeUpdates", "false",
        "--options.includeDeletes",
        "--options.useNoDefMappings");

    expect(output.clusterProperties).toBeUndefined();
    expect(output.policies).toBeUndefined();
    expect(output.services).toBeUndefined();
    expect(output.trustedCerts).toBeUndefined();

    expect(output.properties.mappings.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({nodef: true, action: "DELETE", source: {name: "cwp-delete-1"}}),
        expect.objectContaining({nodef: true, action: "DELETE", source: {name: "cwp-delete-2"}})
    ]));

    expect(output.properties.mappings.services).toEqual(expect.arrayContaining([
        expect.objectContaining({nodef: true, action: "DELETE", source: {resolutionPath: "/service-delete-1", serviceType: "WEB_API"}})
    ]));

    expect(output.properties.mappings.trustedCerts).toEqual(expect.arrayContaining([
        expect.objectContaining({nodef: true, action: "DELETE", source: {thumbprint: "MXAEyUit8a29J+JDoWfGY6lam34="}})
    ]));
});