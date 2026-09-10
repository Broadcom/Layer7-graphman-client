// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");

module.exports = {
    /**
     * Slices a bundle as per the choice.
     * @param params
     * @param params.input input bundle file
     * @param params.sections one or more sections of bundle
     * @param params.filter section specific filters
     * @param params.output output bundle
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameters are missing";
        }

        const bundle = utils.readFile(params.input);
        const result = {};

        if (Array.isArray(params.sections)) for (let section of params.sections) {
            if (section === "*") {
                Object.assign(result, bundle);
            } else if (section.startsWith("-")) {
                section = section.substring(1);

                const typeInfo = graphman.typeInfoByPluralName(section);
                if (typeInfo) {
                    utils.info("removing " + section);
                    delete result[section];
                } else {
                    utils.warn("unknown section " + section);
                }
            } else {
                if (section.startsWith("+")) {
                    section = section.substring(1);
                }

                const typeInfo = graphman.typeInfoByPluralName(section);
                if (typeInfo) {
                    utils.info("adding " + section);
                    if (bundle.hasOwnProperty(section)) {
                        result[section] = bundle[section];
                    }
                } else {
                    utils.warn("unknown section " + section);
                }
            }
        }

        butils.filter(result, params.filter);
        utils.writeResult(params.output, butils.sort(result));
    },

    initParams: function (params, config) {
        if (!params.sections) {
            params.sections = [];
        }

        if (!Array.isArray(params.sections)) {
            params.sections = [params.sections];
        }

        return params;
    },

    usage: function () {
        console.log("slice --input <input-file> [--sections <section> <section>...]");
        console.log("  [--output <output-file>]");
        console.log("  [--filter.<section>.<field-name> <matching-criteria> <field-value>,...]");
        console.log();
        console.log("Slices the bundle as per the choice.");
        console.log("When similar entities are encountered, entities from the rightmost bundle takes the precedence.");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify the name of input bundle file that contains gateway configuration");
        console.log("    use '-' to read the bundle from the standard input");
        console.log();
        console.log("  --sections <section> <section> ...");
        console.log("    specify one or more sections of the bundle for inclusion");
        console.log("    section refers to the plural name of the entity type");
        console.log("    * is a special section name, used to refer all the sections of a bundle");
        console.log("    use '-' prefix to exclude the section");
        console.log();
        console.log("  --filter.<section>.<field-name> [<matching-criteria>] <field-value>");
        console.log("    use this option to filter the entities by one or more fields at section level");
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
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the combined gateway configuration as bundle");
        console.log("    when skipped, output will be written to the console.");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .logSink stdout|stderr");
        console.log("        directs the log messages to the chosen sink.");
        console.log("        use 'stderr' (or .log nolog) when piping the output to another command.");
        console.log();
    }
}
