// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/activeconnector/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).activeConnectors;
const entityByName = name => sampleEntities.find(entity => entity.name === name);

function expectActiveConnectorDeleted(entity) {
    const output = graphman("export", "--using", "activeConnectorByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.activeConnectors).toBeUndefined();
}

function expectActiveConnectorNotDeleted(entity) {
    const output = graphman("export", "--using", "activeConnectorByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.activeConnectors).toEqual(expect.arrayContaining([
        expect.objectContaining({
            goid: entity.goid
        })
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete active connector using input.ref.goid", () => {
    const entity = entityByName("mq-inbound-customize-1");

    const output = graphman("import",
        "--using", "deleteActiveConnectors",
        "--variables.activeConnectors.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteActiveConnectors.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectActiveConnectorDeleted(entity);
});

test("delete active connectors using names (with and without ref) - with test option", () => {
    const entity1 = entityByName("mq-outbound-customized-2");
    const entity2 = entityByName("mq-outbound-customized-3");

    const output = graphman("import",
        "--using", "deleteActiveConnectors",
        "--variables.activeConnectors.+.ref.name", entity1.name,
        "--variables.activeConnectors.+.name", entity2.name,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteActiveConnectors.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectActiveConnectorNotDeleted(entity1);
    expectActiveConnectorNotDeleted(entity2);
});

test("delete active connectors using names (with and without ref) - without test option", () => {
    const entity1 = entityByName("mq-outbound-customized-2");
    const entity2 = entityByName("mq-outbound-customized-3");

    const output = graphman("import",
        "--using", "deleteActiveConnectors",
        "--variables.activeConnectors.+.ref.name", entity1.name,
        "--variables.activeConnectors.+.name", entity2.name,
        "--gateway", "target-gateway");

    expect(output.data.deleteActiveConnectors.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectActiveConnectorDeleted(entity1);
    expectActiveConnectorDeleted(entity2);
});

test("delete active connector fails when required name field is missing", () => {
    const output = graphman("import",
        "--using", "deleteActiveConnectors",
        "--variables.activeConnectors.+.enabled", "true",
        "--gateway", "target-gateway");

    expect(output.data.deleteActiveConnectors.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete active connector that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteActiveConnectors",
        "--variables.activeConnectors.+.name", "does-not-exist-activeconnector",
        "--gateway", "target-gateway");

    expect(output.data.deleteActiveConnectors.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
