// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");
const CONFIG_FILE = "graphman.configuration";

module.exports = {
    /**
     * Configures home directory
     * @param params
     * @param params.init-home initializes home directory
     * @param params.options.encodeSecrets encodes secrets in the configuration
     * @param params.options.revise revise configuration
     */
    run: function (params) {
        if (params["init-home"]) {
            initHome(params["init-home"], params.options);
        } else {
            const home = process.env.GRAPHMAN_HOME;
            const configFile = utils.path(home, CONFIG_FILE);
            if (!home) {
                utils.warn("home directory is not configured");
                utils.warn("did you forget to configure the GRAPHMAN_HOME environment variable?");
            } else if (utils.existsFile(configFile)) {
                utils.info("home", home);
                utils.info("configuration");
                utils.print(utils.readFile(configFile));
            } else {
                utils.warn("configuration is missing,", configFile);
            }
            utils.print();
        }
    },

    initParams: function (params, config) {
        // do nothing
        return params;
    },

    paramsSchema: {
        "init-home": "string",
        options: {
            revise: "boolean",
            encodeSecrets: "boolean"
        }
    },

    usage: function () {
        console.log("config [--init-home <home-directory>]");
        console.log("  [--options.<name> <value>, ...]");
        console.log();
        console.log("Configures the home directory");
        console.log();
        console.log("  --init-home <home-directory>");
        console.log("    specify home-directory to initialize the graphman home");
        console.log("    pre-populates the home directory with configuration and extensions")
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .revise false|true");
        console.log("        use this option to revise the configuration file");
        console.log("      .encodeSecrets false|true");
        console.log("        use this option to encode the secrets in configuration file");
        console.log();
    }
}

function initHome(home, options) {
    if (utils.home() === home) {
        throw utils.newError("installation directory is not modifiable");
    }

    utils.info("initializing home", home);
    utils.mkDir(utils.queriesDir(home));
    utils.mkDir(utils.modulesDir(home));

    // copy extensions
    const mDir = utils.modulesDir(home);
    utils.listDir(utils.modulesDir()).forEach(item => {
        if (item.startsWith("graphman-extension-")) {
            const sPath = utils.path(utils.modulesDir(), item);
            const tPath = utils.path(mDir, item);
            if (!utils.existsFile(tPath)) {
                utils.info("  creating extension module", item);
                utils.writeFile(tPath, utils.readFile(sPath));
            }
        }
    });

    // prepare configuration
    const configFile = utils.path(home, CONFIG_FILE);
    if (!utils.existsFile(configFile)) {
        utils.info("  creating default configuration");
        utils.writeFile(configFile, utils.pretty(graphman.defaultConfiguration()));
    }

    const config = JSON.parse(utils.readFile(configFile));

    if (options.revise) {
        reviseConfig(config);
    }

    if (options.encodeSecrets) {
        encodeSecrets(config);
    }

    if (options.revise || options.encodeSecrets) {
        utils.writeFile(configFile + ".bak", JSON.parse(utils.readFile(configFile)));
        utils.writeFile(configFile, utils.pretty(config));
    }

    utils.info("make sure defining the environment variable, GRAPHMAN_HOME=" + home);
    utils.print();
    return home;
}

function reviseConfig(config) {
    if (!config.credentials) {
        config.credentials = {};
    }

    if (config.gateways) Object.entries(config.gateways).forEach(([key, gateway]) => {
        const credential = {};

        utils.info("  revising gateway profile", key);
        ["username", "password", "keyFilename", "certFilename", "keyPassphrase"].forEach(key => {
            reviseGatewayProperty(gateway, credential, key);
        });

        if (Object.keys(credential).length) {
            let ckey = key + "_credential";

            if (config.credentials[ckey]) {
                ckey = ckey + "_" + Object.keys(config.credentials).length + 1;
            }

            utils.info("  new credential", ckey);
            config.credentials[ckey] = credential;
            if (!gateway.credential) {
                gateway.credential = ckey;
            }
        }
    });
}

function reviseGatewayProperty(gateway, credential, propertyName) {
    const value = gateway[propertyName];
    if (value) credential[propertyName] = value;
    delete gateway[propertyName];
}

function encodeSecrets(config) {
    if (config.credentials) Object.entries(config.credentials).forEach(([key, credential]) => {
        utils.info("  encoding credentials", key);
        encryptSecret(credential, "password");
        encryptSecret(credential, "keyPassphrase");
    });

    if (config.gateways) Object.entries(config.gateways).forEach(([key, gateway]) => {
        utils.info("  encoding secrets of gateway profile", key);
        encryptSecret(gateway, "password");
        encryptSecret(gateway, "passphrase");
        encryptSecret(gateway, "keyPassphrase");
    });
}

function encryptSecret(obj, propertyName) {
    const value = obj[propertyName];
    if (value) {
        obj[propertyName] = utils.encodeSecret(utils.decodeSecret(value));
    }
}
