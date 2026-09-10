// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Defines mapping instructions for the bundled entities
     * @param params
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        let inputBundle = utils.readFile(params.input);
        inputBundle = butils.removeDuplicates(inputBundle);

        const mappings = utils.mappings(params.mappings);

        const data = butils.sanitize(inputBundle, butils.EXPORT_USE, {
            bundleDefaultAction: params.options.bundleDefaultAction,
            mappings: mappings
        });

        utils.writeResult(params.output, data);
    },

    initParams: function (params, config) {
        //do nothing
        return params;
    },

    usage: function () {
        console.log("mappings --input <input-file>");
        console.log("  [--output <output-file>]");
        console.log("  [<options>]");
        console.log();

        console.log("Defines mapping instructions for the bundled entities.");
        console.log();

        console.log("  --input <input-file>");
        console.log("    specify the name of input bundle file that contains gateway configuration");
        console.log("    use '-' to read the bundle from the standard input");
        console.log();

        console.log("  --output <output-file>");
        console.log("    specify the name of file to capture the bundle along with the mapping instructions.");
        console.log("    when skipped, output will be written to the console.");
        console.log();

        console.log("  --mappings.action <action>");
        console.log("    mapping action for any entity.");
        console.log();

        console.log("  --mappings.<entity-type-plural-name>.action <action>");
        console.log("    mapping action for the specified class of entities. This option can be repeatable.");
        console.log();

        console.log("  --mappings.level <0|1|2>");
        console.log("    mapping level for any entity. Here, 0=no mappings, 1=entity level (excluding dependent entities), 2=all entities");
        console.log();

        console.log("  --mappings.<entity-type-plural-name>.level <0|1|2>");
        console.log("    mapping level for the specified  class of entities. Here, 0=no mappings, 1=entity level (excluding dependent entities), 2=all entities");
        console.log();

        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .bundleDefaultAction <action>");
        console.log("        default mapping action at the bundle level.");
        console.log("      .logSink stdout|stderr");
        console.log("        directs the log messages to the chosen sink.");
        console.log("        use 'stderr' (or .log nolog) when piping the output to another command.");
        console.log();
        console.log("    NOTE:");
        console.log("      In the above, <action> refers to a valid entity mapping action.");
        console.log("      Permitted values are NEW_OR_UPDATE, NEW_OR_EXISTING, ALWAYS_CREATE_NEW, DELETE and IGNORE");
        console.log();
    }
};
