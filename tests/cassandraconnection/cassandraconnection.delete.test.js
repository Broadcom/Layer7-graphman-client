// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/cassandraconnection/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).cassandraConnections;
const entityByName = name => sampleEntities.find(entity => entity.name === name);

function expectCassandraConnectionDeleted(entity) {
    const output = graphman("export", "--using", "cassandraConnectionByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.cassandraConnections).toBeUndefined();
}

function expectCassandraConnectionNotDeleted(entity) {
    const output = graphman("export", "--using", "cassandraConnectionByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.cassandraConnections).toEqual(expect.arrayContaining([
        expect.objectContaining({
            goid: entity.goid
        })
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete cassandra connection using input.ref.goid", () => {
    const entity = entityByName("some-cassandra-connection");

    const output = graphman("import",
        "--using", "deleteCassandraConnections",
        "--variables.cassandraConnections.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteCassandraConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectCassandraConnectionDeleted(entity);
});

test("delete cassandra connections using names (with and without ref) - with test option", () => {
    const entity1 = entityByName("some-cassandra-connection-delete-by-input-1");
    const entity2 = entityByName("some-cassandra-connection-delete-by-input-2");

    const output = graphman("import",
        "--using", "deleteCassandraConnections",
        "--variables.cassandraConnections.+.ref.name", entity1.name,
        "--variables.cassandraConnections.+.name", entity2.name,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteCassandraConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectCassandraConnectionNotDeleted(entity1);
    expectCassandraConnectionNotDeleted(entity2);
});

test("delete cassandra connections using names (with and without ref) - without test option", () => {
    const entity1 = entityByName("some-cassandra-connection-delete-by-input-1");
    const entity2 = entityByName("some-cassandra-connection-delete-by-input-2");

    const output = graphman("import",
        "--using", "deleteCassandraConnections",
        "--variables.cassandraConnections.+.ref.name", entity1.name,
        "--variables.cassandraConnections.+.name", entity2.name,
        "--gateway", "target-gateway");

    expect(output.data.deleteCassandraConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectCassandraConnectionDeleted(entity1);
    expectCassandraConnectionDeleted(entity2);
});

test("delete cassandra connection fails when required name field is missing", () => {
    const output = graphman("import",
        "--using", "deleteCassandraConnections",
        "--variables.cassandraConnections.+.enabled", "true",
        "--gateway", "target-gateway");

    expect(output.data.deleteCassandraConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete cassandra connection that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteCassandraConnections",
        "--variables.cassandraConnections.+.name", "does-not-exist-cassandra-connection",
        "--gateway", "target-gateway");

    expect(output.data.deleteCassandraConnections.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
