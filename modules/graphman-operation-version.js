// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const graphman = require("./graphman");
const utils = require("./graphman-utils");

module.exports = {
    /**
     * Prints the version details.
     * @param params
     */
    run: function (params) {
        const config = graphman.configuration();
        utils.print("graphman client " + config.version);
        utils.print(`  schema ${config.schemaVersion}`);
        utils.print(`  supported schema(s) [${config.supportedSchemaVersions.join(', ')}]`);
        utils.print(`  supported extension(s) [${config.supportedExtensions.join(', ')}]`);
        utils.print("  home " + utils.wrapperHome());
        utils.print("  github " + graphman.githubLink());
        utils.print();
    },

    initParams: function (params, config) {
        //do nothing
        return params;
    },

    paramsSchema: {},

    usage: function () {
        // do nothing
    }
}
