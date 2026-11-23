// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const graphman = require("./graphman");
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const gql = require("./graphql-query");
const exporter = require("./graphman-operation-export");
const renewer = require("./graphman-operation-renew");

module.exports = {
    /**
     * Identifies the differences between bundles/gateways.
     * @param params
     * @param params.input-source source bundle or source gateway profile name
     * @param params.input-target target bundle or target gateway profile name
     * @param params.input-mappings input (external) mappings file name
     * @param params.input-report input report file name
     * @param params.output output file name
     * @param params.output-report output report file name
     * @param params.output-id-mappings output id-mappings file name
     * @param params.options
     * @param params.options.includeInserts flag to decide including entities from the includes section
     * @param params.options.includeUpdates flag to decide including entities from the updates section
     * @param params.options.includeDeletes flag to decide including entities from the deletes section
     * @param params.options.useNoDefMappings flag to decide nodef mappings for deletion
     * @param params.options.renewEntities flag to decide renewing the entities from the respective gateways
     * NOTE: Use "@" as prefix to differentiate the gateway profile name from the bundle name.
     */
    run: function (params) {
        const bundles = [];

        if (params["input-source"] && params["input-target"]) {
            const ignoreMatcher = buildIgnoreMatcher(params);
            const source = params["input-source"];
            const target = params["input-target"];

            // when the source is a bundle and the target is a gateway, pull only the entity types
            // that are present in the source bundle instead of the entire gateway summary.
            // NOTE: the reverse is not scoped, as the types missing in the target bundle are all inserts.
            let sourceBundle = null;
            let scopeTypes = null;
            let lookupTypes = [];
            if (!isGateway(source) && isGateway(target) && params.options.scope !== "full") {
                sourceBundle = utils.readFile(source);
                scopeTypes = scopedTypes(sourceBundle);

                // include/encass references need the target's policy fragments/encass configs to capture guid mappings
                lookupTypes = referencedLookupTypes(sourceBundle).filter(key => !scopeTypes.includes(key));
                scopeTypes = scopeTypes.concat(lookupTypes);
            }

            bundles.push(sourceBundle ? Promise.resolve(sourceBundle) : readBundleFrom(source, "source"));
            bundles.push(readBundleFrom(target, "target", scopeTypes, lookupTypes));

            const mappingsFile = params["input-mappings"];
            const inputMappings = mappingsFile ? utils.readFile(params["input-mappings"]) : {};

            Promise.all(bundles).then(results => {
                const leftBundle = results[0];
                const rightBundle = results[1];
                const report = {inserts: {}, updates: {}, deletes: {}, diffs: {}, ignored: {}, mappings: {goids: [], guids: []}};

                diffReport(leftBundle, rightBundle, inputMappings.mappings || {}, report, params.options, ignoreMatcher);
                logReportCounts(report);
                if (params.options.renewEntities) {
                    diffRenewReport(leftBundle, rightBundle, inputMappings.mappings || {}, report, params.options, ignoreMatcher, renewedReport => {
                        captureDependencyMappings(renewedReport, rightBundle);

                        const bundle = {};
                        diffBundle(renewedReport, bundle, params.options, false);

                        if (params["output-report"]) {
                            utils.writeResult(params["output-report"], sortReport(renewedReport));
                        }

                        if (params["output-id-mappings"]) {
                            utils.writeResult(params["output-id-mappings"], {mappings: renewedReport.mappings});
                        }

                        utils.writeResult(params.output, butils.sort(bundle));
                    });
                } else {
                    captureDependencyMappings(report, rightBundle);

                    const bundle = {};
                    diffBundle(report, bundle, params.options, false);

                    if (params["output-report"]) {
                        utils.writeResult(params["output-report"], sortReport(report));
                    }

                    if (params["output-id-mappings"]) {
                        utils.writeResult(params["output-id-mappings"], {mappings: report.mappings});
                    }

                    utils.writeResult(params.output, butils.sort(bundle));
                }
            }).catch(error => {
                process.exitCode = 1;
                utils.error("errors encountered while analyzing the differences", error);
                if (error.name) utils.error(`  name: ${error.name}`);
                if (error.message) utils.error(`  message: ${error.message}`);
                utils.print();
            });
        } else if (params["input-report"]) {
            const report = utils.readFile(params["input-report"]);
            const bundle = {};

            diffBundle(report, bundle, params.options, true);
            utils.writeResult(params.output, butils.sort(bundle));
        } else {
            throw utils.newError("not enough input parameters");
        }
    },

    initParams: function (params, config) {
        params.options = Object.assign({includeInserts: true, includeUpdates: true, includeDeletes: false, deleteScope: "source", scope: "auto"}, params.options);

        const output = params.output;
        const JSON_SUFFIX = ".json";
        if (output) {
            if (output.endsWith(JSON_SUFFIX)) {
                const outputPrefix = output.substring(0, output.length - JSON_SUFFIX.length);
                if (!params["output-report"]) params["output-report"] = outputPrefix + ".diff-report" + JSON_SUFFIX;
                if (!params["output-id-mappings"]) params["output-id-mappings"] = outputPrefix + ".id-mappings" + JSON_SUFFIX;
            }
        }

        return params;
    },

    paramsSchema: {
        "input-source": "string",
        "input-target": "string",
        "input-mappings": "string",
        "input-report": "string",
        "input-ignore-filters": "string",
        "ignore-filter": "opaque",
        output: "string",
        "output-report": "string",
        "output-id-mappings": "string",
        options: {
            includeInserts: "boolean",
            includeUpdates: "boolean",
            includeDeletes: "boolean",
            useNoDefMappings: "boolean",
            renewEntities: "boolean",
            deleteScope: "enum:source|all",
            scope: "enum:auto|full",
            logSink: "string"
        }
    },

    usage: function () {
        console.log("diff --input-source <input-file-or-gateway> --input-target <input-file-or-gateway>");
        console.log("  [--input-mappings <input-mappings-file>]");
        console.log("  [--input-ignore-filters <ignore-filters-file>]");
        console.log("  [--ignore-filter.<section>.<field-name> <matching-criteria> <field-value>,...]");
        console.log("  [--output <output-file>]");
        console.log("  [--output-report <output-report-file>]");
        console.log("  [--output-id-mappings <output-id-mappings-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("diff --input-report <input-report-file>");
        console.log("  [--output <output-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Evaluates the differences between bundles or gateways.");
        console.log("Input can be a bundle file or a gateway profile name if it precedes with '@' special character.");
        console.log("When gateway is specified as input, summary bundle will be pulled for comparison.");
        console.log("Differences are computed such that what can be done to the target to match with the given source.");
        console.log("Include and encapsulated assertion references found in the policy code/json of the inserts and updates are");
        console.log("resolved by name against the target, to capture the guid mappings even when they are not part of the bundle.");
        console.log("The difference bundle and it's comprehensive report will be generated.");
        console.log("The difference report can be used to re-generate the difference bundle when required.");
        console.log();
        console.log("  --input-source <input-file-or-gateway-profile>");
        console.log("    specify source input bundle file for comparison");
        console.log("    Use '@' special marker to treat the input as gateway profile name");
        console.log("    use '-' to read the bundle from the standard input");
        console.log();
        console.log("  --input-target <input-file-or-gateway-profile>");
        console.log("    specify target input bundle file for comparison");
        console.log("    Use '@' special marker to treat the input as gateway profile name");
        console.log("    use '-' to read the bundle from the standard input");
        console.log("    NOTE: only one of the source and target inputs can be read from the standard input");
        console.log();
        console.log("  --input-mappings <input-mappings-file>");
        console.log("    specify complex mappings between source and target environments");
        console.log();
        console.log("  --input-ignore-filters <ignore-filters-file>");
        console.log("    specify a file with the filters to ignore the matching entities, e.g.");
        console.log('      {"clusterProperties": [{"name": ["regex", "^cluster\\."]}, {"name": "some.prop"}], "services": {"name": ["eq%", "test-"]}}');
        console.log("    top-level keys are section (plural) names; a section holds a filter or an array of filters");
        console.log("    fields within a filter are chained by and-logic, filters within a section by or-logic");
        console.log("    supported matching criteria are same as the export --filter options");
        console.log("    an entity is ignored when the source or the matching target entity satisfies a filter");
        console.log("    ignored entities are left out of the diff bundle, listed under 'ignored' in the diff report,");
        console.log("    and still contribute to the goid/guid mappings");
        console.log("    NOTE: gateway inputs carry only summary fields, so filter on identity/summary fields such as name");
        console.log();
        console.log("  --ignore-filter.<section>.<field-name> [<matching-criteria>] <field-value>");
        console.log("    same as --input-ignore-filters, but specified at the command line; combined with the file filters");
        console.log();
        console.log("  --input-report <input-report-file>");
        console.log("    specify the input diff report file to generate the diff bundle");
        console.log("    NOTE: this parameter will be ignored if the source and target input parameters are specified");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the diff bundle");
        console.log("    when skipped, output will be written to the console.");
        console.log("    NOTE: the report and id-mappings results also fall back to the console when their");
        console.log("      respective output files are not specified; keep them as files when piping the diff bundle");
        console.log();
        console.log("  --output-report <output-report-file>");
        console.log("    specify the file to capture the diff report");
        console.log();
        console.log("  --output-id-mappings <output-id-mappings-file>");
        console.log("    specify the file to capture the goid/guid mappings between source and target environments");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .includeInserts true|false");
        console.log("        decides whether to include entities from the inserts section.");
        console.log("      .includeUpdates true|false");
        console.log("        decides whether to include entities from the update section.");
        console.log("      .includeDeletes false|true");
        console.log("        decides whether to include entities from the deletes section.");
        console.log("      .useNoDefMappings false|true");
        console.log("        decides whether to use nodef mappings (only for deletion).");
        console.log("      .renewEntities false|true");
        console.log("        decides whether to renew entities from the respective gateways when specified.");
        console.log("      .scope auto|full");
        console.log("        auto: when the source is a bundle and the target is a gateway, retrieve only the entity types");
        console.log("        present in the source bundle; full: always retrieve the entire gateway summary.");
        console.log("      .deleteScope source|all");
        console.log("        source: report deletes only for the entity types present in the source bundle (or any type");
        console.log("        when the source is a gateway); all: report deletes for every entity type found in the target.");
        console.log("      .logSink stdout|stderr");
        console.log("        directs the log messages to the chosen sink.");
        console.log("        use 'stderr' (or .log nolog) when piping the output to another command.");
        console.log();
    }
}

function isGateway(fileOrGateway) {
    return fileOrGateway.startsWith('@');
}

/**
 * Entity types (plural names) of a bundle that can be queried from a gateway.
 */
function scopedTypes(bundle) {
    return Object.keys(bundle).filter(key =>
        Array.isArray(bundle[key]) && graphman.typeInfoByPluralName(key) && graphman.queryFieldInfo(key));
}

function readBundleFrom(fileOrGateway, label, scopeTypes, lookupTypes) {
    if (isGateway(fileOrGateway)) {
        const gateway = graphman.gatewayConfiguration(fileOrGateway.substring(1));
        if (!gateway.address) throw utils.newError(`${gateway.name} gateway details are missing`);
        return readBundleFromGateway(gateway, label, scopeTypes, lookupTypes);
    } else {
        return Promise.resolve(utils.readFile(fileOrGateway));
    }
}

function readBundleFromGateway(gateway, label, scopeTypes, lookupTypes) {
    return new Promise(function (resolve, reject) {
        const side = `${label} (${gateway.name})`;
        try {
            let query;
            if (scopeTypes) {
                if (scopeTypes.length === 0) {
                    utils.info(`no known entity types to retrieve from ${side} gateway`);
                    return resolve({properties: {meta: {summary: true, gateway: gateway.name}}});
                }

                utils.info(`retrieving ${side} gateway configuration summary for ${scopeTypes.join(", ")}`);
                query = gql.generateComposite(scopeTypes.map(name => name + ":summary"), {}, graphman.configuration().options);
            } else {
                utils.info(`retrieving ${side} gateway configuration summary`);
                query = gql.generate("all:summary", {}, graphman.configuration().options);
            }

            exporter.export(gateway, query, data => {
                if (data.errors) {
                    // if there's no data, report the errors via reject; otherwise, log them and proceed.
                    if (!data.data) {
                        utils.warn(`unable to retrieve ${side} gateway configuration summary`);
                        return reject(data.errors);
                    }

                    utils.warn(`partial errors detected while retrieving ${side} gateway configuration summary, proceeding with the available data`);
                    utils.error(`${side} gateway errors`, data.errors);
                }

                const bundle = data.data || {};
                bundle.properties = bundle.properties || {};
                bundle.properties.meta = bundle.properties.meta || {};
                bundle.properties.meta.summary = true;
                bundle.properties.meta.gateway = gateway.name;
                if (lookupTypes && lookupTypes.length) bundle.properties.meta.lookupTypes = lookupTypes;
                resolve(bundle);
            });
        } catch (error) {
            reject(error);
        }
    });
}

const INCLUDE_POLICY_TYPES = ["fragment", "include"];

/**
 * Collects the Include/Encapsulated assertion references from the entity's policy code.
 * Only policy.code and policy.json are inspected; xml/yaml policies are skipped.
 * @returns {{kind: string, name: string, guid: string}[]} kind is either 'include' or 'encass'
 */
function policyReferences(entity) {
    const references = [];
    if (!entity.policy) return references;

    let code = entity.policy.code;
    if (!code && entity.policy.json) {
        try {
            code = JSON.parse(entity.policy.json);
        } catch (error) {
            utils.warn("unable to parse policy json while inspecting the references");
        }
    }

    if (!code && (entity.policy.xml || entity.policy.yaml)) {
        utils.info("  skipping dependency inspection, policy is not available as code/json");
    }

    (function walk(node) {
        if (Array.isArray(node)) {
            node.forEach(walk);
        } else if (node && typeof node === "object") {
            Object.keys(node).forEach(key => {
                const value = node[key];
                if (key === "Include" && value && typeof value === "object" && !Array.isArray(value)) {
                    references.push({kind: "include", name: value.policyName, guid: value.policyGuid});
                } else if (key === "Encapsulated" && value && typeof value === "object" && !Array.isArray(value)) {
                    references.push({kind: "encass", name: value.encassName, guid: value.encassGuid});
                } else {
                    walk(value);
                }
            });
        }
    })(code);

    return references;
}

/**
 * Entity types that must be available from the target to resolve the references made by the bundle's policies.
 */
function referencedLookupTypes(bundle) {
    const kinds = new Set();
    Object.keys(bundle).forEach(key => {
        if (Array.isArray(bundle[key])) bundle[key].forEach(entity => {
            policyReferences(entity).forEach(ref => kinds.add(ref.kind));
        });
    });

    const types = [];
    if (kinds.has("include")) types.push("policies");
    if (kinds.has("encass")) types.push("encassConfigs");
    return types.filter(key => graphman.queryFieldInfo(key));
}

function findReferencedTarget(rightBundle, ref, targetReferences) {
    const entity = ref.kind === "encass" ?
        (rightBundle.encassConfigs || []).find(x => x.name === ref.name) :
        (rightBundle.policies || []).find(x =>
            x.name === ref.name && INCLUDE_POLICY_TYPES.includes(String(x.policyType).toLowerCase()));

    // the referred entity is not part of the target bundle, fall back to the references made by the target policies
    return entity || targetReferences().get(ref.kind + " " + ref.name) || null;
}

/**
 * Harvests the name-to-guid pairs from the include/encapsulated assertions of the target bundle's policies.
 * They are useful when the referred entities are not part of the target bundle, but the target policies refer to them.
 * The first guid seen for a name wins.
 */
function harvestTargetReferences(rightBundle) {
    const harvested = new Map();

    butils.forEach(rightBundle, (key, entities) => entities.forEach(entity => {
        policyReferences(entity).forEach(ref => {
            const id = ref.kind + " " + ref.name;
            if (ref.name && ref.guid && !harvested.has(id)) harvested.set(id, {guid: ref.guid});
        });
    }));

    return harvested;
}

/**
 * Captures the guid mappings for the include/encapsulated assertions referred from the policies
 * that are part of the inserts/updates, using the entities of the target bundle, or else the references made by the target bundle's own policies.
 * This helps when the referred entities are not part of the source and/or target bundles.
 */
function captureDependencyMappings(report, rightBundle) {
    const guids = report.mappings.guids;
    let harvested = null;
    const targetReferences = () => harvested || (harvested = harvestTargetReferences(rightBundle));

    ["inserts", "updates"].forEach(category => butils.forEach(report[category], (key, entities, typeInfo) => {
        entities.forEach(entity => policyReferences(entity).forEach(ref => {
            const entityName = butils.entityName(entity, typeInfo);
            const what = ref.kind === "encass" ? "encapsulated assertion" : "include policy";

            if (!ref.name) {
                if (ref.guid) utils.warn(`  ${entityName} refers to ${what} with guid ${ref.guid}, but the reference has no name to find it in the target`);
                return;
            }

            const target = findReferencedTarget(rightBundle, ref, targetReferences);
            if (!target) {
                utils.warn(`  ${entityName} refers to ${what} ${ref.name}, which is not found in the target`);
            } else if (!target.guid) {
                utils.warn(`  ${entityName} refers to ${what} ${ref.name}, which has no guid in the target`);
            } else if (ref.guid && ref.guid !== target.guid && !guids.find(x => x.source === ref.guid)) {
                utils.info(`  selecting ${entityName}, ${ref.kind}=${ref.name}, category=guid-mappings`);
                guids.push({source: ref.guid, target: target.guid});
            }
        }));
    }));
}

function logReportCounts(report) {
    const counts = {};
    ["inserts", "updates", "deletes"].forEach(category => {
        butils.forEach(report[category], (key, entities) => {
            counts[key] = counts[key] || {inserts: 0, updates: 0, deletes: 0};
            counts[key][category] = entities.length;
        });
    });

    butils.forEach(report.ignored || {}, (key, entities) => {
        counts[key] = counts[key] || {inserts: 0, updates: 0, deletes: 0};
        counts[key].ignored = entities.length;
    });

    const keys = Object.keys(counts).sort();
    if (keys.length === 0) {
        utils.info("no differences found");
        return;
    }

    utils.info("differences summary (inserts/updates/deletes, ignored)");
    keys.forEach(key => utils.info(`  ${key}: ${counts[key].inserts}/${counts[key].updates}/${counts[key].deletes}, ignored=${counts[key].ignored || 0}`));
}

function buildIgnoreMatcher(params) {
    const fileRules = params["input-ignore-filters"] ? utils.readFile(params["input-ignore-filters"]) : {};
    const cliRules = params["ignore-filter"] || {};
    const rules = {};

    [fileRules, cliRules].forEach(source => Object.keys(source).forEach(section => {
        const value = source[section];
        // an array of objects is a list of rules; anything else is a single rule
        const list = Array.isArray(value) && value.every(x => x && typeof x === "object" && !Array.isArray(x)) ? value : [value];
        rules[section] = (rules[section] || []).concat(list);
    }));

    return butils.buildIgnoreMatcher(rules);
}

function recordIgnored(report, typeInfo, entity, category, rule) {
    utils.info("  ignoring " + butils.entityName(entity, typeInfo) + ", category=" + category + ", rule=" + rule);
    const record = butils.toPartialEntity(entity, typeInfo);
    record.category = category;
    record.rule = rule;
    butils.withArray(report.ignored, typeInfo).push(record);
}

function diffReport(leftBundle, rightBundle, mappings, report, options, ignoreMatcher) {
    const multiLineTextDiffExtension = utils.extension("multiline-text-diff");
    const extOptions = {
        ignoreMatcher: ignoreMatcher,
        multiLineTextDiffExtension: multiLineTextDiffExtension,
        summary: isSummaryBundle(leftBundle) || isSummaryBundle(rightBundle)
    };

    butils.forEach(leftBundle, (key, leftEntities, typeInfo) => {
        utils.info("inspecting " + key);
        diffEntities(leftEntities, rightBundle[key], mappings[key], report, typeInfo, options, extOptions);
    });

    // deletes are limited to the types known to the source bundle, unless chosen otherwise
    const lookupTypes = (rightBundle.properties && rightBundle.properties.meta && rightBundle.properties.meta.lookupTypes) || [];
    const limitDeletes = options.deleteScope !== "all" && !isSummaryBundle(leftBundle);

    butils.forEach(rightBundle, (key, rightEntities, typeInfo) => {
        const leftEntities = leftBundle[key];
        if (limitDeletes && !Array.isArray(leftEntities)) return;
        if (lookupTypes.includes(key)) return;
        if (!leftEntities || leftEntities.length === 0) {
            utils.info("inspecting " + key);
            rightEntities.forEach(rightEntity => {
                const rule = ignoreMatcher(typeInfo.pluralName, rightEntity);
                if (rule) return recordIgnored(report, typeInfo, rightEntity, "deletes", rule);

                utils.info("  selecting " + butils.entityName(rightEntity, typeInfo) + ", category=deletes");
                const deletes = butils.withArray(report.deletes, typeInfo);
                deletes.push(rightEntity);
            });
        }
    });

    return report;
}

function sortReport(report) {
    report.inserts = butils.sort(report.inserts);
    report.updates = butils.sort(report.updates);
    report.deletes = butils.sort(report.deletes);
    if (report.ignored) report.ignored = butils.sort(report.ignored);
    return report;
}

function isSummaryBundle(bundle) {
    return bundle.properties && bundle.properties.meta && bundle.properties.meta.summary;
}

function diffRenewReport(leftBundle, rightBundle, mappings, report, options, ignoreMatcher, callback) {
    let promises = [];

    if (isSummaryBundle(leftBundle)) {
        const gateway = graphman.gatewayConfiguration(leftBundle.properties.meta.gateway);

        // renew inserts section using the source gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.inserts, ["*"], Object.assign({}, options, {useGoids: true}), resolve, reject);
        }));

        // renew updates section using the source gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.updates, ["*"], Object.assign({}, options, {useGoids: true}), resolve, reject);
        }));
    } else {
        promises.push(new Promise(function (resolve) {
            resolve(report.inserts);
        }));

        promises.push(new Promise(function (resolve) {
            resolve(report.updates);
        }));
    }

    if (isSummaryBundle(rightBundle)) {
        const gateway = graphman.gatewayConfiguration(rightBundle.properties.meta.gateway);

        // renew updates section using the target gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.updates, ["*"], Object.assign({}, options, {useGoids: false}), resolve, reject);
        }));
    }

    // generate report using the renewed details
    Promise.all(promises).then(results => {
        if (results.length <= 2) {
            const renewedReport = {inserts: results[0], updates: results[1], deletes: report.deletes, diffs: report.diffs, ignored: report.ignored, mappings: report.mappings};
            callback(renewedReport);
        } else {
            const renewedReport = {inserts: results[0], updates: {}, deletes: report.deletes, diffs: {}, ignored: report.ignored, mappings: {goids: [], guids: []}};
            const multiLineTextDiffExtension = utils.extension("multiline-text-diff");
            const leftUpdateBundle = results[1];
            const rightUpdateBundle = results[2];
            const extOptions = {
                ignoreMatcher: ignoreMatcher,
                multiLineTextDiffExtension: multiLineTextDiffExtension,
                summary: isSummaryBundle(leftUpdateBundle) || isSummaryBundle(rightUpdateBundle)
            };
            butils.forEach(leftUpdateBundle, (key, leftEntities, typeInfo) => {
                utils.info("re-inspecting " + key);
                diffEntities(leftEntities, rightUpdateBundle[key], mappings[key], renewedReport, typeInfo, options, extOptions);
            });

            callback(renewedReport);
        }
    }).catch(error => {
        process.exitCode = 1;
        utils.error("errors encountered while renewing the entities", error);
        utils.print();
    });
}

function renewBundle(gateway, bundle, sections, options, resolve, reject) {
    if (!gateway.address) {
        return reject(utils.newError(`${gateway.name} gateway details are missing`));
    }

    Promise.all(renewer.renew(gateway, bundle, sections, options)).then(results => {
        const renewedBundle = {};
        results.forEach(item => Object.assign(renewedBundle, item));
        resolve(butils.sort(renewedBundle));
    }).catch(error => reject(error));
}

/**
 * To identify the differences among class-of entities
 * @param leftEntities entities from left bundle
 * @param rightEntities entities from right bundle
 * @param sectionMappings section level mappings
 * @param report diff report
 * @param typeInfo type-info about class
 * @param options
 * @param extOptions extended options
 */
function diffEntities(leftEntities, rightEntities, sectionMappings, report, typeInfo, options, extOptions) {
    const findRight = entityFinder(rightEntities, typeInfo);
    const findLeft = entityFinder(leftEntities, typeInfo);

    // iterate through the left entities,
    // bucket it into diff-report, depending on the match in the right entities
    leftEntities.forEach(leftEntity => {
        const rightEntity = findRight(leftEntity);

        const ignoreRule = extOptions.ignoreMatcher(typeInfo.pluralName, leftEntity) ||
            (rightEntity ? extOptions.ignoreMatcher(typeInfo.pluralName, rightEntity) : null);

        if (rightEntity == null) {
            if (ignoreRule) {
                recordIgnored(report, typeInfo, leftEntity, "inserts", ignoreRule);
            } else {
                utils.info("  selecting " + butils.entityName(leftEntity, typeInfo) + ", category=inserts");
                const inserts = butils.withArray(report.inserts, typeInfo);
                inserts.push(leftEntity);
            }
        } else if (rightEntity.checksum === undefined) {
            utils.info("  ignoring " + butils.entityName(leftEntity, typeInfo) + ", target entity checksum is undefined");
        } else if (leftEntity.checksum === undefined || leftEntity.checksum !== rightEntity.checksum) {
            const details = [];
            const diffEntitiesEqContext = diffEntitiesBeforeEqualityCheck(leftEntity, rightEntity);

            // compare objects
            const equals = butils.isObjectEquals(leftEntity, rightEntity, "$", item => {
                details.push(extOptions.multiLineTextDiffExtension.apply({
                    path: item.path,
                    source: item.left,
                    target: item.right
                }, {operation: "diff", typeInfo: {pluralName: typeInfo.pluralName}, options: options}));
            });

            // restore policy code
            diffEntitiesAfterEqualityCheck(leftEntity, rightEntity, diffEntitiesEqContext);

            if (!equals) {
                if (details.length === 1 && details[0].path === "$.checksum" && !extOptions.summary) {
                    utils.info("  not selecting " + butils.entityName(leftEntity, typeInfo) + ", only the checksum is different");
                } else if (ignoreRule) {
                    recordIgnored(report, typeInfo, leftEntity, "updates", ignoreRule);
                } else {
                    utils.info("  selecting " + butils.entityName(leftEntity, typeInfo) + ", category=updates");
                    const updates = butils.withArray(report.updates, typeInfo);
                    updates.push(leftEntity);

                    const diffs = butils.withArray(report.diffs, typeInfo);
                    const record = butils.toPartialEntity(leftEntity, typeInfo);
                    record.details = details;
                    diffs.push(record);
                }
            } else {
                utils.info("  not selecting " + butils.entityName(leftEntity, typeInfo) + ", only the checksum is different");
            }
        }

        const sourceEntity = leftEntity;
        const targetEntity = rightEntity || findMatchingEntityByMappings(rightEntities, leftEntity, sectionMappings);
        if (targetEntity != null) {
            const targetInfo = rightEntity == null ? ", target=" + butils.entityName(targetEntity, typeInfo) : "";

            if (sourceEntity.goid && targetEntity.goid !== sourceEntity.goid) {
                utils.info(`  selecting ` + butils.entityName(sourceEntity, typeInfo) + `${targetInfo}, category=goid-mappings`);
                report.mappings.goids.push({source: sourceEntity.goid, target: targetEntity.goid});
            }

            if (sourceEntity.guid && targetEntity.guid !== sourceEntity.guid) {
                utils.info(`  selecting ` + butils.entityName(sourceEntity, typeInfo) + `${targetInfo}, category=guid-mappings`);
                report.mappings.guids.push({source: sourceEntity.guid, target: targetEntity.guid});
            }
        }
    });

    //Now, iterate through the right entities
    // find the un-matched ones w.r.t. left entities, and bucket them into diff-report
    if (rightEntities) rightEntities.forEach(rightEntity => {
        if (!findLeft(rightEntity)) {
            const rule = extOptions.ignoreMatcher(typeInfo.pluralName, rightEntity);
            if (rule) return recordIgnored(report, typeInfo, rightEntity, "deletes", rule);

            utils.info("  selecting " + butils.entityName(rightEntity, typeInfo) + ", category=deletes");
            const deletes = butils.withArray(report.deletes, typeInfo);
            deletes.push(rightEntity);
        }
    });
}

/**
 * Builds a lookup function that finds the first matching entity from the given list.
 * Uses a hash index when the type has a single identity field; falls back to a linear scan otherwise.
 */
function entityFinder(entities, typeInfo) {
    if (!entities) return () => null;

    if (typeInfo.identityFields.length === 1) {
        const field = typeInfo.identityFields[0];
        const index = new Map();
        entities.forEach(item => {
            if (!index.has(item[field])) index.set(item[field], item);
        });
        return probe => index.get(probe[field]) || null;
    }

    return probe => entities.find(x => butils.isEntityMatches(probe, x, typeInfo)) || null;
}

/**
 * Makes the entities comparison friendly.
 * If entity possesses policy code, it will be re-written as string.
 * @param leftEntity
 * @param rightEntity
 * @returns code-ref object
 */
function diffEntitiesBeforeEqualityCheck(leftEntity, rightEntity) {
    const context = {modified: false, left: {}, right: {}};

    // capture policy code and re-write it as string for comparison friendly
    context.modified |= diffEntityBeforeEqualityCheck(leftEntity, context.left);
    context.modified |= diffEntityBeforeEqualityCheck(rightEntity, context.right);

    return context;
}

/**
 * Restores the entities using context.
 * @param leftEntity
 * @param rightEntity
 * @param context
 */
function diffEntitiesAfterEqualityCheck(leftEntity, rightEntity, context) {
    if (context.modified) {
        diffEntityAfterEqualityCheck(leftEntity, context.left);
        diffEntityAfterEqualityCheck(rightEntity, context.right);
    }
}

function diffEntityBeforeEqualityCheck(entity, context) {
    let modified = false;

    if (entity.policy) {
        if (entity.policy.code) {
            context.policyCode = entity.policy.code;
            entity.policy.code = JSON.stringify(entity.policy.code, null, 4);
            modified = true;
        }

        if (entity.policy.json) {
            context.policyJson = entity.policy.json;
            entity.policy.json = JSON.stringify(JSON.parse(entity.policy.json), null, 4);
            modified = true;
        }
    }

    return modified;
}

function diffEntityAfterEqualityCheck(entity, context) {
    if (context.policyCode) entity.policy.code = context.policyCode;
    if (context.policyJson) entity.policy.json = context.policyJson;
}

function diffBundle(report, bundle, options, verbose) {
    if (options.includeInserts) butils.forEach(report.inserts, (key, entities, typeInfo) => {
        if (verbose) utils.info(`adding ${key}, category=inserts`);
        const array = butils.withArray(bundle, typeInfo);
        entities.forEach(item => {
            if (verbose) utils.info(`  ${butils.entityName(item, typeInfo)}`);
            array.push(item);
        });
    });

    if (options.includeUpdates) butils.forEach(report.updates, (key, entities, typeInfo) => {
        if (verbose) utils.info(`adding ${key}, category=updates`);
        const array = butils.withArray(bundle, typeInfo);
        entities.forEach(item => {
            if (verbose) utils.info(`  ${butils.entityName(item, typeInfo)}`);
            array.push(item);
        });
    });

    if (options.includeDeletes) butils.forEach(report.deletes, (key, entities, typeInfo) => {
        if (verbose) utils.info(`adding ${key}, category=deletes`);

        initializeBundleProperties(bundle);
        const array = butils.withArray(bundle, typeInfo);
        const array2 = butils.withArray(bundle.properties.mappings, typeInfo);
        entities.forEach(item => {
            if (verbose) utils.info(`  ${butils.entityName(item, typeInfo)}`);
            if (!options.useNoDefMappings) array.push(item);
            array2.push(butils.mappingInstruction('DELETE', item, typeInfo, {nodef: options.useNoDefMappings}));
        });

        if (array.length === 0) delete bundle[typeInfo.pluralName];
        if (array2.length === 0) delete bundle.properties.mappings[typeInfo.pluralName];
    });

    butils.reviseIDReferences(bundle, report.mappings);
}

function initializeBundleProperties(bundle) {
    if (!bundle.properties) bundle.properties = {};
    if (!bundle.properties.mappings) bundle.properties.mappings = {};
}

function findMatchingEntityByMappings(rightEntities, leftEntity, mappings) {
    const mapping = rightEntities && mappings ?
        mappings.find(item => isMappingMatches(item, leftEntity)) : null;
    return mapping ?
        rightEntities.find(x => isMappingMatches(mapping, x, true)) : null;
}

function isMappingMatches(mapping, entity, fromTarget) {
    const ref = fromTarget ? mapping.target : mapping.source;
    const fields = Object.keys(ref);

    for (const field of fields) {
        const expected = ref[field];
        const actual = entity[field];

        if (typeof expected === "string" && typeof actual === "string") {
            if (expected.startsWith("regex:")) {
                const pattern = expected.substring("regex:".length);
                if (!actual.match(pattern)) {
                    return false;
                }
            } else {
                if (expected !== actual) {
                    return false;
                }
            }
        } else if (typeof expected === "object" && typeof actual === "object") {
            if (!butils.isObjectEquals(expected, actual)) {
                return false;
            }
        } else if (expected !== actual) {
            return false;
        }
    }

    return fields.length > 0;
}
