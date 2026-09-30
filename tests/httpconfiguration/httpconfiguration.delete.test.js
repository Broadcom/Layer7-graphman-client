// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/httpconfiguration/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).httpConfigurations;
const entityByHost = host => sampleEntities.find(entity => entity.host === host);

function expectHttpConfigurationDeleted(entity) {
    const output = graphman("export", "--using", "httpConfigurationByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.httpConfigurations).toBeUndefined();
}

function expectHttpConfigurationNotDeleted(entity) {
    const output = graphman("export", "--using", "httpConfigurationByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.httpConfigurations).toEqual(expect.arrayContaining([
        expect.objectContaining({
            goid: entity.goid
        })
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete http configuration using input.ref.goid", () => {
    const entity = entityByHost("http-config-custom-1");

    const output = graphman("import",
        "--using", "deleteHttpConfigurations",
        "--variables.httpConfigurations.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteHttpConfigurations.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectHttpConfigurationDeleted(entity);
});

test("delete http configurations using natural key (with and without ref) - with test option", () => {
    const entity1 = entityByHost("http-config-custom-2");
    const entity2 = entityByHost("http-config-custom-3");

    const output = graphman("import",
        "--using", "deleteHttpConfigurations",
        "--variables.httpConfigurations.+.ref.host", entity1.host,
        "--variables.httpConfigurations.ref.port", String(entity1.port),
        "--variables.httpConfigurations.ref.protocol", entity1.protocol,
        "--variables.httpConfigurations.ref.path", entity1.path,
        "--variables.httpConfigurations.+.host", entity2.host,
        "--variables.httpConfigurations.port", String(entity2.port),
        "--variables.httpConfigurations.protocol", entity2.protocol,
        "--variables.httpConfigurations.path", entity2.path,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteHttpConfigurations.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectHttpConfigurationNotDeleted(entity1);
    expectHttpConfigurationNotDeleted(entity2);
});

test("delete http configurations using natural key (with and without ref) - without test option", () => {
    const entity1 = entityByHost("http-config-custom-2");
    const entity2 = entityByHost("http-config-custom-3");

    const output = graphman("import",
        "--using", "deleteHttpConfigurations",
        "--variables.httpConfigurations.+.ref.host", entity1.host,
        "--variables.httpConfigurations.ref.port", String(entity1.port),
        "--variables.httpConfigurations.ref.protocol", entity1.protocol,
        "--variables.httpConfigurations.ref.path", entity1.path,
        "--variables.httpConfigurations.+.host", entity2.host,
        "--variables.httpConfigurations.port", String(entity2.port),
        "--variables.httpConfigurations.protocol", entity2.protocol,
        "--variables.httpConfigurations.path", entity2.path,
        "--gateway", "target-gateway");

    expect(output.data.deleteHttpConfigurations.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectHttpConfigurationDeleted(entity1);
    expectHttpConfigurationDeleted(entity2);
});

test("delete http configuration fails when required identifying field is missing", () => {
    const output = graphman("import",
        "--using", "deleteHttpConfigurations",
        "--variables.httpConfigurations.+.connectTimeout", "300000",
        "--gateway", "target-gateway");

    expect(output.data.deleteHttpConfigurations.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete http configuration that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteHttpConfigurations",
        "--variables.httpConfigurations.+.host", "does-not-exist-http-config",
        "--gateway", "target-gateway");

    expect(output.data.deleteHttpConfigurations.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
