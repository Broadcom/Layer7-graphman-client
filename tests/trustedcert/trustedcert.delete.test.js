// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/trustedcert/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).trustedCerts;
const entityByName = name => sampleEntities.find(entity => entity.name === name);

function expectTrustedCertDeleted(entity) {
    const output = graphman("export", "--using", "trustedCertByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.trustedCerts).toBeUndefined();
}

function expectTrustedCertNotDeleted(entity) {
    const output = graphman("export", "--using", "trustedCertByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.trustedCerts).toEqual(expect.arrayContaining([
        expect.objectContaining({goid: entity.goid})
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete trustedCert using input.ref.goid", () => {
    const entity = entityByName("some-third-trusted-cert");

    const output = graphman("import",
        "--using", "deleteTrustedCerts",
        "--variables.trustedCerts.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteTrustedCerts.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectTrustedCertDeleted(entity);
});

test("delete trustedCerts using name (with and without ref) - with test option", () => {
    const entity1 = entityByName("some-trusted-cert");
    const entity2 = entityByName("some-other-trusted-cert");

    const output = graphman("import",
        "--using", "deleteTrustedCerts",
        "--variables.trustedCerts.+.ref.name", entity1.name,
        "--variables.trustedCerts.+.name", entity2.name,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteTrustedCerts.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectTrustedCertNotDeleted(entity1);
    expectTrustedCertNotDeleted(entity2);
});

test("delete trustedCerts using name (with and without ref) - without test option", () => {
    const entity1 = entityByName("some-trusted-cert");
    const entity2 = entityByName("some-other-trusted-cert");

    const output = graphman("import",
        "--using", "deleteTrustedCerts",
        "--variables.trustedCerts.+.ref.name", entity1.name,
        "--variables.trustedCerts.+.name", entity2.name,
        "--gateway", "target-gateway");

    expect(output.data.deleteTrustedCerts.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectTrustedCertDeleted(entity1);
    expectTrustedCertDeleted(entity2);
});

test("delete trustedCert fails when required name field is missing", () => {
    const output = graphman("import",
        "--using", "deleteTrustedCerts",
        "--variables.trustedCerts.+.verifyHostname", "false",
        "--gateway", "target-gateway");

    expect(output.data.deleteTrustedCerts.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete trustedCert that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteTrustedCerts",
        "--variables.trustedCerts.+.ref.name", "does-not-exist-cert",
        "--gateway", "target-gateway");

    expect(output.data.deleteTrustedCerts.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
