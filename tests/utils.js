// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const tConfig = init();

module.exports = {
    config: function (cfg) {
        if (cfg) {
            Object.assign(tConfig, cfg);
        }

        return tConfig;
    },

    load: function (name) {
        return require(tConfig.home + "/modules/" + name);
    },

    metadata: function () {
        return tConfig.metadata;
    },

    graphman: function (...args) {
        const outputFile = tConfig.workspace + "/output.json";

        if (args.indexOf("--output") === -1) {
            args.push("--output");
            args.push(outputFile);
        }

        if (fs.existsSync(outputFile)) {
            if (fs.statSync(outputFile).isDirectory()) {
                fs.rmSync(outputFile, {recursive: true, force: true});
            } else {
                fs.unlinkSync(outputFile);
            }
        }
        const isWin = process.platform === "win32";
        const stdOutput = cp.execFileSync(tConfig.execFile, args, {stdio: ['inherit', 'pipe', 'pipe'],shell: isWin, encoding: 'utf8'});
        console.log(stdOutput);
        const output = fs.existsSync(outputFile)? String(fs.readFileSync(outputFile)) : "{}";
        console.log(output);
        const json = JSON.parse(output);
        json.stdout = stdOutput;
        return json;
    },

    /**
     * Runs the CLI with a payload piped to its standard input.
     * Returns the raw streams instead of the --output file, as the point is to exercise the pipe.
     */
    graphmanWithInput: function (input, ...args) {
        const isWin = process.platform === "win32";
        const result = cp.spawnSync(tConfig.execFile, args, {
            input: input,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: isWin,
            encoding: 'utf8'
        });

        return {status: result.status, stdout: result.stdout || "", stderr: result.stderr || ""};
    },

    expectArray: function (actual) {
        return {
            toContainEqual: function (...expected) {
                const expectObj = expect(actual);
                expected.forEach(item => expectObj.toContainEqual(expect.objectContaining(item)));
            }
        }
    },
    
    readFileAsJson: function (path) {
        return JSON.parse(fs.readFileSync(path));
    },

    lookupEntityGoid: function (pluralName, matchFields) {
        const listing = module.exports.graphman("export", "--using", `${pluralName}:summary`, "--gateway", "target-gateway");
        const match = (listing[pluralName] || []).find(item =>
            Object.keys(matchFields).every(k => item[k] === matchFields[k]));
        return match && match.goid;
    },

    expectEntityDeleted: function (pluralName, matchFields) {
        const listing = module.exports.graphman("export", "--using", `${pluralName}:summary`, "--gateway", "target-gateway");
        expect(listing[pluralName]).not.toEqual(expect.arrayContaining([
            expect.objectContaining(matchFields)
        ]));
    }
};

function init() {
    const home = process.env.GRAPHMAN_HOME || path.join(__dirname, '..');
    const tConfig = {
        home,
        execFile: process.env.GRAPHMAN_ENTRYPOINT || "./graphman.sh",
        workspace: path.join(home, "build", "tests"),
        schemaVersion: process.env.GRAPHMAN_SCHEMA || "v11.2.2"
    };

    const modulePath = path.join(tConfig.home, "modules", "graphman.js");
    if (fs.existsSync(modulePath)) {
        require(modulePath).init(tConfig.home, {options:{}});
    }

    tConfig.metadata = initMetadata(tConfig);

    return tConfig;
}

function initMetadata(tConfig) {
    const metadataPath = path.join(tConfig.home, "schema", tConfig.schemaVersion, "metadata.json");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    metadata.typeInfoByBundleName = {};
    metadata.typeInfoByTypeName = {};

    Object.entries(metadata.types).forEach(([key, item]) => {
        if (item.isL7Entity) {
            metadata.typeInfoByBundleName[item.pluralName] = item;
            metadata.typeInfoByTypeName[item.typeName.toLowerCase()] = item;
        }
    });

    metadata.typeInfos = function () {
        return Object.values(metadata.types).filter(item => item.isL7Entity);
    };

    metadata.mutationMethod = function (pluralName, prefix) {
        return pluralName === "smConfigs" ?
            prefix + pluralName.substring(0, 2).toUpperCase() + pluralName.substring(2) :
            prefix + pluralName.substring(0, 1).toUpperCase() + pluralName.substring(1);
    };

    metadata.typeInfoByVariableBundleName = function (arg) {
        let typeInfo = metadata.typeInfoByBundleName(arg);

        if (typeInfo == null) {
            if (arg.startsWith("set")) typeInfo = metadata.typeInfoByBundleName(arg.substring("set".length));
            if (arg.startsWith("delete")) typeInfo = metadata.typeInfoByBundleName(arg.substring("delete".length));
            if (arg.startsWith("create")) typeInfo = metadata.typeInfoByBundleName(arg.substring("create".length));
            if (arg.startsWith("update")) typeInfo = metadata.typeInfoByBundleName(arg.substring("update".length));
            if (arg.indexOf("By") !== -1) {
                const partialArg = arg.substring(0, arg.indexOf("By"));
                typeInfo = metadata.typeInfoByBundleName(partialArg);
                if (typeInfo == null) typeInfo = metadata.typeInfoByTypeName(partialArg.toLowerCase());
            }
        }

        return typeInfo;
    };

    return metadata;
}
