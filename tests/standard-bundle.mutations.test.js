// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;
const {metadata} = tUtils;

const standardBundleFile = "samples/standard-bundle.json";

test("import entities with bundleDefaultAction=IGNORE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "IGNORE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'IGNORE', status: 'IGNORED'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("import entities using --query alias for --using", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--query", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "IGNORE",
        "--force");

    const op = output.data[metadata().mutationMethod("keys", "set")];
    expect(op.detailedStatus.length).toBeGreaterThan(0);
    op.detailedStatus.forEach(item => expect(item).toMatchObject(
        {action: 'IGNORE', status: 'IGNORED'}));
});

test("import using deprecated --using still works and warns", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "IGNORE",
        "--force");

    expect(output.stdout).toEqual(expect.stringContaining("--using is deprecated, use --query instead"));
    const op = output.data[metadata().mutationMethod("keys", "set")];
    expect(op.detailedStatus.length).toBeGreaterThan(0);
});

test("import entities using a composite mutation built from multiple mutation names", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--queries", "setKeys", "setSecrets",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "IGNORE",
        "--force");

    const setKeysStatus = output.data[metadata().mutationMethod("keys", "set")];
    const setSecretsStatus = output.data[metadata().mutationMethod("secrets", "set")];

    expect(setKeysStatus.detailedStatus.length).toBeGreaterThan(0);
    setKeysStatus.detailedStatus.forEach(item => expect(item).toMatchObject(
        {action: 'IGNORE', status: 'IGNORED'}));

    expect(setSecretsStatus.detailedStatus.length).toBeGreaterThan(0);
    setSecretsStatus.detailedStatus.forEach(item => expect(item).toMatchObject(
        {action: 'IGNORE', status: 'IGNORED'}));
});

test("import entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            if (typeInfo.pluralName === 'fipGroups' || typeInfo.pluralName === 'fipUsers') {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'DELETE', status: 'NONE', description: 'Did not find the entity\'s identity provider, ignoring the mutation'}));
            } else {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'DELETE', status: 'NONE', description: 'Did not find the entity, ignoring the mutation'}));
            }
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("import entities with bundleDefaultAction=NEW_OR_EXISTING", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "NEW_OR_EXISTING",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'NEW_OR_EXISTING', status: 'CREATED'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=NEW_OR_EXISTING", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "NEW_OR_EXISTING",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'NEW_OR_EXISTING', status: 'USED_EXISTING'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=NEW_OR_UPDATE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "NEW_OR_UPDATE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            if (typeInfo.pluralName === "serverModuleFiles") {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'NEW_OR_UPDATE', status: 'NONE', description: 'Server module file entity exists and requires no further changes, ignoring the mutation'}));
            } else {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'NEW_OR_UPDATE', status: 'UPDATED'}));
            }
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'DELETE', status: 'DELETED'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'DELETE', status: 'NONE'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("clean entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            detailedStatus.forEach(item => {
                const source = JSON.stringify(item.source, null, 2);
                if (item.status === 'DELETED') console.log(`Deleted ${typeInfo.pluralName} ${source}`);
                if (item.status === 'ERROR') console.log(`Error ${typeInfo.pluralName} ${item.description} ${source}`);
            });
        }
    });
});

