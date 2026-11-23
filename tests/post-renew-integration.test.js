// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

/**
 * Integration tests for post-renew extension functionality
 * These tests verify the end-to-end flow of the post-renew extension
 * within the renew operation.
 */

const tUtils = require("./utils");
const {graphman} = tUtils;
const workspace = tUtils.config().workspace;
const renewedFile = `${workspace}/output.json`;
const utils = tUtils.load("graphman-utils");
const fs = require('fs');
const path = require('path');

describe("Post-Renew Extension Integration Tests", () => {
    const extensionDir = path.join(workspace, "extensions");

    function createPostRenewExtension(extensionCode, location = extensionDir) {
        if (!fs.existsSync(location)) {
            fs.mkdirSync(location, { recursive: true });
        }
        const extFile = path.join(location, "graphman-extension-post-renew.js");
        fs.writeFileSync(extFile, extensionCode);
        return extFile;
    }

    function cleanupExtension(location = extensionDir) {
        const extFile = path.join(location, "graphman-extension-post-renew.js");
        if (fs.existsSync(extFile)) {
            fs.unlinkSync(extFile);
        }
        // Clear from require cache
        Object.keys(require.cache).forEach(key => {
            if (key.includes('graphman-extension-post-renew')) {
                delete require.cache[key];
            }
        });
    }

    afterEach(() => {
        cleanupExtension(extensionDir);
    });

    test("post-renew extension is registered in supported extensions", () => {
        utils.extensions("post-renew");
        const extension = utils.extension("post-renew");

        expect(extension).toBeDefined();
        expect(typeof extension.apply).toBe("function");
    });

    test("default post-renew extension returns input unchanged", () => {
        // Load the actual post-renew extension from modules
        utils.extensions("post-renew");
        const extension = utils.extension("post-renew");

        const testBundle = {
            keys: [{ name: "key1", id: "id1" }],
            trustedCerts: [{ name: "cert1", id: "id2" }]
        };
        const context = utils.buildOperationContext("renew", null, {});

        const result = extension.apply(testBundle, context);

        // Default extension should return input unchanged
        expect(result).toEqual(testBundle);
        expect(result.keys).toHaveLength(1);
        expect(result.trustedCerts).toHaveLength(1);
    });

    test("post-renew extension receives correct context structure", () => {
        const extensionCode = `
const fs = require('fs');
const path = require('path');

module.exports = {
    apply: function (input, context) {
        // Validate context structure
        if (!context) {
            throw new Error("Context is missing");
        }
        if (!context.operation) {
            throw new Error("Context.operation is missing");
        }
        if (context.options === undefined) {
            throw new Error("Context.options is missing");
        }
        
        // Mark bundle as validated
        input.contextValidated = true;
        input.receivedOperation = context.operation;
        input.hasGateway = context.gateway !== undefined;
        input.hasOptions = context.options !== undefined;
        
        return input;
    }
};`;

        const extFile = createPostRenewExtension(extensionCode);
        const extension = require(extFile);
        const testBundle = { keys: [] };
        const gateway = { name: "test-gw", address: "https://test.com" };
        const options = { useGoids: true };
        const context = utils.buildOperationContext("renew", gateway, options);

        const result = extension.apply(testBundle, context);

        expect(result.contextValidated).toBe(true);
        expect(result.receivedOperation).toBe("renew");
        expect(result.hasGateway).toBe(true);
        expect(result.hasOptions).toBe(true);
    });

    /*test("post-renew extension can filter renewed entities", () => {
        const extensionCode = `
module.exports = {
    apply: function (input, context) {
        // Filter out test entities
        if (input.policies) {
            input.policies = input.policies.filter(policy => !policy.name.includes("test"));
        }
        return input;
    }
};`;
        const importBundle = path.join("samples", "import-bundle.json");
        graphman("import", "--input", importBundle, "--gateway", "default");
        const extFile = createPostRenewExtension(extensionCode);
        require(extFile);

        // Create test bundle file
        const testBundlePath = path.join(workspace, "test-renew-bundle.json");
        const testBundle = {
            policies: [
                { name: "production", policyType: "POLICY_BACKED_BACKGROUND_TASK" },
                { name: "test", policyType: "POLICY_BACKED_BACKGROUND_TASK" },
                { name: "staging", policyType: "POLICY_BACKED_BACKGROUND_TASK" }
            ]
        };
        fs.writeFileSync(testBundlePath, JSON.stringify(testBundle, null, 2));

        graphman("renew", "--input", testBundlePath, "--gateway", "default");
        const result = tUtils.readFileAsJson(renewedFile);
        expect(result.policies.some(k => k.name === "test")).toBe(false);
        expect(result.policies.some(k => k.name === "production")).toBe(true);
        expect(result.policies.some(k => k.name === "staging")).toBe(true);

    });*/

});
