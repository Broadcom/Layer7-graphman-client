// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");

module.exports = {
    generate: function (query, variables, options) {
        const [queryPrefix, querySuffix] = query.split(":");
        const queryFilename = utils.queryFile(queryPrefix + ".json", graphman.configuration().schemaVersion);
        const gql = utils.existsFile(queryFilename) ?
            utils.readFile(queryFilename) :
            buildGraphQL(queryPrefix, querySuffix);

        gql.variables = Object.assign(gql.variables || {}, variables);
        gql.options = options || {};

        if (querySuffix === "full") {
            gql.variables.includeAllDependencies = true;
            gql.variables.includePolicyRevisions = options.includePolicyRevisions;
            gql.options.full = true;
        }

        if (querySuffix === "summary") {
            gql.variables.includePolicyRevisions = false;
            gql.options.summary = true;
        }

        const xgql = expandGraphQLQuery(gql);
        if (!options.describeQuery && xgql.args) {
            for (const qArg of xgql.args) {
                if (!xgql.variables[qArg]) utils.warn("missing variable: " + qArg);
            }
        }

        return xgql;
    },

    expand: function (query, variables, options) {
        const gql = {query: query, variables: variables || {}, options: options || {}};
        return expandGraphQLQuery(gql);
    },

    generateFor: function (entities, typeInfo, options) {
        const gql = buildGraphQLQueryFor(entities, typeInfo, options);
        gql.options = options || {};
        return expandGraphQLQuery(gql);
    },

    /**
     * Builds a single composite query out of two or more independently named queries, so that
     * they can be executed against the gateway in one round-trip.
     * @param queryNames names of the queries to be combined, e.g. ["clusterProperties", "sysinfo"]
     * @param variables name-value pairs used in querying the configuration
     * @param options name-value pairs used to customize the operation
     * @param queryArgOverrides optional {"<position>": {"<originalArgName>": "<newArgName>"}} map,
     *        used to pin the name of an argument for the query at that 1-based position instead
     *        of relying on the automatic <name><position> disambiguation
     */
    generateComposite: function (queryNames, variables, options, queryArgOverrides) {
        const generated = queryNames.map(name => this.generate(name, variables, options));
        return mergeGeneratedQueries(queryNames, generated, options, queryArgOverrides || {});
    }
}

function buildGraphQL(queryPrefix, querySuffix) {
    return graphman.queryFieldInfo(queryPrefix) ?
        buildGraphQLQuery(queryPrefix, querySuffix) :
        buildGraphQLMutation(queryPrefix);
}

/**
 * Builds simple list all query for known types
 * @param queryPrefix pluralMethod of a known type
 * @param querySuffix either summary or none.
 * @returns {{query: string}}
 */
function buildGraphQLQuery(queryPrefix, querySuffix) {
    const fieldInfo = graphman.queryFieldInfo(queryPrefix);
    const typeInfo = fieldInfo ? graphman.typeInfoByTypeName(fieldInfo.dataType) : null;

    if (!typeInfo) {
        utils.warn("no matching query definition available from " + utils.queriesDir(utils.wrapperHome()));
        throw "unrecognized query " + queryPrefix;
    }

    let fArgs = "(";
    let sArgs = "(";
    let qArgs = [];

    if (fieldInfo.args) for (const argInfo of fieldInfo.args) {
        fArgs += (fArgs.length > 1 ? ", $" : "$") + argInfo.name + ": " + argInfo.dataType;
        sArgs += (sArgs.length > 1 ? ", " : "") + argInfo.name + ": $" + argInfo.name;
        qArgs.push(argInfo.name);
    }

    if (fArgs.length > 1) {
        fArgs += ")";
        sArgs += ")";
    } else {
        fArgs = sArgs = "";
    }

    const suffix = querySuffix ? ":" + querySuffix : "";

    return {
        query: `query ${queryPrefix}${fArgs} {\n` +
            `    ${queryPrefix}${sArgs} {\n` +
            `        {{${typeInfo.typeName}${suffix}}}\n` +
            `    }\n` +
            `}\n`,
        args: qArgs
    };
}

/**
 * Builds a standard plural-based mutation (setXxx/updateXxx/deleteXxx) for known mutation fields
 * @param mutationPrefix name of a captured Mutation field, e.g. setFolders, updateFolders, deleteFolders
 * @returns {{query: string, args: string[]}}
 */
function buildGraphQLMutation(mutationPrefix) {
    const fieldInfo = graphman.mutationFieldInfo(mutationPrefix);
    const inputArg = fieldInfo && fieldInfo.args && fieldInfo.args.find(arg => arg.name === "input");
    const pluralName = inputArg && pluralNameForMutation(mutationPrefix);

    if (!inputArg || !pluralName) {
        utils.warn("no matching mutation definition available from " + utils.queriesDir(utils.wrapperHome()));
        throw "unrecognized mutation " + mutationPrefix;
    }

    const query = `mutation ${mutationPrefix}($${pluralName}: ${inputArg.dataType}) {\n` +
        `  ${mutationPrefix}(input: $${pluralName}) {\n` +
        `    detailedStatus {\n` +
        `      action\n` +
        `      status\n` +
        `      description\n` +
        `      source {\n` +
        `        name\n` +
        `        value\n` +
        `      }\n` +
        `      target {\n` +
        `        name\n` +
        `        value\n` +
        `      }\n` +
        `    }\n` +
        `  }\n` +
        `}\n` +
        refFieldComment(inputArg.dataType);

    return {query: query, args: [pluralName]};
}

/**
 * Resolves the plural entity name (e.g. "folders") for a standard set/update/delete mutation field
 * (e.g. "setFolders") by matching it against the known bundle type plural names.
 */
function pluralNameForMutation(mutationPrefix) {
    const bundleTypes = graphman.schemaMetadata().bundleTypes;

    for (const verb of ["set", "update", "delete"]) {
        if (mutationPrefix.startsWith(verb) && mutationPrefix.length > verb.length) {
            const suffix = mutationPrefix.substring(verb.length).toLowerCase();
            const pluralName = Object.keys(bundleTypes).find(name => name.toLowerCase() === suffix);
            if (pluralName) return pluralName;
        }
    }

    return null;
}

/**
 * Builds a comment documenting the "ref" field of a PartialInput type (used by update/delete
 * mutations to identify the existing entity), if applicable.
 */
function refFieldComment(inputDataType) {
    const inputTypeName = inputDataType.match(/\w+/)[0];
    if (!inputTypeName.endsWith("PartialInput")) return "";

    const inputTypeInfo = graphman.typeInfoByTypeName(inputTypeName);
    const refField = inputTypeInfo && inputTypeInfo.fields.find(f => f.name === "ref");
    const refTypeInfo = refField && graphman.typeInfoByTypeName(refField.dataType);
    if (!refTypeInfo) return "";

    let comment = `# ${refField.dataType} - identify the existing entity to update/delete by one of:\n`;
    refTypeInfo.fields.forEach(f => {
        comment += `#   ${f.name}: ${f.dataType}\n`;
    });

    return comment;
}

/**
 * Builds query for the specified entities
 * @param entities entities to be renewed
 * @param typeInfo type-info for the entities
 * @param options
 */
function buildGraphQLQueryFor(entities, typeInfo, options) {
    const queryPrefix = typeInfo.pluralName;
    const queryArgs = [];
    const variables = {};
    let subQuery = "";

    Array.from(entities).forEach((item, index) => {
        const gql = buildGraphQLSubQueryFor(item, typeInfo, "" + (index + 1), queryArgs, options);
        subQuery += gql.query;
        Object.assign(variables, gql.variables);
    });

    const queryArgsPrefix = queryArgs.length > 0 ? "(" : "";
    const queryArgsSuffix = queryArgs.length > 0 ? ")" : "";

    return {
        query: `query ${queryPrefix}${queryArgsPrefix}${queryArgs.join(',')}${queryArgsSuffix} {\n` +
            subQuery +
            `}\n`,
        variables: variables
    };
}

function buildGraphQLSubQueryFor(entity, typeInfo, suffix, queryArgs, options) {
    let fieldMethod = typeInfo.singularName + "ByGoid";
    let fieldInfo = options.useGoids && entity.goid ? graphman.queryFieldInfo(fieldMethod) : null;

    if (!fieldInfo) {
        fieldMethod = typeInfo.singleQueryMethod || typeInfo.singularName + "By" + pascalCasing(typeInfo.identityFields[0]);
        fieldInfo = graphman.queryFieldInfo(fieldMethod);
    }

    if (!fieldInfo) {
        throw new Error("missing field information: " + fieldMethod);
    }

    const fieldArgs = [];
    const variables = {};
    if (fieldInfo.args) for (const argInfo of fieldInfo.args) {
        addQueryArg(queryArgs, argInfo.name + suffix, argInfo.dataType);
        addFieldMethodArg(fieldArgs, argInfo.name, argInfo.name + suffix);
        variables[argInfo.name + suffix] = entity[argInfo.name];
    }

    if (!options.useGoids) {
        if (typeInfo.pluralName === "soapServices" || typeInfo.pluralName === "internalSoapServices") {
            // special-case: where argument name (resolver) is different from the field name (resolvers)
            variables["resolver" + suffix] = entity["resolvers"];
        } else if (typeInfo.pluralName === "services") {
            if (entity.serviceType === "WEB_API" || entity.serviceType === "INTERNAL_WEB_API") {
                // special-case: where argument value (resolvers) is missing from the entity
                variables["resolvers" + suffix] = {
                    "resolutionPath": entity.resolutionPath
                };
            }
        }
    }

    const fieldArgsPrefix = fieldArgs.length > 0 ? "(" : "";
    const fieldArgsSuffix = fieldArgs.length > 0 ? ")" : "";

    return {
        query: `` +
            `    ${fieldInfo.name}${suffix}: ${fieldInfo.name}${fieldArgsPrefix}${fieldArgs.join(',')}${fieldArgsSuffix} {\n` +
            `        {{${typeInfo.typeName}}}\n` +
            `    }\n`,
        variables: variables
    };
}

function addQueryArg(args, name, dataType) {
    args.push(`$${name}: ${dataType}`);
}

function addFieldMethodArg(args, name, variable) {
    args.push(`${name}: $${variable}`);
}

function pascalCasing(text) {
    return text.charAt(0).toUpperCase() + text.substring(1);
}

/**
 * Merges two or more already-generated queries (or mutations) into a single composite document.
 * Every combined name must resolve to the same operation keyword (all "query" or all
 * "mutation"); mixing the two throws, since a single GraphQL document can only be one operation
 * type. Colliding argument names (same name declared by more than one query) are
 * auto-disambiguated by suffixing the query's 1-based position (e.g. $name -> $name2), unless the
 * declarations are byte-for-byte identical (in which case they're intentionally shared, e.g. the
 * common $includeAllDependencies/$includePolicyRevisions toggles), or the caller pinned an
 * explicit name via queryArgOverrides.
 * @param queryNames the original query names, used for error reporting
 * @param generated the {query, variables, options} objects produced by generate() for each name
 * @param options options shared across every generated query
 * @param queryArgOverrides {"<position>": {"<originalArgName>": "<newArgName>"}} overrides
 */
function mergeGeneratedQueries(queryNames, generated, options, queryArgOverrides) {
    const argDecls = new Map(); // finalName -> declText
    const variables = {};
    let body = "";
    let keyword = null;
    const trailers = [];

    generated.forEach((gql, index) => {
        const position = index + 1;
        const overrides = (queryArgOverrides && queryArgOverrides[position]) || {};
        const {keyword: docKeyword, argsHeader, body: queryBody, trailer} = splitGeneratedQuery(gql.query, queryNames[index]);

        if (trailer && !trailers.includes(trailer)) trailers.push(trailer);

        if (keyword === null) {
            keyword = docKeyword;
        } else if (keyword !== docKeyword) {
            throw utils.newError(`cannot combine query and mutation names in the same composite: ${queryNames.join(", ")}`);
        }

        const renameMap = {}; // originalName -> finalName, scoped to this query

        splitTokens(argsHeader).forEach(decl => {
            if (decl.length === 0) return;

            const originalName = decl.split(":")[0].trim().substring(1);
            const isRequired = decl.indexOf("=") === -1;
            const declTextFor = name => decl.replace(`$${originalName}`, `$${name}`);

            let finalName = overrides[originalName] || originalName;
            let finalDecl = declTextFor(finalName);

            if (argDecls.has(finalName) && argDecls.get(finalName) !== finalDecl) {
                if (overrides[originalName]) {
                    throw utils.newError(`conflicting variable declaration for ${finalName} while building composite query (see --queryArgs.${position}.${originalName})`);
                }

                finalName = originalName + position;
                finalDecl = declTextFor(finalName);

                if (argDecls.has(finalName) && argDecls.get(finalName) !== finalDecl) {
                    throw utils.newError(`unable to resolve conflicting variable declaration for ${originalName} in query '${queryNames[index]}' while building composite query; use --queryArgs.${position}.${originalName} <new-name> to disambiguate`);
                }
            } else if (!overrides[originalName] && isRequired && argDecls.has(finalName)) {
                // required (identity) argument reused by an earlier query and not explicitly
                // opted to be shared: always disambiguate, even though the declaration text matches
                finalName = originalName + position;
                finalDecl = declTextFor(finalName);
            }

            if (finalName !== originalName) renameMap[originalName] = finalName;
            argDecls.set(finalName, finalDecl);
        });

        let renamedBody = queryBody;
        Object.entries(renameMap).forEach(([originalName, finalName]) => {
            renamedBody = renamedBody.replace(new RegExp(`\\$${originalName}\\b`, "g"), `$${finalName}`);
        });
        body += renamedBody;

        Object.assign(variables, gql.variables);
        Object.entries(renameMap).forEach(([originalName, finalName]) => {
            if (variables[finalName] === undefined && gql.variables[originalName] !== undefined) {
                variables[finalName] = gql.variables[originalName];
            }
        });
    });

    if (!options || !options.describeQuery) {
        argDecls.forEach((declText, finalName) => {
            if (variables[finalName] === undefined) utils.warn("missing variable: " + finalName);
        });
    }

    const argsHeaderText = argDecls.size > 0 ? "(" + Array.from(argDecls.values()).join(", ") + ")" : "";
    let query = beautifyGraphQLQuery({options: options || {}}, `${keyword} composite${argsHeaderText} {\n${body}\n}\n`);
    if (trailers.length > 0) query += trailers.join("\n") + "\n";

    return {query: query, variables: variables, options: options || {}};
}

/**
 * Splits a generated query's (or mutation's) text into its operation keyword, argument
 * declarations header, body, and trailer (e.g. the "# <Type> - identify the existing entity..."
 * reference comment buildGraphQLMutation appends after standard update/delete mutations, see
 * refFieldComment()), relying on beautifyGraphQLQuery() always closing the outermost brace on
 * its own line, though not necessarily the very last line (a trailing comment may follow it).
 */
function splitGeneratedQuery(query, queryName) {
    const lines = query.split("\n").filter(line => line.trim().length > 0);
    const headerMatch = lines.length > 0 && lines[0].match(/^(query|mutation)\s+\S+\s*(?:\(([^]*)\))?\s*\{$/);
    const closingIndex = lines.map(line => line.trim()).lastIndexOf("}");

    if (!headerMatch || closingIndex <= 0) {
        throw utils.newError(`unable to parse generated query for ${queryName} while building composite query`);
    }

    return {
        keyword: headerMatch[1],
        argsHeader: headerMatch[2] || "",
        body: lines.slice(1, closingIndex).join("\n") + "\n",
        trailer: lines.slice(closingIndex + 1).join("\n")
    };
}

/**
 * Expands GraphQL queries if the type references are used.
 * @param gql
 * @returns {*}
 */
function expandGraphQLQuery(gql) {
    gql.query = expandGraphQLSubQuery(gql, gql.query);
    gql.query = substituteGraphQLSubQueryFields(gql, gql.query);
    gql.query = beautifyGraphQLQuery(gql, gql.query);

    return gql;
}

function expandGraphQLSubQuery(gql, query) {
    return query.replaceAll(/{{([^}]+)}}/g, function (subtext, subgroup) {
        if (subgroup.endsWith(".gql")) {
            return expandGraphQLSubQuery(gql, utils.readFile(utils.queryFile(subgroup, graphman.configuration().schemaVersion)));
        }else {
            const [prefix, suffix] = subgroup.split(":");
            const typeInfo = graphman.typeInfoByTypeName(prefix);
            return typeInfo ? expandGraphQLSubQueryUsingTypeInfo(gql, typeInfo, suffix) : subtext;
        }
    });
}

function expandGraphQLSubQueryUsingTypeInfo(gql, typeInfo, suffix) {
    let query = "";

    if (suffix === "summary" || gql.options.summary) { // summary fields inclusion
        typeInfo.fields.forEach(fieldInfo => { // include fields
            if (typeInfo.summaryFields.length === 0 || typeInfo.summaryFields.includes(fieldInfo.name)) {
                query += "\n" + fieldInfo.name;
                if (!graphman.isPrimitiveField(fieldInfo)) {
                    query += ` {\n  {{${fieldInfo.dataType}}}\n}`;
                }
            }
        });
    } else {
        const excludedFields = [];
        const includedFields = [];

        Array.from(splitTokens(suffix)).forEach(item => {
            if (item.startsWith("-")) excludedFields.push(item.substring(1));
            else if (item.startsWith("+")) includedFields.push(item.substring(1));
            else includedFields.push(item);
        });

        if (gql.options && (!suffix || suffix.length === 0)) {
            if (gql.options.includePolicyRevisions && !includedFields.includes("policyRevisions")) {
                includedFields.push("policyRevisions");
            }
            if (gql.options.includeMultipartFields && !includedFields.includes("filePartName")) {
                includedFields.push("filePartName");
            }
        }

        typeInfo.fields.forEach(fieldInfo => { // include fields
            if ((!typeInfo.excludedFields.includes(fieldInfo.name) &&
                    !excludedFields.includes(fieldInfo.name) &&
                    !excludedFields.includes("*") &&
                    (!typeInfo.deprecatedFields.includes(fieldInfo.name) || !gql.options.excludeDeprecatedFields)) ||
                    includedFields.includes(fieldInfo.name)) {
                query += "\n" + fieldInfo.name;
                if (!graphman.isPrimitiveField(fieldInfo)) {
                    query += ` {\n  {{${fieldInfo.dataType}${fieldInfo.suffix || ""}}}\n}`;
                }
            } else {
                utils.fine(`excluding the query field ${typeInfo.typeName}.${fieldInfo.name}`);
            }
        });
    }

    return query.indexOf("{{") !== -1 ? expandGraphQLSubQuery(gql, query) : query;
}

function substituteGraphQLSubQueryFields(gql, query) {
    // substitute alternative field for policy code (xml or json or yaml or code)
    if (gql.options.policyCodeFormat && gql.options.policyCodeFormat !== "xml") {
        if (graphman.supportsFeature("policy-as-code")) {
            query = query.replaceAll(/(policy|policyRevision|policyRevisions)[^{]*[{][^}]+}/g, function (subtext) {
                return subtext.replace("xml", gql.options.policyCodeFormat);
            });
        } else {
            utils.warn("policy-as-code feature is not supported for the selected schema");
        }
    }

    // substitute alternative field for key detail (p12 or pem)
    if (gql.options.keyFormat && gql.options.keyFormat !== "p12") {
        query = query.replaceAll(/(keys|keyBy[\w]+)[^{]*[{][^}]+}/g, function (subtext) {
            return subtext.replace("p12", gql.options.keyFormat);
        });
    }

    return query;
}

function beautifyGraphQLQuery(gql, query) {
    const result = {query: "", indentation: ""};

    query.split(/[\n]/).forEach(token => {
        const str = token.trim();
        if (str.length > 0) {
            if (str.endsWith("}")) {
                result.indentation = result.indentation.substring(0, result.indentation.length - 2);
                result.query += (result.indentation + str);
            } else if (str.endsWith("{")) {
                result.query += (result.indentation + str);
                result.indentation += "  ";
            } else {
                result.query += (result.indentation + str);
            }
            result.query += "\n";
        }
    });

    return result.query;
}

function splitTokens(text, delimiter) {
    if (!text) return [];

    text = text.trim();
    return text.length === 0 ? [] : Array.from(text.split(delimiter||",")).map(item => item.trim());
}
