// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");
const gql = require("./graphql-query");

module.exports = {
    /**
     * Describes queries
     * @param params
     * @param params.query query name
     * @param params.options
     */
    run: function (params) {
        if (params.query) {
            describeQuery(params.query, params.options);
        } else {
            printAvailableQueries();
        }
    },

    initParams: function (params, config) {
        params.options = Object.assign({},
            config.options,
            params.options);
        return params;
    },

    usage: function () {
        console.log("describe [--query <query-name>]");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Describes queries about their fields, arguments, etc.");
        console.log();
        console.log("  --query <query-name>");
        console.log("    specify query name with/without wild-cards");
        console.log("    when no query name is specified, it lists out all the available queries")
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the important part of the described result");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log();
    }
}

function isMutationBasedQuery(path) {
    if (utils.existsFile(path)) {
        return utils.readFile(path).trim().startsWith("mutation");
    }
}

function availableQueries(callback) {
    const queries = [];
    const paths = utils.queryDirs(graphman.configuration().schemaVersion);

    paths.forEach(path => {
        if (utils.existsFile(path)) availableQueriesIn(path, (name, isMutation) => {
            if (!queries.includes(name)) {
                callback(name, isMutation);
                queries.push(name);
            }
        });
    });
}

function availableQueriesIn(path, callback) {
    utils.listDir(path).forEach(item => {
        if (item.endsWith(".json")) {
            const name = item.substring(0, item.length - 5);
            const isMutation = isMutationBasedQuery(utils.path(path, name + ".gql"));
            callback(name, isMutation);
        }
    });
}

function describeQuery(queryName, options) {
    utils.info("query", queryName);
    if (queryName.indexOf("*") === -1) {
        const query = gql.generate(queryName, {}, Object.assign({describeQuery: true}, options));
        utils.print(query.query);
    } else {
        const queryNames = graphman.queryNamesByPattern(queryName);
        if (queryNames.length === 0) {
            utils.info("no matches found");
        } else if (queryNames.length === 1) {
            const query = gql.generate(queryNames[0], {}, Object.assign({describeQuery: true}, options));
            utils.print(query.query);
        } else {
            utils.info(`${queryNames.length} matches found`);
            Array.from(queryNames).forEach(item => utils.print(`         ${item}`));
        }
    }
    utils.print();
}

function printAvailableQueries() {
    utils.info("available queries:");
    const mutations = [];
    availableQueries((name, isMutation) => {
        if (!isMutation) utils.print(`         ${name}`);
        else mutations.push(name);
    });
    utils.print();

    utils.info("available mutations:");
    Array.from(mutations).forEach(name => utils.print(`         ${name}`));
    utils.print();

    utils.info("available in-built queries:");
    const metadata = graphman.schemaMetadata();
    metadata.types["Query"].fields.forEach(fieldInfo => {
        utils.print(`         ${fieldInfo.name}`);
    });
    utils.print();

    utils.info("available in-built mutations:");
    metadata.types["Mutation"].fields.forEach(fieldInfo => {
        utils.print(`         ${fieldInfo.name}`);
    });
    utils.print();
}
