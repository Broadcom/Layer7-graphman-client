// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/jdbcconnection/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).jdbcConnections;
const entityByName = name => sampleEntities.find(entity => entity.name === name);

function expectJdbcConnectionDeleted(entity) {
    const output = graphman("export", "--using", "jdbcConnectionByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.jdbcConnections).toBeUndefined();
}

function expectJdbcConnectionNotDeleted(entity) {
    const output = graphman("export", "--using", "jdbcConnectionByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.jdbcConnections).toEqual(expect.arrayContaining([
        expect.objectContaining({
            goid: entity.goid
        })
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete jdbc connection using input.ref.goid", () => {
    const entity = entityByName("some-jdbc-connection");

    const output = graphman("import",
        "--using", "deleteJdbcConnections",
        "--variables.jdbcConnections.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteJdbcConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectJdbcConnectionDeleted(entity);
});

test("delete jdbc connections using names (with and without ref) - with test option", () => {
    const entity1 = entityByName("some-jdbc-connection-delete-by-input-1");
    const entity2 = entityByName("some-jdbc-connection-delete-by-input-2");

    const output = graphman("import",
        "--using", "deleteJdbcConnections",
        "--variables.jdbcConnections.+.ref.name", entity1.name,
        "--variables.jdbcConnections.+.name", entity2.name,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteJdbcConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectJdbcConnectionNotDeleted(entity1);
    expectJdbcConnectionNotDeleted(entity2);
});

test("delete jdbc connections using names (with and without ref) - without test option", () => {
    const entity1 = entityByName("some-jdbc-connection-delete-by-input-1");
    const entity2 = entityByName("some-jdbc-connection-delete-by-input-2");

    const output = graphman("import",
        "--using", "deleteJdbcConnections",
        "--variables.jdbcConnections.+.ref.name", entity1.name,
        "--variables.jdbcConnections.+.name", entity2.name,
        "--gateway", "target-gateway");

    expect(output.data.deleteJdbcConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectJdbcConnectionDeleted(entity1);
    expectJdbcConnectionDeleted(entity2);
});

test("delete jdbc connection fails when required name field is missing", () => {
    const output = graphman("import",
        "--using", "deleteJdbcConnections",
        "--variables.jdbcConnections.+.enabled", "true",
        "--gateway", "target-gateway");

    expect(output.data.deleteJdbcConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete jdbc connection that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteJdbcConnections",
        "--variables.jdbcConnections.+.name", "does-not-exist-jdbc-connection",
        "--gateway", "target-gateway");

    expect(output.data.deleteJdbcConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
