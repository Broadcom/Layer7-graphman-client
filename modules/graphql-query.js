// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");

module.exports = {
    /**
     * Generates the GraphQL query/mutation for the given name.
     * @param query name of the query (or mutation) with the optional suffix
     * @param variables name-value pairs used in the query
     * @param options name-value pairs used to customize the operation
     * @param kind optional, "query" or "mutation"; the kind of GraphQL field the calling operation works with,
     *        used to report the unrecognized names appropriately
     * @param composing optional, true when generating a part of a composite; the mutation input is then
     *        adjusted by the composite builder per the final variable name
     */
    generate: function (query, variables, options, kind, composing) {
        const [queryPrefix, querySuffix] = splitOnFirst(query, ":");
        const queryFilename = utils.queryFile(queryPrefix + ".json", graphman.configuration().schemaVersion);
        const gql = utils.existsFile(queryFilename) ?
            utils.readFile(queryFilename) :
            buildGraphQL(queryPrefix, querySuffix, kind);

        gql.variables = Object.assign(gql.variables || {}, variables);
        gql.options = Object.assign({}, options);

        const {modes, revisions} = parseQuerySuffix(querySuffix);

        if (modes.has("revisions")) {
            gql.revisions = revisions;
            // includes the policy revisions, as the includePolicyRevisions option does; never for the dependencies
            gql.options.includePolicyRevisions = true;
            gql.options.revisionsMode = true; // carried along with the summary mode
            gql.variables.includePolicyRevisions = true;
        }

        if (modes.has("full")) {
            gql.variables.includeAllDependencies = true;
            gql.variables.includePolicyRevisions = gql.options.includePolicyRevisions;
            gql.options.full = true;
        } else if (modes.has("dependencies")) {
            gql.variables.includeAllDependencies = true;
        }

        if (modes.has("dependencies")) {
            gql.options.dependencies = true;
        }

        if (modes.has("summary")) {
            // the summary mode turns the revisions off, unless the revisions mode is requested too
            if (!modes.has("revisions")) gql.variables.includePolicyRevisions = false;
            gql.options.summary = true;
        }

        const xgql = expandGraphQLQuery(gql);
        if (!options.describeQuery && xgql.args) {
            for (const qArg of xgql.args) {
                if (!xgql.variables[qArg] && !hasDefaultValue(xgql.query, qArg)) utils.warn("missing variable: " + qArg);
            }
        }

        retainDeclaredVariables(xgql);
        if (xgql.inputRule && !composing) applyInputRule(xgql.variables, xgql.inputRule, gql.options);
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
     * @param kind optional, "query" or "mutation"; the kind of GraphQL field the calling operation works with
     */
    generateComposite: function (queryNames, variables, options, queryArgOverrides, kind) {
        queryNames.forEach(name => {
            const prefix = splitOnFirst(name, ":")[0];
            if (utils.existsFile(utils.queryFile(prefix + ".json", graphman.configuration().schemaVersion))) {
                throw utils.newError(`'${prefix}' is a predefined query/mutation and cannot be used in a composite; only the standard queries/mutations can be combined`);
            }
        });

        const generated = queryNames.map(name => this.generate(name, variables, options, kind, true));
        return mergeGeneratedQueries(queryNames, generated, options, queryArgOverrides || {}, variables);
    }
}

function buildGraphQL(queryPrefix, querySuffix, kind) {
    if (graphman.queryFieldInfo(queryPrefix)) {
        return buildGraphQLQuery(queryPrefix, querySuffix);
    }

    // operations that work with the query fields (e.g. export) report the unknown names as unrecognized queries;
    // known mutation fields are still generated, so that the operation can report the mismatch
    if (kind === "query" && !graphman.mutationFieldInfo(queryPrefix)) {
        utils.warn("no matching query definition available from " + utils.queriesDir(utils.wrapperHome()));
        throw "unrecognized query " + queryPrefix;
    }

    return buildGraphQLMutation(queryPrefix, kind);
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
    validateQuerySuffix(typeInfo, querySuffix);

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
 * Rejects the field names, typed by the user in the query suffix, that the type doesn't have (e.g. services:sumary).
 * The suffixes embedded in the predefined query files are not checked, as those may refer to the fields
 * that are not available with the older schemas.
 */
function validateQuerySuffix(typeInfo, querySuffix) {
    const {fields} = parseQuerySuffix(querySuffix);
    const known = typeInfo.fields.map(f => f.name);
    const unknown = splitTokens(fields)
        .map(item => item.replace(/^[-+]/, ""))
        .filter(name => name !== "*" && !known.includes(name));

    if (unknown.length > 0) {
        throw utils.newError(`unknown query mode or field '${unknown[0]}' for ${typeInfo.typeName}; supported modes: ${QUERY_MODES.join(", ")}`);
    }
}

/**
 * Builds a standard plural-based mutation (setXxx/updateXxx/deleteXxx) for known mutation fields
 * @param mutationPrefix name of a captured Mutation field, e.g. setFolders, updateFolders, deleteFolders
 * @returns {{query: string, args: string[]}}
 */
function buildGraphQLMutation(mutationPrefix, kind) {
    // operations that work with the mutation fields (e.g. import) report the unknown names as unrecognized mutations
    const unrecognized = (kind === "mutation" ? "unrecognized mutation " : "unrecognized query or mutation ") + mutationPrefix;

    if (!graphman.supportsFeature("standard-mutations")) {
        utils.warn(`standard mutations are supported from the schema v11.2.2 onwards, current schema is ${graphman.configuration().schemaVersion}`);
        throw unrecognized;
    }

    const fieldInfo = graphman.mutationFieldInfo(mutationPrefix);
    const inputArg = fieldInfo && fieldInfo.args && fieldInfo.args.find(arg => arg.name === "input");
    const pluralName = inputArg && pluralNameForMutation(mutationPrefix);

    if (!inputArg || !pluralName) {
        utils.warn(`no matching ${kind === "mutation" ? "mutation" : "query or mutation"} definition available from ` + utils.queriesDir(utils.wrapperHome()));
        throw unrecognized;
    }

    // every list parameter of the mutation defaults to an empty list
    const declaredType = inputArg.dataType.trim().startsWith("[") ? inputArg.dataType + " = []" : inputArg.dataType;
    const query = `mutation ${mutationPrefix}($${pluralName}: ${declaredType}) {\n` +
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

    const result = {query: query, args: [pluralName]};
    const verb = ["update", "delete"].find(item => mutationPrefix.startsWith(item));
    const partialType = inputArg.dataType.match(/\w+/)[0];
    if (verb && partialType.endsWith("PartialInput")) {
        // not a part of the request payload, hence not enumerable
        Object.defineProperty(result, "inputRule", {value: {variable: pluralName, verb: verb, partialType: partialType}});
    }

    return result;
}

/**
 * Makes the entities of an exported bundle acceptable for the update and delete mutations, which take the
 * *PartialInput types: updates drop the checksum field, deletes identify the entity by the "ref" field
 * (natural key fields of the *RefInput type, or the goid if the option useRefGoids is on).
 * The entities are copied, as the same bundle sections may be shared by many mutations.
 */
function applyInputRule(variables, rule, options) {
    const value = variables[rule.variable];
    if (value === undefined || value === null) return;

    const convert = rule.verb === "update" ? removeChecksum : entity => toRefInput(entity, rule.partialType, options);
    variables[rule.variable] = Array.isArray(value) ? value.map(convert) : convert(value);
}

function removeChecksum(entity) {
    if (!entity || typeof entity !== "object" || !entity.hasOwnProperty("checksum")) return entity;

    const copy = Object.assign({}, entity);
    delete copy.checksum;
    return copy;
}

function toRefInput(entity, partialType, options) {
    if (!entity || typeof entity !== "object" || entity.ref) return entity;

    const partialInfo = graphman.typeInfoByTypeName(partialType);
    const refField = partialInfo && partialInfo.fields.find(f => f.name === "ref");
    const refInfo = refField && graphman.typeInfoByTypeName(refField.dataType.match(/\w+/)[0]);
    if (!refInfo) return entity;

    const present = name => entity[name] !== undefined && entity[name] !== null;
    const pick = names => names.filter(present).reduce((ref, name) => Object.assign(ref, {[name]: entity[name]}), {});
    const natural = pick(refInfo.fields.map(f => f.name).filter(name => name !== "goid"));
    const byGoid = pick(["goid"]);
    const candidates = options && options.useRefGoids ? [byGoid, natural] : [natural, byGoid];
    const ref = candidates.find(item => Object.keys(item).length > 0);

    return ref ? {ref: ref} : entity;
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
 * @param suppliedVariables the variables supplied by the caller, used for the (renamed) arguments that
 *        the individual queries don't know about
 */
function mergeGeneratedQueries(queryNames, generated, options, queryArgOverrides, suppliedVariables) {
    const argDecls = new Map(); // finalName -> declText
    const rootFieldOwners = new Map(); // response key of the root field -> name of the query that selects it
    const variables = {};
    let body = "";
    let keyword = null;
    const trailers = [];
    const inputRules = [];

    generated.forEach((gql, index) => {
        const position = index + 1;
        const overrides = (queryArgOverrides && queryArgOverrides[position]) || {};
        const {keyword: docKeyword, argsHeader, body: queryBody, trailer} = splitGeneratedQuery(gql.query, queryNames[index]);

        if (trailer && !trailers.includes(trailer)) trailers.push(trailer);

        // a root field can be selected only once, un-aliased duplicates make the document invalid
        const rootFields = new Set(rootFieldKeys(queryBody));
        rootFields.forEach(key => {
            if (rootFieldOwners.has(key)) {
                throw utils.newError(`duplicate root field '${key}' in the composite query, it is selected by both '${rootFieldOwners.get(key)}' and '${queryNames[index]}'; a root field can be requested only once`);
            }
        });
        rootFields.forEach(key => rootFieldOwners.set(key, queryNames[index]));

        if (keyword === null) {
            keyword = docKeyword;
        } else if (keyword !== docKeyword) {
            throw utils.newError(`cannot combine query and mutation names in the same composite: ${queryNames.join(", ")}`);
        }

        const renameMap = {}; // originalName -> finalName, scoped to this query

        splitTokens(argsHeader).forEach(decl => {
            if (decl.length === 0) return;

            const originalName = decl.split(":")[0].trim().substring(1);
            // the arguments with default values are the optional toggles, which are shared across the queries;
            // the mutation arguments carry the input, so they always get disambiguated
            const isRequired = decl.indexOf("=") === -1 || docKeyword === "mutation";
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
        if (gql.inputRule) inputRules.push({finalName: renameMap[gql.inputRule.variable] || gql.inputRule.variable, rule: gql.inputRule});
        // a renamed argument of the query shares the value supplied for the original name; the mutations don't,
        // as the bundle sections are not meant to be duplicated under the renamed variables (supply them explicitly)
        Object.entries(renameMap).forEach(([originalName, finalName]) => {
            if (docKeyword !== "mutation" && variables[finalName] === undefined && gql.variables[originalName] !== undefined) {
                variables[finalName] = gql.variables[originalName];
            }
        });
    });

    argDecls.forEach((declText, finalName) => {
        if (variables[finalName] === undefined && suppliedVariables && suppliedVariables[finalName] !== undefined) {
            variables[finalName] = suppliedVariables[finalName];
        }
    });

    inputRules.forEach(item => applyInputRule(variables, Object.assign({}, item.rule, {variable: item.finalName}), options));

    if (!options || !options.describeQuery) {
        argDecls.forEach((declText, finalName) => {
            if (variables[finalName] === undefined && !declText.includes("=")) utils.warn("missing variable: " + finalName);
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
 * Identifies the response keys (alias, or else the field name) of the root fields selected by an operation's body.
 * Arguments, directive arguments and the nested selections are skipped, only the top-level fields are of interest.
 */
function rootFieldKeys(body) {
    const text = body.split("\n").map(line => line.replace(/#.*$/, "")).join("\n");
    let topLevel = "";
    let depth = 0;

    for (const ch of text) {
        if (ch === "(" || ch === "{") depth++;
        else if (ch === ")" || ch === "}") depth--;
        else if (depth === 0) topLevel += ch;
    }

    const keys = [];
    for (const match of topLevel.matchAll(/(?<![@\w.])(?:([A-Za-z_]\w*)\s*:\s*)?([A-Za-z_]\w*)/g)) {
        keys.push(match[1] || match[2]);
    }

    return keys;
}

/**
 * Checks if the variable is declared with a default value, e.g. $name: [String!]! = []
 */
function hasDefaultValue(query, name) {
    return new RegExp("\\$" + name + "\\s*:[^,)=]*=").test(query);
}

/**
 * Retains only the variables declared by the operation, e.g. a bundle read from a file carries
 * the sections that the chosen query/mutation doesn't declare, which are not meant to be sent.
 * The "properties" section of the bundle is always retained, even though the operation doesn't declare it.
 * Variables are left untouched when the operation's declarations cannot be identified.
 */
const ALWAYS_RETAINED_VARIABLES = ["properties"];

function retainDeclaredVariables(gql) {
    const declared = declaredVariableNames(gql.query);
    if (declared === null || !gql.variables) return;

    const dropped = Object.keys(gql.variables).filter(name => !declared.has(name) && !ALWAYS_RETAINED_VARIABLES.includes(name));
    dropped.forEach(name => delete gql.variables[name]);
    if (dropped.length > 0) utils.fine("not sending the variables that are not declared by the operation: " + dropped.join(", "));
}

/**
 * Identifies the variables declared in the operation header, e.g. query name($a: Int, $b: [String!]! = []) {...}
 * @returns {Set<string>|null} null if the operation header cannot be identified
 */
function declaredVariableNames(query) {
    const header = /^\s*(?:query|mutation)\b[^({\n]*/m.exec(query);
    if (!header) return null;

    const names = new Set();
    let index = header.index + header[0].length;
    while (index < query.length && /\s/.test(query[index])) index++;

    if (query[index] === "(") {
        let depth = 0;
        let end = index;
        for (; end < query.length; end++) {
            if (query[end] === "(") depth++;
            else if (query[end] === ")" && --depth === 0) break;
        }

        const declarations = query.substring(index, end);
        for (const match of declarations.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) names.add(match[1]);
    }

    return names;
}

/**
 * Expands GraphQL queries if the type references are used.
 * @param gql
 * @returns {*}
 */
function expandGraphQLQuery(gql) {
    gql.query = expandGraphQLSubQuery(gql, gql.query);
    gql.query = substituteGraphQLSubQueryFields(gql, gql.query);
    gql.query = selectPolicyRevisions(gql, gql.query);
    gql.query = beautifyGraphQLQuery(gql, gql.query);

    return gql;
}

/**
 * Applies the inline revision selection (revisions[0;-1;3] in the query suffix) to the policyRevisions fields
 * that don't have the arguments yet; 0 is the active revision and -1 is the latest one.
 * Policy dependencies never carry the policy revisions, so there is nothing to select there.
 */
function selectPolicyRevisions(gql, query) {
    const selection = gql.revisions;
    if (selection === undefined || selection === null || selection === true || selection === false || selection === "") return query;

    const ordinals = (Array.isArray(selection) ? selection : String(selection).split(",")).map(item => String(item).trim());
    const invalid = ordinals.find(item => !/^-?\d+$/.test(item));
    if (invalid !== undefined) {
        throw utils.newError(`invalid policy revision '${invalid}'; expected comma separated ordinals, 0 for the active and -1 for the latest revision`);
    }

    return query.replaceAll(/\bpolicyRevisions\b(?!\s*\()/g, `policyRevisions(selected: [${ordinals.map(Number).join(", ")}])`);
}

function expandGraphQLSubQuery(gql, query) {
    return query.replaceAll(/{{([^}]+)}}/g, function (subtext, subgroup) {
        if (subgroup.endsWith(".gql")) {
            return expandGraphQLSubQuery(gql, utils.readFile(utils.queryFile(subgroup, graphman.configuration().schemaVersion)));
        }else {
            const [prefix, suffix] = splitOnFirst(subgroup, ":");
            const typeInfo = graphman.typeInfoByTypeName(prefix);
            return typeInfo ? expandGraphQLSubQueryUsingTypeInfo(gql, typeInfo, suffix) : subtext;
        }
    });
}

function expandGraphQLSubQueryUsingTypeInfo(gql, typeInfo, suffix) {
    if (typeInfo.typeName === "PolicyDependency") {
        // dependencies of dependencies are not expanded, to avoid the recursion;
        // and the policy revisions are never included for the dependencies
        gql = Object.assign({}, gql, {options: Object.assign({}, gql.options, {dependencies: false, includePolicyRevisions: false, revisionsMode: false})});
    }

    let query = "";

    const {modes, fields} = parseQuerySuffix(suffix);
    const summary = modes.has("summary") || gql.options.summary;
    const none = modes.has("none") && !summary;

    const excludedFields = [];
    const includedFields = [];

    Array.from(splitTokens(fields)).forEach(item => {
        if (item.startsWith("-")) excludedFields.push(item.substring(1));
        else if (item.startsWith("+")) includedFields.push(item.substring(1));
        else includedFields.push(item);
    });

    if (!summary && !none && gql.options) {
        // the policy revisions are honored with the explicit field list too, unless the user excluded them
        if (gql.options.includePolicyRevisions && !includedFields.includes("policyRevisions") &&
            !excludedFields.includes("policyRevisions") && !excludedFields.includes("*")) {
            includedFields.push("policyRevisions");
        }
        if (fields.length === 0 && gql.options.includeMultipartFields && !includedFields.includes("filePartName")) {
            includedFields.push("filePartName");
        }
    }

    typeInfo.fields.forEach(fieldInfo => { // include fields
        const name = fieldInfo.name;
        let included;

        if (summary) {
            included = summaryFieldsOf(typeInfo).includes(name) || summaryFieldsOf(typeInfo).length === 0 ||
                (name === "policyRevisions" && gql.options.revisionsMode === true && !excludedFields.includes(name));
        } else if (none) {
            included = false;
        } else {
            included = !typeInfo.excludedFields.includes(name) &&
                !excludedFields.includes("*") &&
                (!typeInfo.deprecatedFields.includes(name) || !gql.options.excludeDeprecatedFields);
        }

        if (excludedFields.includes(name)) included = false;
        if (includedFields.includes(name)) included = true;

        if (gql.options.dependencies && name === "policy" && fieldInfo.dataType === "Policy" && !excludedFields.includes(name)) {
            // policy dependencies inclusion for the entities having policy sub field
            query += `\npolicy {\n${included ? "{{Policy}}\n" : ""}allDependencies {\n  {{PolicyDependency:${POLICY_DEPENDENCY_SUFFIX}}}\n}\n}`;
        } else if (included) {
            query += "\n" + name;
            if (!graphman.isPrimitiveField(fieldInfo)) {
                query += ` {\n  {{${fieldInfo.dataType}${summary ? "" : fieldInfo.suffix || ""}}}\n}`;
            }
        } else {
            utils.fine(`excluding the query field ${typeInfo.typeName}.${name}`);
        }
    });

    if (query.trim().length === 0) {
        throw utils.newError(`empty selection for ${typeInfo.typeName}, at least one field must be selected`);
    }

    return query.indexOf("{{") !== -1 ? expandGraphQLSubQuery(gql, query) : query;
}

// the revisions carry the policy code, which is left out of their summary
const POLICY_REVISION_SUMMARY_FIELDS = ["goid", "ordinal", "active", "comment", "author", "time"];

function summaryFieldsOf(typeInfo) {
    return typeInfo.summaryFields.length === 0 && typeInfo.typeName === "PolicyRevision" ?
        POLICY_REVISION_SUMMARY_FIELDS : typeInfo.summaryFields;
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

// entity types referred from the policy dependencies, which are fetched separately
const POLICY_DEPENDENCY_SUFFIX = "-policyFragments,-dtds,-schemas,-internalIdps,-internalUsers,-internalGroups,-fips,-fipUsers,-fipGroups,-federatedIdps,-federatedUsers,-federatedGroups,-ldaps,-ldapIdps,-simpleLdapIdps,-policyBackedIdps";
const QUERY_MODES = ["summary", "all", "dependencies", "full", "revisions", "none"];

function splitOnFirst(text, delimiter) {
    const index = text.indexOf(delimiter);
    return index === -1 ? [text, undefined] : [text.substring(0, index), text.substring(index + delimiter.length)];
}

/**
 * Parses the query suffix of the form [<modes>][:<fields>], where modes are comma separated names
 * from QUERY_MODES and fields are comma separated field filters (-name, +name or name).
 * A first stage starting with -* is treated as "none". A first stage containing anything other than
 * known modes is treated as a legacy single-stage field list.
 * The revisions mode may carry the revision selection, e.g. revisions[0;-1].
 * @returns {{modes: Set<string>, fields: string, revisions: (string|undefined)}}
 */
function parseQuerySuffix(suffix) {
    const modes = new Set();
    if (!suffix) return {modes: modes, fields: ""};

    const [stage1, stage2] = splitOnFirst(suffix, ":");
    let revisions;
    const tokens = splitTokens(stage1).map(item => {
        // revisions[<ordinal>;<ordinal>...] is the revisions mode along with the revision selection
        const match = /^revisions\[([^\]]*)\]$/.exec(item);
        if (!match) return item;
        revisions = match[1].split(";").map(ordinal => ordinal.trim()).join(",");
        return "revisions";
    });

    if (stage1.trim().startsWith("-*")) {
        modes.add("none");
        return {modes: modes, fields: tokens.slice(1).concat(splitTokens(stage2)).join(","), revisions: revisions};
    }

    const unknownModes = tokens.filter(item => !QUERY_MODES.includes(item));
    if (unknownModes.length > 0 && unknownModes.length < tokens.length) {
        throw utils.newError(`unknown query mode '${unknownModes[0]}'; supported modes: ${QUERY_MODES.join(", ")}`);
    }

    if (tokens.length > 0 && unknownModes.length === 0) {
        tokens.forEach(item => modes.add(item));
        if (modes.has("full")) modes.add("dependencies");
        return {modes: modes, fields: splitTokens(stage2).join(","), revisions: revisions};
    }

    return {modes: modes, fields: suffix};
}

function splitTokens(text, delimiter) {
    if (!text) return [];

    text = text.trim();
    return text.length === 0 ? [] : Array.from(text.split(delimiter||",")).map(item => item.trim());
}
