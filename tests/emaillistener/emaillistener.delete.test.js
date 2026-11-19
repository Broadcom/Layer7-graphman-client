// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/emaillistener/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).emailListeners;
const entityByName = name => sampleEntities.find(entity => entity.name === name);

function expectEmailListenerDeleted(entity) {
    const output = graphman("export", "--using", "emailListenerByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.emailListeners).toBeUndefined();
}

function expectEmailListenerNotDeleted(entity) {
    const output = graphman("export", "--using", "emailListenerByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.emailListeners).toEqual(expect.arrayContaining([
        expect.objectContaining({
            goid: entity.goid
        })
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete email listener using input.ref.goid", () => {
    const entity = entityByName("some-email-listener");

    const output = graphman("import",
        "--using", "deleteEmailListeners",
        "--variables.emailListeners.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteEmailListeners.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectEmailListenerDeleted(entity);
});

test("delete email listeners using names (with and without ref) - with test option", () => {
    const entity1 = entityByName("delete-by-input-email-listener-1");
    const entity2 = entityByName("delete-by-input-email-listener-2");

    const output = graphman("import",
        "--using", "deleteEmailListeners",
        "--variables.emailListeners.+.ref.name", entity1.name,
        "--variables.emailListeners.+.name", entity2.name,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteEmailListeners.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectEmailListenerNotDeleted(entity1);
    expectEmailListenerNotDeleted(entity2);
});

test("delete email listeners using names (with and without ref) - without test option", () => {
    const entity1 = entityByName("delete-by-input-email-listener-1");
    const entity2 = entityByName("delete-by-input-email-listener-2");

    const output = graphman("import",
        "--using", "deleteEmailListeners",
        "--variables.emailListeners.+.ref.name", entity1.name,
        "--variables.emailListeners.+.name", entity2.name,
        "--gateway", "target-gateway");

    expect(output.data.deleteEmailListeners.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectEmailListenerDeleted(entity1);
    expectEmailListenerDeleted(entity2);
});

test("delete email listener fails when required name field is missing", () => {
    const output = graphman("import",
        "--using", "deleteEmailListeners",
        "--variables.emailListeners.+.enabled", "true",
        "--gateway", "target-gateway");

    expect(output.data.deleteEmailListeners.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete email listener that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteEmailListeners",
        "--variables.emailListeners.+.name", "does-not-exist-email-listener",
        "--gateway", "target-gateway");

    expect(output.data.deleteEmailListeners.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
