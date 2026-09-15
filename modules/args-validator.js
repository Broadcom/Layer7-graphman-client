// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const parser = require("./args-parser");

// parameters common to every operation; each operation module additionally
// describes its own parameters via its "paramsSchema" property.
const COMMON_SCHEMA = {
    help: "boolean",
    gateways: "opaque",
    options: {
        log: "string",
        logSink: "string",
        schema: "string",
        policyCodeFormat: "string",
        keyFormat: "string",
        caFilename: "string",
        extensions: "array"
    }
};

module.exports = {
    /**
     * Validates the parsed CLI parameters against the operation's parameter schema.
     * @param params normalized output of args-parser.parse()
     * @param args raw args array that was passed to args-parser.parse()
     * @param operation resolved operation module (may declare params.paramsSchema)
     */
    validate: function (params, args, operation) {
        const schema = mergeSchema(COMMON_SCHEMA, operation.paramsSchema || {});

        checkUnknownAndTypes(params, schema, "");
        checkNoValueBooleans(args, schema);
    }
}

function mergeSchema(common, op) {
    const merged = Object.assign({}, common, op);
    merged.options = Object.assign({}, common.options, op.options);
    return merged;
}

function checkUnknownAndTypes(obj, node, pathPrefix) {
    Object.keys(obj).forEach(key => {
        if (key === "variables" || key.startsWith("__")) return; // always skip

        const path = pathPrefix ? `${pathPrefix}.${key}` : key;
        const expected = node ? node[key] : undefined;

        if (expected === undefined) {
            utils.warn(`unknown parameter: ${path}`);
            return;
        }

        if (expected === "opaque") return; // dynamic subtree, no further checks

        const value = obj[key];
        if (typeof expected === "object") {
            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                checkUnknownAndTypes(value, expected, path);
            } else {
                fail(path, "object", value);
            }
            return;
        }

        if (!matchesType(value, expected)) {
            fail(path, expected, value);
        }
    });
}

function matchesType(value, expected) {
    if (expected === "array") return Array.isArray(value);
    if (expected === "number") return typeof value === "number";
    if (expected === "boolean") return typeof value === "boolean";
    return typeof value === "string";
}

function fail(path, expected, value) {
    throw `parameter '${path}' has an invalid value (${JSON.stringify(value)}); expected type ${expected}`;
}

function checkNoValueBooleans(args, schema) {
    parser.noValueRefs(args).forEach(ref => {
        if (ref === "variables" || ref.startsWith("variables.")) return;

        const expected = resolveRef(schema, ref);
        if (expected === "boolean") {
            utils.warn(`parameter '${ref}' was specified without a value; defaulting to true`);
        }
    });
}

function resolveRef(node, ref) {
    let cur = node;
    for (const token of ref.split(".")) {
        if (!cur || typeof cur !== "object") return undefined;
        cur = cur[token];
    }
    return cur;
}
