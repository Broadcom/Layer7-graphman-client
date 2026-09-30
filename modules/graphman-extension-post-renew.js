// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

module.exports = {
    /**
     * Extension to process the renewed bundle
     * @param input renewed bundle
     * @param context partial execution context
     * @param context.operation operation
     * @param context.gateway gateway object
     * @param context.options CLI options
     */
    apply: function (input, context) {
        return input;
    }
}
