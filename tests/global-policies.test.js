// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

test("import global-policies", () => {
    const output = graphman("import",
        "--input", "samples/global-policies.sample.json",
        "--gateway", "target-gateway");
    expect(output.data.setPolicies.detailedStatus).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                status: expect.stringMatching(/CREATED|UPDATED/),
                source: expect.arrayContaining([{name: 'name', value: 'msg-received'}]),
                target: expect.arrayContaining([{name: 'goid', value: '7f2bf48f249c4d054254e23cdb832946'}])
            }),
            expect.objectContaining({
                status: expect.stringMatching(/CREATED|UPDATED/),
                source: expect.arrayContaining([{name: 'name', value: 'msg-completed'}]),
                target: expect.arrayContaining([{name: 'goid', value: '7f2bf48f249c4d054254e23cdb83278d'}])
            })
        ])
    );
});

test("generate mappings for global-policies (using legacy type)", () => {
    const output = graphman("mappings",
        "--input", "samples/global-policies.legacy-type.sample.json",
        "--mappings.action", "NEW_OR_EXISTING",
        "--mappings.level", "1");

    expect(output.properties.mappings.globalPolicies).toEqual(
        expect.arrayContaining([{
            action: 'NEW_OR_EXISTING',
            source: { tag: 'message-completed'}
        }, {
            action: 'NEW_OR_EXISTING',
            source: { tag: 'message-received'}
        }])
    );
});

test("renew global-policies (using legacy type)", () => {
    const output = graphman("renew",
        "--input", "samples/global-policies.legacy-type.sample.json",
        "--mappings.action", "NEW_OR_EXISTING",
        "--mappings.level", "1",
        "--gateway", "target-gateway");
    expect(output.stdout).not.toEqual(expect.stringContaining("missing field information: globalPolicyByName"));
    expect(output.globalPolicies).toEqual(expect.arrayContaining([
        expect.objectContaining({
            name: 'msg-received',
            tag: 'message-received'
        }),
        expect.objectContaining({
            name: 'msg-completed',
            tag: 'message-completed'
        })])
    );
});

test("delete global-policies", () => {
    const output = graphman("import",
        "--using", "delete-bundle",
        "--input", "samples/global-policies.sample.json",
        "--gateway", "target-gateway");
    expect(output.data.setPolicies.detailedStatus).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                status: 'DELETED',
                source: expect.arrayContaining([{name: 'name', value: 'msg-received'}]),
                target: expect.arrayContaining([{name: 'goid', value: '7f2bf48f249c4d054254e23cdb832946'}])
            }),
            expect.objectContaining({
                status: 'DELETED',
                source: expect.arrayContaining([{name: 'name', value: 'msg-completed'}]),
                target: expect.arrayContaining([{name: 'goid', value: '7f2bf48f249c4d054254e23cdb83278d'}])
            })
        ])
    );
});