// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/clusterproperty/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).clusterProperties;
const entityByName = name => sampleEntities.find(entity => entity.name === name);

function expectClusterPropertyDeleted(entity) {
    const output = graphman("export", "--using", "clusterPropertyByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.clusterProperties).toBeUndefined();
}

function expectClusterPropertyNotDeleted(entity) {
    const output = graphman("export", "--using", "clusterPropertyByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.clusterProperties).toEqual(expect.arrayContaining([
        expect.objectContaining({
            goid: entity.goid
        })
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete cluster property using input.ref.goid", () => {
    const entity = entityByName("some-cwp");

    const output = graphman("import",
        "--using", "deleteClusterProperties",
        "--variables.clusterProperties.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteClusterProperties.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectClusterPropertyDeleted(entity);
});

test("delete cluster properties using names (with and without ref) - with test option", () => {
    const entity1 = entityByName("some-other-cwp");
    const entity2 = entityByName("some-cwp-by-name");

    const output = graphman("import",
        "--using", "deleteClusterProperties",
        "--variables.clusterProperties.+.ref.name", entity1.name,
        "--variables.clusterProperties.+.name", entity2.name,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteClusterProperties.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectClusterPropertyNotDeleted(entity1);
    expectClusterPropertyNotDeleted(entity2);
});

test("delete cluster properties using names (with and without ref) - without test option", () => {
    const entity1 = entityByName("some-other-cwp");
    const entity2 = entityByName("some-cwp-by-name");

    const output = graphman("import",
        "--using", "deleteClusterProperties",
        "--variables.clusterProperties.+.ref.name", entity1.name,
        "--variables.clusterProperties.+.name", entity2.name,
        "--gateway", "target-gateway");

    expect(output.data.deleteClusterProperties.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectClusterPropertyDeleted(entity1);
    expectClusterPropertyDeleted(entity2);
});

test("delete cluster property fails when required name field is missing", () => {
    const output = graphman("import",
        "--using", "deleteClusterProperties",
        "--variables.clusterProperties.+.value", "irrelevant",
        "--gateway", "target-gateway");

    expect(output.data.deleteClusterProperties.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete cluster property that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteClusterProperties",
        "--variables.clusterProperties.+.name", "does-not-exist-cwp",
        "--gateway", "target-gateway");

    expect(output.data.deleteClusterProperties.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
