// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("../utils");
const {graphman} = tUtils;

const SAMPLE_BUNDLE = "samples/folder/entities.json";
const sampleEntities = tUtils.readFileAsJson(SAMPLE_BUNDLE).folders;
const entityByPath = path => sampleEntities.find(entity => entity.path === path);

function expectFolderDeleted(entity) {
    const output = graphman("export", "--using", "folderByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.folders).toBeUndefined();
}

function expectFolderNotDeleted(entity) {
    const output = graphman("export", "--using", "folderByGoid:summary", "--variables.goid", entity.goid, "--gateway", "target-gateway");
    expect(output.folders).toEqual(expect.arrayContaining([
        expect.objectContaining({goid: entity.goid})
    ]));
}

beforeAll(() => {
    graphman("import", "--input", SAMPLE_BUNDLE, "--gateway", "target-gateway");
});

test("delete folder using input.ref.goid", () => {
    const entity = entityByPath("/GrandParentUsingGQL/ParentUsingGQL/ChildUsingGQL");

    const output = graphman("import",
        "--using", "deleteFolders",
        "--variables.folders.+.ref.goid", entity.goid,
        "--gateway", "target-gateway");

    expect(output.data.deleteFolders.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity.goid}])
        })
    ]));

    expectFolderDeleted(entity);
});

test("delete folders using path (with and without ref) - with test option", () => {
    const entity1 = entityByPath("/GrandParentUsingGQL/ParentUsingGQL");
    const entity2 = entityByPath("/GrandParentUsingGQL");

    const output = graphman("import",
        "--using", "deleteFolders",
        "--variables.folders.+.ref.path", entity1.path,
        "--variables.folders.+.path", entity2.path,
        "--options.test",
        "--gateway", "target-gateway");

    expect(output.data.deleteFolders.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectFolderNotDeleted(entity1);
    expectFolderNotDeleted(entity2);
});

test("delete folders using path (with and without ref) - without test option", () => {
    const entity1 = entityByPath("/GrandParentUsingGQL/ParentUsingGQL");
    const entity2 = entityByPath("/GrandParentUsingGQL");

    const output = graphman("import",
        "--using", "deleteFolders",
        "--variables.folders.+.ref.path", entity1.path,
        "--variables.folders.+.path", entity2.path,
        "--gateway", "target-gateway");

    expect(output.data.deleteFolders.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity1.goid}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            target: expect.arrayContaining([{name: 'goid', value: entity2.goid}])
        })
    ]));

    expectFolderDeleted(entity1);
    expectFolderDeleted(entity2);
});

test("delete folder fails when required path field is missing", () => {
    const output = graphman("import",
        "--using", "deleteFolders",
        "--variables.folders.+.checksum", "irrelevant",
        "--gateway", "target-gateway");

    expect(output.data.deleteFolders.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'ERROR',
            description: expect.stringContaining("At least one identifying field (goid or a natural key) must be supplied for")
        })
    ]));
});

test("delete folder that does not exist", () => {
    const output = graphman("import",
        "--using", "deleteFolders",
        "--variables.folders.+.ref.path", "/DoesNotExistFolderUsingGQL",
        "--gateway", "target-gateway");

    expect(output.data.deleteFolders.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'NONE',
            description: expect.stringContaining("Did not find the entity")
        })
    ]));
});
