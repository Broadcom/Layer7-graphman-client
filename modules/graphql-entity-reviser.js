// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");

const revisers = [
    require("./graphql-entity-reviser-v11.1.0")
];

 module.exports = {
     /**
      * Revises the bundle entities
      * @param bundle input bundle to be revised
      * @param options
      * @returns {*}
      */
    revise: function (bundle, options) {
        const schemaVersion = graphman.configuration().schemaVersion;
        const orderedSchemaVersions = graphman.configuration().orderedSchemaVersions;
        for (const  reviser of revisers) {
            if (compareSchemaVersions(reviser.schemaVersion, schemaVersion, orderedSchemaVersions) <= 0) {
                utils.info("applying schema reviser: ", reviser.schemaVersion);
                reviser.revise(bundle, options);
            }
        }

        return bundle;
    }
 }

 function compareSchemaVersions(version1, version2, list) {
    let index1 = list.indexOf(version1);
    let index2 = list.indexOf(version2);
    return index1 !== -1 && index2 !== -1 ?
        index1 <= index2 :
        version1.localeCompare(version2);
 }
