// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/policy/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).policies;
const entityByName = name => sampleEntities.find(entity => entity.name === name);

function expectPolicyDeleted(entity) {
    const output = graphman("export", "--using", "policyByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.policies).toBeUndefined();
}

function expectPolicyNotDeleted(entity) {
    const output = graphman("export", "--using", "policyByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.policies).toEqual(expect.arrayContaining([
        expect.objectContaining({goid: entity.goid})
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete policy using input.ref.goid", () => {
    const entity = entityByName("global-pre-service");

    const output = graphman("import",
        "--using", "deletePolicies",
        "--variables.policies.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deletePolicies.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectPolicyDeleted(entity);
});

test("delete policies using name and policyType (with and without ref) - with test option", () => {
    const entity1 = entityByName("pbip-fragment");
    const entity2 = entityByName("some-fragment");

    const output = graphman("import",
        "--using", "deletePolicies",
        "--variables.policies.+.ref.name", entity1.name,
        "--variables.policies.ref.policyType", entity1.policyType,
        "--variables.policies.+.name", entity2.name,
        "--variables.policies.policyType", entity2.policyType,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deletePolicies.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectPolicyNotDeleted(entity1);
    expectPolicyNotDeleted(entity2);
});

test("delete policies using name and policyType (with and without ref) - without test option", () => {
    const entity1 = entityByName("pbip-fragment");
    const entity2 = entityByName("some-fragment");

    const output = graphman("import",
        "--using", "deletePolicies",
        "--variables.policies.+.ref.name", entity1.name,
        "--variables.policies.ref.policyType", entity1.policyType,
        "--variables.policies.+.name", entity2.name,
        "--variables.policies.policyType", entity2.policyType,
        "--gateway", "target-gateway");

    expect(output.data.deletePolicies.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectPolicyDeleted(entity1);
    expectPolicyDeleted(entity2);
});

test("delete policy fails when required name/policyType fields are missing", () => {
    const output = graphman("import",
        "--using", "deletePolicies",
        "--variables.policies.+.checksum", "irrelevant",
        "--gateway", "target-gateway");

    expect(output.data.deletePolicies.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete policy that does not exist", () => {
    const output = graphman("import",
        "--using", "deletePolicies",
        "--variables.policies.+.ref.name", "does-not-exist-policy",
        "--variables.policies.ref.policyType", "FRAGMENT",
        "--gateway", "target-gateway");

    expect(output.data.deletePolicies.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
