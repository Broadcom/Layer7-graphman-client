// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Builds a summary of the entities processed by an operation, along with its timing details.
     * @param operation operation name (e.g., "import", "export", "renew")
     * @param bundle bundle whose per-section entity counts are to be summarized
     * @param startDate operation start time (epoch millis)
     * @param endDate operation end time (epoch millis)
     * @returns {Object} summary
     */
    build: function (operation, bundle, startDate, endDate) {
        const sections = {};
        let totalEntities = 0;

        butils.forEach(bundle || {}, (key, entities) => {
            sections[key] = entities.length;
            totalEntities += entities.length;
        });

        return {
            operation: operation,
            startTime: new Date(startDate).toISOString(),
            endTime: new Date(endDate).toISOString(),
            durationMs: endDate - startDate,
            sections: sections,
            totalEntities: totalEntities
        };
    },

    /**
     * Prints the given summary.
     * @param summary summary built via #build
     */
    print: function (summary) {
        utils.info("summary:");
        utils.info("  operation: " + summary.operation);
        utils.info("  start time: " + summary.startTime);
        utils.info("  end time: " + summary.endTime);
        utils.info("  duration: " + summary.durationMs + " ms");
        utils.info("  total entities: " + summary.totalEntities);
        utils.info("  sections:");
        Object.keys(summary.sections).sort().forEach(key => {
            utils.info("    " + key + ": " + summary.sections[key]);
        });
        utils.print();
    },

    /**
     * Builds and prints the summary of the entities processed by an operation, along with its timing details.
     * @param operation operation name (e.g., "import", "export", "renew")
     * @param bundle bundle whose per-section entity counts are to be summarized
     * @param startDate operation start time (epoch millis)
     * @param endDate operation end time (epoch millis)
     * @returns {Object} summary
     */
    report: function (operation, bundle, startDate, endDate) {
        const summary = this.build(operation, bundle, startDate, endDate);
        this.print(summary);
        return summary;
    }
}
