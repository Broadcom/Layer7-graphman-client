// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Explodes bundle into multiple files.
     * @param params
     * @param params.input name of the input file containing the gateway configuration as bundle
     * @param params.output name of the output directory into which the gateway configuration will be exploded
     * @param params.options name-value pairs used to customize explode operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        if (!params.output) {
            throw "--output parameter is missing";
        }

        const bundle = utils.readFile(params.input);
        const outputDir = params.output;

        utils.mkDir(outputDir);
        utils.info(`exploding to ${outputDir}`);

        type1Exploder.explode(bundle, outputDir, params.options);
    },

    initParams: function (params, config) {
        params = Object.assign({
            gateway: "default"
        }, params);

        params.options = Object.assign({
            level: 0
        }, config.options, params.options);

        return params;
    },

    usage: function () {
        console.log("explode --input <input-file>");
        console.log("  --output <output-dir>");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Explodes bundle into multiple files.");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify the name of input bundle file that contains gateway configuration");
        console.log("    use '-' to read the bundle from the standard input");
        console.log();
        console.log("  --output <output-dir>");
        console.log("    specify the name of directory to explode into.");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .level 0|1|2");
        console.log("        to decide the level of explode operation");
        console.log("          - 0, default level where the individual entities will be exploded into separate files");
        console.log("          - 1, wsdl resources and cert and key binary data (in p12 and pem formats) associated with the entities will be exploded into separate files");
        console.log("          - 2, policy code will be exploded into separate files");
        console.log("      .logSink stdout|stderr");
        console.log("        directs the log messages to the chosen sink.");
        console.log("        use 'stderr' (or .log nolog) when piping the output to another command.");
        console.log();
    }
}

function explodeFile(path, filename, data) {
    utils.writeFile(utils.path(path, filename), data);
    return `{{${filename}}}`;
}

function explodeFileBinary(path, filename, data) {
    utils.writeFileBinary(utils.path(path, filename), data);
    return `{{${filename}}}`;
}

let type1Exploder = (function () {
	const BEGIN_CERT_HEADER = '-----BEGIN CERTIFICATE-----';
	const END_CERT_HEADER = '-----END CERTIFICATE-----';
    const subExploders = [
        {
            /**
             * Explodes key details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity key entity
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 1) return;
                if (typeInfo.pluralName !== "keys") return;

                // make sure the key details exploded from one of the available (p12, pem)
                if (entity.p12) {
                    entity.p12 = explodeFileBinary(outputDir, filename + ".p12", Buffer.from(entity.p12, 'base64'));
                    delete entity.pem;
                } else if (entity.pem) {
                    entity.pem = explodeFile(outputDir, filename + ".pem", entity.pem);
                }

                if (entity.certChain) {
                    let data = "";
                    for (let index in entity.certChain) {
                        data += entity.certChain[index].trim();
                        data += "\r\n";
                    }
                    entity.certChain = explodeFile(outputDir, filename + ".certchain.pem", data);
                }
            }
        },
        {
            /**
             * Explodes trusted cert details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity trusted cert entity
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 1) return;
                if (typeInfo.pluralName !== "trustedCerts") return;

                if (entity.certBase64) {
                    let pemData = BEGIN_CERT_HEADER;
                    pemData += '\r\n' + entity.certBase64;
                    pemData += '\r\n' + END_CERT_HEADER;
                    entity.certBase64 = explodeFile(outputDir, filename + ".pem", pemData);
                }
            }
        },
        {
            /**
             * Explodes user cert details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity user entity
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 1) return;
                if (typeInfo.pluralName !== "internalUsers" && typeInfo.pluralName !== "federatedUsers") return;

                if (entity.certBase64) {
                    let pemData = BEGIN_CERT_HEADER;
                    pemData += '\r\n' + entity.certBase64;
                    pemData += '\r\n' + END_CERT_HEADER;
                    entity.certBase64 = explodeFile(outputDir, filename + ".pem", pemData);
                }

                if (entity.sshPublicKey) {
                    entity.sshPublicKey = explodeFile(outputDir, filename + ".pub", entity.sshPublicKey);
                }
            }
        },

        {
            /**
             * Explodes wsdl details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity any entity containing wsdl details (services)
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 1) return;

                if (entity.wsdl) {
                    entity.wsdl = explodeFile(outputDir, filename + ".wsdl", entity.wsdl);
                    if (Array.isArray(entity.wsdlResources)) {
                        entity.wsdlResources.forEach((item, index) =>
                            item.content = explodeFile(outputDir, `${filename}-wsdl-resource-${index + 1}.xml`, item.content));
                    }
                }
            }
        },

        {
            /**
             * Explodes policy details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity any entity containing policy details (services, policies)
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 2) return;

                // make sure the policy details exploded from one of the available (xml, json, yaml, code)
                if (entity.policy) {
                    this.explodePolicy(outputDir, filename, entity.policy);
                }

                if (Array.isArray(entity.policyRevisions)) {
                    entity.policyRevisions.forEach(item =>
                        this.explodePolicy(outputDir, filename + "-revision-" + item.ordinal, item));
                }
            },

            explodePolicy: function (outputDir, filename, policy) {
                if (policy.xml) {
                    policy.xml = explodeFile(outputDir, filename + ".xml", policy.xml);
                    delete policy.json;
                    delete policy.yaml;
                    delete policy.code;
                } else if (policy.json) {
                    policy.json = explodeFile(outputDir, filename + ".cjson", JSON.parse(policy.json));
                    delete policy.code;
                    delete policy.yaml;
                } else if (policy.code) {
                    utils.writeFile(`${outputDir}/${filename}.cjson`, policy.code);
                    policy.json = explodeFile(outputDir, filename + ".cjson", policy.code);
                    delete policy.code;
                    delete policy.yaml;
                } else if (policy.yaml) {
                    policy.yaml = explodeFile(outputDir, filename + ".yaml", policy.yaml);
                    delete policy.code;
                }
            }
        }
    ];
	
    return {
        explode: function (bundle, outputDir, options) {
            butils.forEach(bundle, (key, entities, typeInfo) => {
                const list = [];
                utils.info(`exploding ${key}`);
                entities.forEach(item => {
                    options.duplicate = list.find(x => butils.isEntityMatches(x, item, typeInfo));
                    writeEntity(outputDir, key, item, typeInfo, options);
                    list.push(item);
                });
            });

            if (bundle.properties) {
                utils.info(`capturing properties to bundle-properties.json`);
                utils.writeFile(`${outputDir}/bundle-properties.json`, bundle.properties);
            }
        }
    };

    function timeAwareRandom() {
        return Date.now() + "-" + Math.round(Math.random() * 1000)
    }

    function writeEntity(dir, key, entity, typeInfo, options) {
        let displayName = butils.entityName(entity, typeInfo);
        if (!displayName) {
            displayName = entity.checksum || timeAwareRandom();
            utils.warn("  forced to use alternative entity display name for ", entity);
        }

        if (options.duplicate) {
            const originalName = displayName;
            displayName += "-" + timeAwareRandom();
            utils.info(`  ${displayName} (duplicate to ${originalName})`);
        } else {
            utils.info(`  ${displayName}`);
        }

        const fileSuffix = butils.entityFileSuffixByPluralName(key);
        const filename = utils.safeName(displayName) + (fileSuffix ? fileSuffix : "");

        const targetDir = entity.folderPath ? utils.safePath(dir, "tree", entity.folderPath) : utils.path(dir, key);

        subExploders.forEach(item => item.explode(targetDir, filename, entity, typeInfo, options));
        utils.writeFile(`${targetDir}/${filename}.json`, entity);
    }
})();
