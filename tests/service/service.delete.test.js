// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/service/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).services;
const entityByResolutionPath = resolutionPath => sampleEntities.find(entity => entity.resolutionPath === resolutionPath);

function expectServiceDeleted(entity) {
    const output = graphman("export", "--using", "serviceByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.services).toBeUndefined();
}

function expectServiceNotDeleted(entity) {
    const output = graphman("export", "--using", "serviceByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.services).toEqual(expect.arrayContaining([
        expect.objectContaining({goid: entity.goid})
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete service using input.ref.goid", () => {
    const entity = entityByResolutionPath("/some-web-api-3");

    const output = graphman("import",
        "--using", "deleteServices",
        "--variables.services.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteServices.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectServiceDeleted(entity);
});

test("delete services using resolutionPath and serviceType (with and without ref) - with test option", () => {
    const entity1 = entityByResolutionPath("/some-web-api");
    const entity2 = entityByResolutionPath("/some-web-api-2");

    const output = graphman("import",
        "--using", "deleteServices",
        "--variables.services.+.ref.resolutionPath", entity1.resolutionPath,
        "--variables.services.ref.serviceType", entity1.serviceType,
        "--variables.services.+.resolutionPath", entity2.resolutionPath,
        "--variables.services.serviceType", entity2.serviceType,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteServices.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectServiceNotDeleted(entity1);
    expectServiceNotDeleted(entity2);
});

test("delete services using resolutionPath and serviceType (with and without ref) - without test option", () => {
    const entity1 = entityByResolutionPath("/some-web-api");
    const entity2 = entityByResolutionPath("/some-web-api-2");

    const output = graphman("import",
        "--using", "deleteServices",
        "--variables.services.+.ref.resolutionPath", entity1.resolutionPath,
        "--variables.services.ref.serviceType", entity1.serviceType,
        "--variables.services.+.resolutionPath", entity2.resolutionPath,
        "--variables.services.serviceType", entity2.serviceType,
        "--gateway", "target-gateway");

    expect(output.data.deleteServices.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectServiceDeleted(entity1);
    expectServiceDeleted(entity2);
});

test("delete service fails when required resolutionPath/serviceType fields are missing", () => {
    const output = graphman("import",
        "--using", "deleteServices",
        "--variables.services.+.checksum", "irrelevant",
        "--gateway", "target-gateway");

    expect(output.data.deleteServices.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete service that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteServices",
        "--variables.services.+.ref.resolutionPath", "/does-not-exist-service",
        "--variables.services.ref.serviceType", "WEB_API",
        "--gateway", "target-gateway");

    expect(output.data.deleteServices.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
