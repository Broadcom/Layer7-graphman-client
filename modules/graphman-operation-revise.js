// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const reviser = require("./graphql-entity-reviser");
const graphman = require("./graphman");

module.exports = {
    /**
     * Revises the input bundle as per the options.
     * @param params
     * @param params.input input bundle
     * @param params.output output bundle
     * @param params.options name-value pairs used to customize revise operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        let bundle = utils.readFile(params.input);

        if (params.options.normalize) {
            bundle = butils.sanitize(bundle, butils.IMPORT_USE, params.options);
            bundle = butils.removeDuplicates(bundle);
        }

        this.revise(bundle, params.options);

        const schemaVersion = graphman.configuration().schemaVersion;
        const opContext = utils.buildOperationContext("revise", null, params.options);
        opContext.schemaVersion = schemaVersion;
        bundle = utils.extension("post-revise").apply(bundle, opContext);

        utils.writeResult(params.output, butils.sort(bundle));
    },

    revise: function (bundle, options) {
        // remove properties section from the bundle temporarily
        const properties = bundle.properties;
        if (properties) delete bundle.properties;

        bundle = reviser.revise(bundle, options);

        // restore properties section so that it appears at the end
        if (properties) bundle.properties = properties;
        return bundle;
    },

    initParams: function (params, config) {
        params.options = Object.assign({
            normalize: false,
            excludeGoids: false
        }, params.options);

        return params;
    },

    usage: function () {
        console.log("revise --input <input-file>");
        console.log("  [--output <output-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Revises the input bundle as per the specified options.");
        console.log("  supports revising the bundle as per the schema changes");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify the name of input bundle file that contains gateway configuration");
        console.log("    use '-' to read the bundle from the standard input");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the name of file to capture the revised version of bundle.");
        console.log("    when skipped, output will be written to the console.");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .normalize false|true");
        console.log("        use this option to normalize/sanitize the bundle for import ready.");
        console.log("      .excludeGoids");
        console.log("        use this option to exclude Goids from the bundled entities. This option is applicable only when normalize option is selected.");
        console.log("      .logSink stdout|stderr");
        console.log("        directs the log messages to the chosen sink.");
        console.log("        use 'stderr' (or .log nolog) when piping the output to another command.");
    }
}
