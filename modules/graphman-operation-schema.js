// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");

module.exports = {
    /**
     * Available GraphQL schema files will be processed to work with graphman configuration using GraphQL types
     * @param params
     * @param params.refresh
     */
    run: function (params) {
        if (params.refresh || params.options.refresh) {
            graphman.refreshSchemaMetadata();
            utils.info("pre-compiled schema is refreshed");
        }

        const metadata = graphman.schemaMetadata();
        utils.info("schema " + metadata.schemaVersion);
        utils.info("available entity types:");
        Object.keys(metadata.types).sort().forEach(key => {
            const typeInfo = metadata.types[key];
            if (typeInfo.isL7Entity) utils.print(`         ${key} - ${typeInfo.pluralName}` + (typeInfo.isL7Entity && typeInfo.deprecated ? " (deprecated)" : ""));
        });
        utils.print();
    },

    initParams: function (params, config) {
        params.options = Object.assign({refresh: false}, params.options);
        return params;
    },

    paramsSchema: {
        refresh: "boolean",
        options: {
            refresh: "boolean"
        }
    },

    usage: function () {
        console.log("schema");
        console.log("  [--refresh true|false]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("GraphQL schema will be pre-compiled and serialized to schema/metadata.json file.");
        console.log();
        console.log("  --refresh true|false");
        console.log("    true to refresh the pre-compiled schema");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .refresh false|true");
        console.log("        to refresh the pre-compiled schema");
    }
}
