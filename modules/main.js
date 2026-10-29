// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");

module.exports = {
    call: function (home, op, args) {
        try {
            const params = parse(args);
            params.options = params.options || {};

            // initialize configuration and schema metadata
            graphman.init(home, params);

            if (!op) {
                utils.error("operation is missing");
                utils.print("  supported operations:");
                graphman.supportedOperations()
                    .forEach(item => utils.print("    " + item));
                utils.print();
                utils.print("  usage: <operation> <parameter>,...");
                utils.print("  usage: <operation> --help");
                utils.print("  github: " + graphman.githubLink());
                utils.print();
            } else {
                let operation = findOperation(graphman, op);
                if (params.help) {
                    operation.usage();
                } else {
                    require("./args-validator").validate(params, args.slice(1), operation);
                    const config = graphman.configuration();
                    utils.extensions(config.options.extensions);
                    operation.run(operation.initParams(params, config));
                }
            }
        } catch (e) {
            if (typeof e === 'string') {
                utils.error(e);
                utils.print();
            } else if (typeof e === 'object' && e.name === 'GraphmanOperationError') {
                utils.error(e.message);
                utils.print();
            } else {
                utils.error("error encountered while processing the graphman operation");
                utils.error(`  name: ${e.name}`);
                utils.error(`  message: ${e.message}`);
                utils.logAdditionalErrorDetails(e);
                utils.print();
            }
        }
    }
}

function findOperation(graphman, name) {
    if (!graphman.supportedOperations().includes(name)) {
        throw "unsupported operation: " + name;
    } else {
        return require("./graphman-operation-" + name);
    }
}

function parse(args) {
    return require("./args-parser").parse(args.slice(1));
}
