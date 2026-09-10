// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

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
            bundles.push(readBundleFrom(params["input-source"]));
            bundles.push(readBundleFrom(params["input-target"]));

            const mappingsFile = params["input-mappings"];
            const inputMappings = mappingsFile ? utils.readFile(params["input-mappings"]) : {};

            Promise.all(bundles).then(results => {
                const leftBundle = results[0];
                const rightBundle = results[1];
                const report = {inserts: {}, updates: {}, deletes: {}, diffs: {}, mappings: {goids: [], guids: []}};

                diffReport(leftBundle, rightBundle, inputMappings.mappings || {}, report, params.options);
                if (params.options.renewEntities) {
                    diffRenewReport(leftBundle, rightBundle, inputMappings.mappings || {}, report, params.options, renewedReport => {
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
        params.options = Object.assign({includeInserts: true, includeUpdates: true, includeDeletes: false}, params.options);

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

    usage: function () {
        console.log("diff --input-source <input-file-or-gateway> --input-target <input-file-or-gateway>");
        console.log("  [--input-mappings <input-mappings-file>]");
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
        console.log("      .logSink stdout|stderr");
        console.log("        directs the log messages to the chosen sink.");
        console.log("        use 'stderr' (or .log nolog) when piping the output to another command.");
        console.log();
    }
}

function readBundleFrom(fileOrGateway) {
    if (fileOrGateway.startsWith('@')) {
        const gateway = graphman.gatewayConfiguration(fileOrGateway.substring(1));
        if (!gateway.address) throw utils.newError(`${gateway.name} gateway details are missing`);
        return readBundleFromGateway(gateway);
    } else {
        return Promise.resolve(utils.readFile(fileOrGateway));
    }
}

function readBundleFromGateway(gateway) {
    return new Promise(function (resolve, reject) {
        utils.info(`retrieving ${gateway.name} gateway configuration summary`);
        try {
            exporter.export(
                gateway,
                gql.generate("all:summary", {}, graphman.configuration().options),
                data => {
                    if (data.errors) {
                        utils.warn(`errors detected while retrieving ${gateway.name} gateway configuration summary`);

                        // if there's no data, report the errors via reject; otherwise, log them and proceed.
                        if (!data.data) {
                            reject(data.errors);
                        } else {
                            utils.error("errors encountered while analyzing the differences", data.errors);
                        }
                    }

                    const bundle = data.data || {};
                    bundle.properties = bundle.properties || {};
                    bundle.properties.meta = bundle.properties.meta || {};
                    bundle.properties.meta.summary = true;
                    bundle.properties.meta.gateway = gateway.name;
                    resolve(bundle);
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

function diffReport(leftBundle, rightBundle, mappings, report, options) {
    const multiLineTextDiffExtension = utils.extension("multiline-text-diff");
    const extOptions = {
        multiLineTextDiffExtension: multiLineTextDiffExtension,
        summary: isSummaryBundle(leftBundle) || isSummaryBundle(rightBundle)
    };

    butils.forEach(leftBundle, (key, leftEntities, typeInfo) => {
        utils.info("inspecting " + key);
        diffEntities(leftEntities, rightBundle[key], mappings[key], report, typeInfo, options, extOptions);
    });

    butils.forEach(rightBundle, (key, rightEntities, typeInfo) => {
        const leftEntities = leftBundle[key];
        if (!leftEntities || leftEntities.length === 0) {
            utils.info("inspecting " + key);
            rightEntities.forEach(rightEntity => {
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
    return report;
}

function isSummaryBundle(bundle) {
    return bundle.properties && bundle.properties.meta && bundle.properties.meta.summary;
}

function diffRenewReport(leftBundle, rightBundle, mappings, report, options, callback) {
    let promises = [];

    if (isSummaryBundle(leftBundle)) {
        const gateway = graphman.gatewayConfiguration(leftBundle.properties.meta.gateway);

        // renew inserts section using the source gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.inserts, ["*"], Object.assign(options, {useGoids: true}), resolve, reject);
        }));

        // renew updates section using the source gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.updates, ["*"], Object.assign(options, {useGoids: true}), resolve, reject);
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
            renewBundle(gateway, report.updates, ["*"], Object.assign(options, {useGoids: false}), resolve, reject);
        }));
    }

    // generate report using the renewed details
    Promise.all(promises).then(results => {
        if (results.length <= 2) {
            const renewedReport = {inserts: results[0], updates: results[1], deletes: report.deletes, diffs: report.diffs, mappings: report.mappings};
            callback(renewedReport);
        } else {
            const renewedReport = {inserts: results[0], updates: {}, deletes: report.deletes, diffs: {}, mappings: {goids: [], guids: []}};
            const multiLineTextDiffExtension = utils.extension("multiline-text-diff");
            const leftUpdateBundle = results[1];
            const rightUpdateBundle = results[2];
            const extOptions = {
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
        utils.error("errors encountered while renewing the entities", error);
        utils.print();
    });
}

function renewBundle(gateway, bundle, sections, options, resolve, reject) {
    if (!gateway.address) {
        reject(utils.newError(`${gateway.name} gateway details are missing`));
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
    // iterate through the left entities,
    // bucket it into diff-report, depending on the match in the right entities
    leftEntities.forEach(leftEntity => {
        const rightEntity = rightEntities ?
            rightEntities.find(x => butils.isEntityMatches(leftEntity, x, typeInfo)) : null;

        if (rightEntity == null) {
            utils.info("  selecting " + butils.entityName(leftEntity, typeInfo) + ", category=inserts");
            const inserts = butils.withArray(report.inserts, typeInfo);
            inserts.push(leftEntity);
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
        if (!leftEntities.find(x => butils.isEntityMatches(x, rightEntity, typeInfo))) {
            utils.info("  selecting " + butils.entityName(rightEntity, typeInfo) + ", category=deletes");
            const deletes = butils.withArray(report.deletes, typeInfo);
            deletes.push(rightEntity);
        }
    });
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
