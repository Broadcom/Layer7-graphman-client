// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");
const gql = require("./graphql-query");
const summary = require("./graphman-summary");

module.exports = {
    /**
     * Exports gateway configuration using a specified query. If the query doesn't exist, client tries to generate a query dynamically.
     * @param params
     * @param params.query query (alias: params.using, deprecated)
     * @param params.queries two or more query names to be combined into a single composite query
     * @param params.queryArgs overrides for disambiguating colliding argument names across queries
     * @param params.variables name-value pairs used in querying the configuration
     * @param params.gateway name of the gateway profile
     * @param params.output name of the output file
     * @param params.filter used to filter the exported configuration
     * @param params.options name-value pairs used to customize export operation
     */
    run: function (params) {
        const gateway = graphman.gatewayConfiguration(params.gateway);

        if (!gateway.address) {
            throw utils.newError(`${gateway.name} gateway details are missing`);
        }

        let query;
        if (params.queries && params.queries.length > 0) {
            const dupes = params.queries.filter((name, index) => params.queries.indexOf(name) !== index);
            if (dupes.length > 0) {
                throw utils.newError("duplicate query name(s) in --queries: " + dupes.join(", "));
            }

            query = gql.generateComposite(params.queries, params.variables, params.options, params.queryArgs);
        } else {
            query = gql.generate(params.using, params.variables, params.options);
        }

        const startDate = Date.now();

        utils.fine("start time: " + startDate);
        this.export(gateway, query, (data, parts, opContext) => {
            const endDate = Date.now();
            if (params.onExportDataCallback) {
                params.onExportDataCallback(data, parts, params, opContext, endDate, startDate);
            } else {
                onExportDataCallback(data, parts, params, opContext, endDate, startDate);
            }
        });
    },

    export: function (gateway, query, callback) {
        if (!query.query.startsWith("query")) {
            utils.info("invalid query for export operation", query);
            throw "invalid query for export operation";
        }

        utils.info(`exporting from ${gateway.name||gateway.address} gateway`);
        const opContext = utils.buildOperationContext("export", gateway, query.options);
        const request = graphman.request(gateway, query.options);
        delete query.options;
        request.body = query;
        graphman.invoke(request, opContext, callback);
    },

    initParams: function (params, config) {
        if (params.query !== undefined) {
            params.using = params.query;
        } else if (params.using !== undefined) {
            utils.warn("--using is deprecated, use --query instead");
        }

        params = Object.assign({
            using: "all",
            gateway: "default"
        }, params);

        params.variables = params.variables || {};
        params.options = Object.assign({
            bundleDefaultAction: "NEW_OR_UPDATE",
            excludeDependencies: false,
            excludeGoids: false,
            includePolicyRevisions: false
        }, config.options, params.options);

        if (params.variables.includePolicyRevisions === undefined) {
            params.variables.includePolicyRevisions = params.options.includePolicyRevisions;
        }

        params.options.mappings = utils.mappings({});

        // special post processing for encass query
        if (params.using === "encass" || params.using.startsWith("encass:")) {
            params.variables.policyName = params.variables.policyName || params.variables.name || "?";

            const operation = this;
            params.onExportDataCallback = function (data, parts, params, opContext, endDate, startDate) {
                const encassConfigByName = data.data ? data.data.encassConfigByName : null;
                const policyByName = data.data ? data.data.policyByName : null;

                if (!encassConfigByName || !encassConfigByName.policyName) {
                    if (policyByName) {
                        delete data.data.policyByName;
                    }

                    onExportDataCallback(data, parts, params, opContext, endDate, startDate);
                    return;
                }

                // retry export operation if encass policy is not retrieved in the first attempt
                if (!policyByName || !policyByName.name) {
                    delete params.onExportDataCallback;
                    utils.info("retrying export operation to retrieve encass and it's backing policy details")
                    params.variables.policyName = encassConfigByName.policyName;
                    operation.run(params);
                    return;
                }

                onExportDataCallback(data, parts, params, opContext, endDate, startDate);
            };
        }

        return params;
    },

    paramsSchema: {
        using: "string",
        query: "string",
        queries: "array",
        queryArgs: "opaque",
        gateway: "string",
        output: "string",
        filter: "opaque",
        options: {
            bundleDefaultAction: "string",
            excludeDependencies: "boolean",
            excludeGoids: "boolean",
            includePolicyRevisions: "boolean",
            includeMultipartFields: "boolean",
            excludeRolesIfRequired: "boolean",
            mappings: "opaque",
            logSink: "string"
        }
    },

    usage: function () {
        console.log("export [--query <query>] [--queries <query> <query> ...] [--variables.<name> <value>,...] [--gateway <name>]");
        console.log("  [--output <output-file>]");
        console.log("  [--filter.<section>.<field-name> <matching-criteria> <field-value>,...]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Exports gateway configuration using a specified query. If the query doesn't exist, client tries to generate a query dynamically.");
        console.log("If no query is specified, it will be defaulted to the 'all' query.");
        console.log();
        console.log("  --query <query>");
        console.log("    specify the name of query used to export");
        console.log();
        console.log("  --queries <query> <query> ...");
        console.log("    specify two or more query names to be combined into a single composite query, and export using it");
        console.log("    when two or more of the combined queries declare the same argument name (e.g. $name),");
        console.log("    the later one(s) are automatically renamed by appending their 1-based position (e.g. $name2)");
        console.log();
        console.log("  --queryArgs.<position>.<arg-name> <new-arg-name>");
        console.log("    override the automatic <arg-name><position> disambiguation for the query at the given");
        console.log("    1-based position in --queries, either to give it a more meaningful name, or, by pointing");
        console.log("    it back to a name already used by another query, to deliberately share that argument");
        console.log();
        console.log("  (deprecated) --using <query>");
        console.log("    use --query instead");
        console.log();
        console.log("  --variables.<name> <value>");
        console.log("    specify the name-value pair(s) for the variables section of the query used to export");
        console.log();
        console.log("  --gateway <name>");
        console.log("    specify the name of gateway profile from the graphman configuration.");
        console.log("    when skipped, defaulted to the 'default' gateway profile.");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the name of file to capture the exported configuration.");
        console.log("    when skipped, output will be written to the console.");
        console.log();
        console.log("  --filter.<section>.<field-name> [<matching-criteria>] <field-value>");
        console.log("    use this option to filter the exported entities by one or more fields at section level");
        console.log("    section refers to the plural name of the entity type");
        console.log("    multiple fields used for section-level filtering will be chained together by and-logic");
        console.log("    supported matching criteria are");
        console.log("      eq, equals");
        console.log("      neq, not equals");
        console.log("      regex, regular expression");
        console.log("      gt, greater than");
        console.log("      lt, less than");
        console.log("      gte, greater than or equals");
        console.log("      lte, less than or equals");
        console.log("    default matching criteria is [eq].");
        console.log();
        console.log("  (deprecated) --filter.by <field-name>");
        console.log("    use this option to filter the exported entities by some field.");
        console.log("    refer the --filter.<section>.<field-name> for alternative");
        console.log();
        console.log("  (deprecated) --filter.[equals|startsWith|endsWith|contains] <value>");
        console.log("    use this option to choose the matching criteria to filter the exported entities");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .bundleDefaultAction <action>");
        console.log("        default mapping action at the bundle level.");
        console.log("      .includePolicyRevisions false|true");
        console.log("        use this option to include policy revisions for the exported service/policy entities.");
        console.log("      .includeMultipartFields false|true");
        console.log("        use this option to include multipart fields (filePartName) so that server module file will be fully exported.");
        console.log("      .excludeRolesIfRequired false|true");
        console.log("        use this option to exclude roles with no user and group assignees.");

        console.log("      .excludeDependencies false|true");
        console.log("        use this option to exclude dependency entities from the exported bundled entities.");
        console.log("      .excludeGoids false|true");
        console.log("        use this option to exclude Goids from the exported bundled entities.");
        console.log();
    }
}

function onExportDataCallback(data, parts, params, opContext, endDate, startDate) {
    if (data.data) {
        if (data.errors) utils.warn("errors detected", data.errors);

        data = butils.sanitize(data.data, butils.EXPORT_USE, params.options);
        data = butils.removeDuplicates(data);
        butils.filter(data, params.filter);
        data = utils.extension("post-export").apply(data, opContext);
        const sortedData = butils.sort(data);
        utils.writeResult(params.output, sortedData);

        if (parts) utils.writePartsResult(utils.parentPath(params.output), parts);

        summary.report("export", sortedData, startDate, endDate);
    } else {
        utils.info("unexpected data", data);
    }
}
