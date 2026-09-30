// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/key/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).keys;
const entityByAlias = alias => sampleEntities.find(entity => entity.alias === alias);

function expectKeyDeleted(entity) {
    const output = graphman("export", "--using", "keyByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.keys).toBeUndefined();
}

function expectKeyNotDeleted(entity) {
    const output = graphman("export", "--using", "keyByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.keys).toEqual(expect.arrayContaining([
        expect.objectContaining({goid: entity.goid})
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete key using input.ref.goid", () => {
    const entity = entityByAlias("rsa-alice");

    const output = graphman("import",
        "--using", "deleteKeys",
        "--variables.keys.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteKeys.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectKeyDeleted(entity);
});

test("delete keys using alias (with and without ref) - with test option", () => {
    const entity1 = entityByAlias("ec-bob");
    const entity2 = entityByAlias("ec-signer");

    const output = graphman("import",
        "--using", "deleteKeys",
        "--variables.keys.+.ref.alias", entity1.alias,
        "--variables.keys.+.alias", entity2.alias,
        "--variables.keys.keystoreId", entity2.keystoreId,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteKeys.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectKeyNotDeleted(entity1);
    expectKeyNotDeleted(entity2);
});

test("delete keys using alias (with and without ref) - without test option", () => {
    const entity1 = entityByAlias("ec-bob");
    const entity2 = entityByAlias("ec-signer");

    const output = graphman("import",
        "--using", "deleteKeys",
        "--variables.keys.+.ref.alias", entity1.alias,
        "--variables.keys.+.alias", entity2.alias,
        "--variables.keys.keystoreId", entity2.keystoreId,
        "--gateway", "target-gateway");

    expect(output.data.deleteKeys.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectKeyDeleted(entity1);
    expectKeyDeleted(entity2);
});

test("delete key fails when required alias field is missing", () => {
    const output = graphman("import",
        "--using", "deleteKeys",
        "--variables.keys.+.keySize", "2048",
        "--gateway", "target-gateway");

    expect(output.data.deleteKeys.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete key that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteKeys",
        "--variables.keys.+.alias", "does-not-exist-key",
        "--variables.keys.keystoreId", "00000000000000000000000000000002",
        "--gateway", "target-gateway");

    expect(output.data.deleteKeys.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
