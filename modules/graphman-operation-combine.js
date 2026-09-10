/*
 * Copyright (c)  2026. Broadcom Inc. and its subsidiaries. All Rights Reserved.
 */

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Combines two or more bundles into one.
     * @param params
     * @param params.inputs two or more input bundle file(s)
     * @param params.output output bundle
     */
    run: function (params) {
        if (!params.inputs) {
            throw "--inputs parameters are missing";
        }

        if (!Array.isArray(params.inputs) || params.inputs.length < 2) {
            throw "not enough input bundles, operation requires at least two bundles";
        }

        let bundle = {};
        for (const item of params.inputs) {
            utils.info("processing " + item);
            bundle = combine(bundle, utils.readFile(item));
        }

        utils.writeResult(params.output, butils.sort(bundle));
    },

    initParams: function (params, config) {
        // do nothing
        return params;
    },

    usage: function () {
        console.log("combine --inputs <input-file> <input-file> ...");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Combines two or more bundles into one.");
        console.log("When similar entities are encountered, entities from the rightmost bundle takes the precedence.");
        console.log();
        console.log("  --inputs <input-file> <input-file> ...");
        console.log("    specify two or more input bundles file(s)");
        console.log("    use '-' in place of one of the file names to read that bundle from the standard input");
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

/**
 * Combines left and right bundles into result bundle.
 * Right bundled entities take precedence.
 * @param left left bundle
 * @param right right bundle
 * @returns result bundle
 */
function combine(left, right) {
    const result = combineEntities(left, right);
    combineProperties(result, left, right);
    return result;
}

/**
 * Merges entities from left and right bundles into a new bundle.
 * Right bundle entities are copied first; non-duplicate entities from left are added.
 * @param left left bundle
 * @param right right bundle
 * @returns new bundle containing merged entities only (no properties)
 */
function combineEntities(left, right) {
    const result = {};

    // copy entities from right
    butils.forEach(right, (key, entities, typeInfo) => {
        const list = butils.withArray(result, typeInfo);
        entities.forEach(item => list.push(item));
    });

    // copy non-duplicate entities from left
    butils.forEach(left, (key, entities, typeInfo) => {
        const list = butils.withArray(result, typeInfo);
        entities.forEach(item => {
            const found = list.find(x => butils.isEntityMatches(x, item, typeInfo));
            if (!found) {
                list.push(item);
            }
        });
    });

    return result;
}

/**
 * Merges properties and mappings from left and right bundles into result.
 * Right bundle properties and mappings take precedence.
 * @param result bundle to receive merged properties
 * @param left left bundle
 * @param right right bundle
 */
function combineProperties(result, left, right) {
    const leftProperties = (left && left.properties) ? left.properties : {};
    const rightProperties = (right && right.properties) ? right.properties : {};

    result.properties = Object.assign({}, leftProperties);

    if (rightProperties.defaultAction) {
        result.properties.defaultAction = rightProperties.defaultAction;
    }

    const leftMappings = leftProperties.mappings || {};
    const rightMappings = rightProperties.mappings || {};
    const mappings = combineMappings(leftMappings, rightMappings);
    if (mappings && Object.keys(mappings).length > 0) {
        result.properties.mappings = mappings;
    }
}


/**
 * Combines left and right bundle mappings into result bundle.
 * Right bundled mappings take precedence.
 * @param left left bundle
 * @param right right bundle
 * @returns result bundle
 */
function combineMappings(left, right) {
    const result = {};

    // copy mappying from right
    butils.forEach(right, (key, entityMappings, typeInfo) => {
        const list = butils.withArray(result, typeInfo);
        entityMappings.forEach(item => list.push(item));
    });

    // copy non-duplicate entity mappings from left
    butils.forEach(left, (key, entityMappings, typeInfo) => {
        const list = butils.withArray(result, typeInfo);
        entityMappings.forEach(item => {
            const found = list.find(x => {
                if (x.source && item.source) {
                    return butils.isEntityMatches(x.source, item.source, typeInfo)
                } else if (item.default && x.default) {
                    return true;
                }
                return false;
            });
            if (!found) {
                list.push(item);
            }
        });
    });
    return result;
}
