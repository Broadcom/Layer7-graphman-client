// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");

module.exports = {
    build: function (version, schemaVersion, refresh) {
        const metadataBaseFile = utils.schemaMetadataBaseFile(schemaVersion);
        const metadataFile = utils.schemaMetadataFile(schemaVersion);

        if (!refresh && utils.existsFile(metadataFile)) {
            return buildV2(utils.readFile(metadataFile));
        }

        const metadataBase = utils.readFile(metadataBaseFile);
        const metadata = {
            types: {},
            subTypes: {},
            primitiveTypes: metadataBase.primitiveTypes
        };

        metadata.types["HardwiredService"] = {category: "union", fields: []};
        metadata.types["AliasedService"] = {category: "union", fields: []};
        metadata.types["AliasedPolicy"] = {category: "union", fields: []};
        buildV1(metadata, version, schemaVersion);
        buildV1Extras(metadata, metadataBase);
        utils.writeFile(metadataFile, metadata);

        return buildV2(metadata);
    },

    availableSchemas: function () {
        const schemas = [];
        const path = utils.schemasDir();

        utils.listDir(path).forEach(item => {
            if (utils.isDirectory(utils.path(path, item))) schemas.push(item);
        });

        return schemas;
    }
};

function buildV2(metadata) {
    metadata.bundleTypes = {};

    Object.values(metadata.types).forEach(typeInfo => {
        if (typeInfo.isL7Entity) {
            metadata.bundleTypes[typeInfo.pluralName] = typeInfo;
        }
    });

    metadata.bundleTypes["internalSchemas"] = metadata.types["Schema"];
    metadata.bundleTypes["internalDtds"] = metadata.types["Dtd"];
    metadata.types["HardwiredService"] = Object.assign(
        {},
        metadata.types["L7Service"],
        {category: "union", isL7Entity: false}
    );
    metadata.types["AliasedService"] = Object.assign(
        {},
        metadata.types["L7Service"],
        {category: "union", isL7Entity: false}
    );
    metadata.types["AliasedPolicy"] = Object.assign(
        {},
        metadata.types["L7Policy"],
        {category: "union", isL7Entity: false}
    );

    return metadata;
}

function buildV1(metadata, version, schemaVersion) {
    metadata.version = version;
    metadata.schemaVersion = schemaVersion;
    metadata.processedFiles = 0;

    // start parsing the graphql schema files
    const schemaDir = utils.schemaDir(schemaVersion);
    utils.listDir(schemaDir).forEach(file => {
        if (file.endsWith(".graphql")) {
            metadata.processedFiles++;
            parseSchemaFile(schemaDir + "/" + file, typeInfo => {
                if (typeInfo.isL7Entity) {
                    utils.fine("  capturing type: " + typeInfo.typeName);
                    metadata.types[typeInfo.typeName] = typeInfo;
                } else if (typeInfo.category === 'enum') {
                    utils.fine("  capturing sub-type as primitive: " + typeInfo.typeName);
                    metadata.primitiveTypes.push(typeInfo.typeName);
                } else {
                    utils.fine("  capturing sub-type: " + typeInfo.typeName);
                    const existing = metadata.subTypes[typeInfo.typeName];
                    if (existing) {
                        utils.fine("  extending sub-type: " + typeInfo.typeName);
                        existing.fields = existing.fields.concat(typeInfo.fields);
                    } else {
                        metadata.subTypes[typeInfo.typeName] = typeInfo;
                    }
                }
            });
        }
    });

    if (metadata.processedFiles === 0) {
        throw utils.newError("schema file(s) are missing, path=" + schemaDir + "/*.graphql");
    }

    // identify the required sub-types by inspecting the main type fields
    const reqSubTypes = {};

    reqSubTypes["Query"] = metadata.subTypes["Query"];
    reqSubTypes["Mutation"] = metadata.subTypes["Mutation"];

    // retain only the *PartialInput (and its "ref" field's *RefInput) types actually
    // used by update*/delete* mutations, so 'describe' can surface the ref shape
    reqSubTypes["Mutation"].fields.forEach(fieldInfo => {
        const inputArg = fieldInfo.args && fieldInfo.args.find(arg => arg.name === "input");
        const inputTypeName = inputArg && bareTypeName(inputArg.dataType);
        const inputTypeInfo = inputTypeName && metadata.subTypes[inputTypeName];

        if (inputTypeInfo && inputTypeName.endsWith("PartialInput") && !reqSubTypes[inputTypeName]) {
            reqSubTypes[inputTypeName] = inputTypeInfo;
            inspectTypeFields(metadata, inputTypeInfo, (subFieldInfo, subTypeInfo) => {
                if (!reqSubTypes[subTypeInfo.typeName]) {
                    reqSubTypes[subTypeInfo.typeName] = subTypeInfo;
                    return true;
                }

                return false;
            });
        }
    });

    Object.entries(metadata.types).forEach(([key, typeInfo]) => {
        inspectTypeFields(metadata, typeInfo, (fieldInfo, subTypeInfo) => {
            if (!reqSubTypes[subTypeInfo.typeName]) {
                reqSubTypes[subTypeInfo.typeName] = subTypeInfo;
                return true;
            }

            return false;
        });
    });

    // promote the required sub-types as main types, and merge extend-style
    // sub-types (e.g. "extend type X { ... }") into any already known main type
    Object.entries(metadata.subTypes).forEach(([key, typeInfo]) => {
        const existing = metadata.types[key];
        if (existing) {
            utils.fine("  extending type: " + typeInfo.typeName);
            existing.fields = existing.fields.concat(typeInfo.fields);
        } else if (!reqSubTypes[key]) {
            utils.fine("  ignoring sub-type: " + typeInfo.typeName);
        } else {
            utils.fine("  promoting sub-type: " + typeInfo.typeName);
            metadata.types[key] = typeInfo;
        }
    });

    // sort the fields in Query and Mutation sub-types
    const byName = (a, b) => {
        if (a.name < b.name) return -1;
        else if (a.name > b.name) return 1;
        else return 0;
    };
    metadata.subTypes["Query"].fields.sort(byName);
    metadata.subTypes["Mutation"].fields.sort(byName);

    delete metadata.subTypes;
    delete metadata.processedFiles;

    return metadata;
}

/**
 * Populates extra type details from the base configuration
 * @param metadata Graphman metadata
 * @param metadataBase base configuration
 * @param metadataBase.deprecatedTypes list of deprecated types
 * @param metadataBase.goidRefTypes list of types that are referenced by goid
 * @param metadataBase.singleQueryMethods list of pairs of type and single query method
 */
function buildV1Extras(metadata, metadataBase) {
    Array.from(metadataBase.deprecatedTypes).forEach(item => {
        const typeInfo = metadata.types[item];
        if (typeInfo) {
            typeInfo.deprecated = true;
        }
    });

    Array.from(metadataBase.goidRefTypes).forEach(item => {
        const typeInfo = metadata.types[item];
        if (typeInfo) {
            typeInfo.goidRefEnabled = true;
        }
    });

    Array.from(metadataBase.singleQueryMethods).forEach(item => {
        const typeInfo = metadata.types[item[0]];
        if (typeInfo) {
            typeInfo.singleQueryMethod = item[1];
        }
    });
}

/**
 * Parses the graphql schema files and extracts type information
 * @param file
 * @param onTypeCallback
 */
function parseSchemaFile(file, onTypeCallback) {
    const lines = utils.readFile(file).split(/\r?\n/);
    const ref = {
        tInfo: null, //type-info
        mlcInfo: {}, // multi-line comment-info
        mlc: false,
        pendingFieldText: "", // buffers a field declaration whose args span multiple lines
        pendingParenDepth: 0
    };

    for (const line of lines) {
        if (isMultiLineComment(line)) {
            ref.mlc = !ref.mlc;
            continue;
        }

        if (ref.mlc) captureMultiLineCommentInfo(line, ref);
        if (ref.mlc || isSingleLineComment(line)) continue;

        if (!ref.tInfo) {
            captureTypeInfoIfMatches(line, ref);
        }

        if (ref.tInfo) { // covers both multi-line blocks and ones that fit on a single line
            const fieldText = bufferFieldLine(line, ref);
            if (fieldText !== null) captureFieldInfoIfMatches(fieldText, ref);
            finalizeTypeInfoIfClosed(line, ref, onTypeCallback);
        }
    }
}

/**
 * Buffers a field declaration until any argument-list parens it opens are balanced, so a field
 * whose arguments are spread across multiple lines (e.g. deleteServerModuleFiles) is captured as
 * one logical line instead of being mis-parsed piecemeal, line by line.
 */
function bufferFieldLine(line, ref) {
    const content = stripTrailingComment(line);
    ref.pendingParenDepth += countChar(content, '(') - countChar(content, ')');
    ref.pendingFieldText += (ref.pendingFieldText ? " " : "") + content;

    if (ref.pendingParenDepth > 0) return null; // arg list still open, keep buffering

    const fieldText = ref.pendingFieldText;
    ref.pendingFieldText = "";
    ref.pendingParenDepth = 0;
    return fieldText;
}

function countChar(text, ch) {
    let count = 0;
    for (const c of text) if (c === ch) count++;
    return count;
}

function finalizeTypeInfoIfClosed(line, ref, onTypeCallback) {
    if (stripTrailingComment(line).indexOf('}') === -1) return; // type definition doesn't end on this line

    ref.tInfo.excludedFields = normalizeFilteredFields(ref.tInfo.excludedFields, "-", ref.tInfo);
    ref.tInfo.includedFields = normalizeFilteredFields(ref.tInfo.includedFields, "+", ref.tInfo);
    onTypeCallback(ref.tInfo);
    ref.tInfo = null;
    ref.mlcInfo = {};
}

function stripTrailingComment(line) {
    const index = line.indexOf('#');
    return index === -1 ? line : line.substring(0, index);
}

function isMultiLineComment(line) {
    return line.match(/^\s*"""/);
}

function isSingleLineComment(line) {
    return line.match(/^\s*"/) || line.match(/^\s*#/);
}

function captureMultiLineCommentInfo(line, ref) {
    const match = line.match(/@([-\w]+)\s*(.*)/);
    if (match) {
        ref.mlcInfo[match[1]] = match[2];
        if (match[1] === "l7-entity") ref.mlcInfo["is-l7-entity"] = true;
        if (match[1] === "l7-deprecated") ref.mlcInfo["is-deprecated"] = true;
    }
}

function captureTypeInfoIfMatches(line, ref) {
    const match = line.match(/(type|enum|interface|input)\s+(\w+)/);
    if (match) {
        ref.tInfo = {category: match[1], typeName: match[2], fields: []};
        ref.tInfo.isL7Entity = ref.mlcInfo["is-l7-entity"];
        ref.tInfo.deprecated = ref.mlcInfo["is-deprecated"];

        let names = splitTokens(ref.mlcInfo["l7-entity"], "|");
        if (names.length === 0) names = camelCaseNames(match[2]);
        if (names.length > 0) ref.tInfo.singularName = names[0];
        if (names.length > 1) ref.tInfo.pluralName = names[1];

        ref.tInfo.summaryFields = splitTokens(ref.mlcInfo["l7-summary-fields"]);
        ref.tInfo.excludedFields = splitTokens(ref.mlcInfo["l7-excluded-fields"]);
        ref.tInfo.includedFields = splitTokens(ref.mlcInfo["l7-included-fields"]);
        ref.tInfo.identityFields = splitTokens(ref.mlcInfo["l7-identity-fields"]);
        ref.tInfo.deprecatedFields = splitTokens(ref.mlcInfo["l7-deprecated-fields"]);
        if (ref.tInfo.deprecatedFields.length) {
            utils.info(`found deprecated fields for ${ref.tInfo.typeName}: ${ref.tInfo.deprecatedFields}`);
        }

        ref.mlcInfo = {};
    }
}

function captureFieldInfoIfMatches(line, ref) {
    const content = stripTrailingComment(line);
    // field declaration, <field-name>(<args>): <field-type>; the args group tolerates one level of
    // nested parens, e.g. an inline "@deprecated(reason: \"...\")" directive on one of the arguments
    const fieldPattern = /\s+(\w+)\s*([(](?:[^()]|[(][^()]*[)])*[)])?\s*[:]\s*[\[]?(\w+)/g;
    Array.from(content.matchAll(fieldPattern)).forEach(match => {
        ref.tInfo.fields.push({name: match[1], dataType: match[3].trim(), args: match[2] ? extractFieldArgs(match[2]) : undefined});
    });
}

function extractFieldArgs(text) {
    const result = [];
    Array.from(text.matchAll(/\s*(\w+)\s*[:]([^,)]+)/g)).forEach(match => {
        if (match) {
            result.push({name: match[1], dataType: match[2].trim()});
        }
    });
    return result;
}

function normalizeFilteredFields(filteredFields, sign, typeInfo) {
    const normalizedFields = [];

    Array.from(filteredFields).forEach(item => {
        const index = item.indexOf('.');

        if (index !== -1 && index + 1 < item.length) {
            const fieldName = item.substring(0, index);
            const fieldSuffix = item.substring(index + 1);
            const field = typeInfo.fields.find(item => item.name === fieldName);

            if (field) {
                if (field.suffix) {
                    field.suffix += "," + sign + fieldSuffix;
                } else {
                    field.suffix = ":" + sign + fieldSuffix;
                }
            }
        } else {
            normalizedFields.push(item);
        }
    });

    return normalizedFields;
}

function inspectTypeFields(metadata, typeInfo, callback) {
    for (const fieldInfo of typeInfo.fields) {
        if (!metadata.primitiveTypes.includes(fieldInfo.dataType)) {
            const subTypeInfo = metadata.subTypes[fieldInfo.dataType];
            if (subTypeInfo) {
                if (callback(fieldInfo, subTypeInfo)) {
                    inspectTypeFields(metadata, subTypeInfo, callback);
                }
            } else if (!metadata.types[fieldInfo.dataType]) {
                utils.warn(`  missing sub-type: ${fieldInfo.dataType}, ref: ${typeInfo.typeName}.${fieldInfo.name}`);
            }
        }
    }
}

function bareTypeName(dataType) {
    const match = dataType.match(/\w+/);
    return match ? match[0] : dataType;
}

function camelCaseNames(typeName) {
    const singularName = typeName.charAt(0).toLowerCase() + typeName.substring(1);
    const pluralName = singularName.endsWith("y") ? singularName.substring(0, singularName.length - 1) + "ies" : singularName + "s";
    return [singularName, pluralName];
}

function splitTokens(text, delimiter) {
    if (!text) return [];

    text = text.trim();
    return text.length === 0 ? [] : Array.from(text.split(delimiter||",")).map(item => item.trim());
}
