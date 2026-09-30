// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/customkeyvalue/entities.json";

function lookupGoid(key) {
    const output = graphman("export", "--using", "customKeyValueByKey:summary", "--variables.key", key, "--gateway", "target-gateway");
    return output.customKeyValues[0].goid;
}

function expectCustomKeyValueDeleted(key) {
    const output = graphman("export", "--using", "customKeyValueByKey:summary", "--variables.key", key, "--gateway", "target-gateway");
    expect(output.customKeyValues).toBeUndefined();
}

function expectCustomKeyValueNotDeleted(key) {
    const output = graphman("export", "--using", "customKeyValueByKey:summary", "--variables.key", key, "--gateway", "target-gateway");
    expect(output.customKeyValues).toEqual(expect.arrayContaining([
        expect.objectContaining({key})
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete custom key value using input.ref.goid", () => {
    const key = "SOME_DB_USERNAME";
    const goid = lookupGoid(key);

    const output = graphman("import",
        "--using", "deleteCustomKeyValues",
        "--variables.customKeyValues.+.ref.goid", goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteCustomKeyValues.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: goid}])
        })
    ]));

    expectCustomKeyValueDeleted(key);
});

test("delete custom key values using key (with and without ref) - with test option", () => {
    const key1 = "SOME_DOMAIN_NAME";
    const key2 = "SOME_DB_PASSWORD";
    const goid1 = lookupGoid(key1);
    const goid2 = lookupGoid(key2);

    const output = graphman("import",
        "--using", "deleteCustomKeyValues",
        "--variables.customKeyValues.+.ref.key", key1,
        "--variables.customKeyValues.+.key", key2,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteCustomKeyValues.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: goid1}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: goid2}])
        })
    ]));

    expectCustomKeyValueNotDeleted(key1);
    expectCustomKeyValueNotDeleted(key2);
});

test("delete custom key values using key (with and without ref) - without test option", () => {
    const key1 = "SOME_DOMAIN_NAME";
    const key2 = "SOME_DB_PASSWORD";
    const goid1 = lookupGoid(key1);
    const goid2 = lookupGoid(key2);

    const output = graphman("import",
        "--using", "deleteCustomKeyValues",
        "--variables.customKeyValues.+.ref.key", key1,
        "--variables.customKeyValues.+.key", key2,
        "--gateway", "target-gateway");

    expect(output.data.deleteCustomKeyValues.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: goid1}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: goid2}])
        })
    ]));

    expectCustomKeyValueDeleted(key1);
    expectCustomKeyValueDeleted(key2);
});

test("delete custom key value fails when required key field is missing", () => {
    const output = graphman("import",
        "--using", "deleteCustomKeyValues",
        "--variables.customKeyValues.+.value", "irrelevant",
        "--gateway", "target-gateway");

    expect(output.data.deleteCustomKeyValues.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete custom key value that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteCustomKeyValues",
        "--variables.customKeyValues.+.key", "DOES_NOT_EXIST_KEY",
        "--gateway", "target-gateway");

    expect(output.data.deleteCustomKeyValues.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
