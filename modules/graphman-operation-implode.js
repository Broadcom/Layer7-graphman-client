// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");

module.exports = {
    /**
     * Implodes directory of gateway configuration into bundle.
     * It is inverse of Explode operation.
     * @param params
     * @param params.input name of the input file containing the gateway configuration as bundle
     * @param params.output name of the output directory into which the gateway configuration will be exploded
     * @param params.options name-value pairs used to customize explode operation
     * @param params.package name of the package file that specifies which entities to include (CLI; prefer params.options.packageFile)
     * @param params.sections one or more sections of the bundle for inclusion (CLI; prefer params.options.sections; used only when package is not specified)
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        const inputDir = params.input;
        const options = {};
        options.packageFile = params.package;
        options.sections = options.packageFile ? undefined : params.sections;
        const bundle = type1Imploder.implode(inputDir, options);

        utils.writeResult(params.output, butils.sort(bundle));
    },

    initParams: function (params, config) {
        params.sections = params.sections || ["*"];
        if (!Array.isArray(params.sections)) {
            params.sections = [params.sections];
        }
        return params;
    },

    paramsSchema: {
        input: "string",
        output: "string",
        package: "string",
        sections: "array"
    },

    usage: function () {
        console.log("implode --input <input-dir>");
        console.log("  [--output <output-file>]");
        console.log("  [--package <package-file>]");
        console.log("  [--sections <section>...]");
        console.log();
        console.log("Implodes the gateway configuration from directory into a bundle.");
        console.log();
        console.log("  --input <input-dir>");
        console.log("    specify the input directory that contains gateway configuration");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the imploded gateway configuration as bundle");
        console.log();
        console.log("  --package <package-file>");
        console.log("    specify the package file that defines which entities to include");
        console.log("    format: { \"<section>\": [{\"source\": <entity-summary>|<file-name>}] }");
        console.log("    where section is entity type and source is entity summary object or file name string");
        console.log("    file name supports wildcards (* and ?) for pattern matching");
        console.log();
        console.log("  --sections <section> <section> ...");
        console.log("    specify one or more sections of the bundle for inclusion");
        console.log("    section refers to the plural name of the entity type (e.g. services, policies)");
        console.log("    * is a special section name, used to refer all the sections of a bundle");
        console.log("    by default, all the sections of the bundle will be considered.");
        console.log("    this parameter is honored only when --package is not specified.");
        console.log();
    }
}

let type1Imploder = (function () {
    const subImploders = {
        "keys": {
            apply: function (entity, inputDir) {
                return implodeKey(entity, inputDir);
            }
        },

        "trustedCerts": {
            apply: function (entity, inputDir) {
                return implodeEntityCert(entity, inputDir);
            }
        },

        "internalUsers": {
            apply: function (entity, inputDir) {
                if (isValueFileReferenced(entity.sshPublicKey)) {
                    entity.sshPublicKey = implodeFile(entity.sshPublicKey, inputDir);
                }

                return implodeEntityCert(entity, inputDir);
            }
        },

        "federatedUsers": {
            apply: function (entity, inputDir) {
                return implodeEntityCert(entity, inputDir);
            }
        }
    };

    function isSectionIncluded(packageSpec, sectionName) {
        if (packageSpec) {
            const packageItems = packageSpec[sectionName];
            if (!packageItems) {
                utils.debug(sectionName + ` section is missing in the package`);
                return false;
            }
            if (!Array.isArray(packageItems)) {
                utils.warn(sectionName + `should be an array`);
                return false;
            }
        }
        return true;
    }

    return {
        implode: function (inputDir, options) {
            const bundle = {};
            let packageSpec = null;
            const packageFile = options.packageFile;
            const sections = options.sections;

            if (!utils.existsFile(inputDir) || !utils.isDirectory(inputDir)) {
                throw utils.newError(`directory does not exist or not a directory, ${inputDir}`);
            }

            // Load package file if specified (sections is ignored when package is specified)
            if (packageFile) {
                packageSpec = JSON.parse(utils.readFile(packageFile));
                utils.info(`using package file: ${packageFile}`);
            } else if (sections && !sections.includes("*")) {
                packageSpec = {};
                sections.forEach(item => packageSpec[item] = [{"source": "*"}]);
                utils.info(`using package(sections) : ${sections}`);
            }
            const selectionPredicate = (entity, typeInfo, pluralName, fileName) => {
                return !packageSpec || (isSectionIncluded(packageSpec, pluralName)
                    && findEntityFromPackage(packageSpec, entity, typeInfo, pluralName, fileName));
            };

            utils.listDir(inputDir).forEach(item => {
                const subDir = inputDir + "/" + item;
                if (utils.isDirectory(subDir)) {
                    const typeInfo = graphman.typeInfoByPluralName(item);
                    if (typeInfo) {
                        utils.info("imploding " + item);
                        readEntities(subDir, item, typeInfo, bundle, selectionPredicate);
                    } else if (item === "tree") {
                        readFolderableEntities(subDir, bundle, subDir, selectionPredicate);
                    } else {
                        utils.info("unknown entities, " + item);
                    }
                }
            });

            const propertiesFile = utils.path(inputDir, 'bundle-properties.json');
            if (utils.existsFile(propertiesFile)) {
                bundle['properties'] = utils.readFile(propertiesFile);
                
                // Filter mappings to only include selected entities and their dependencies
                if (packageSpec && bundle['properties'].mappings) {
                    filterMappings(bundle['properties'].mappings, bundle);
                }
            }

            return bundle;
        }
    };

    function findEntityFromPackage(packageSpec, entity, typeInfo, section, filename) {
        const packageItems = packageSpec[section];
        return packageItems.some(item => {
            if (typeof item !== 'object' || item.source === undefined) {
                utils.warn(`invalid package item in ${section}, expected object with 'source' property`);
                return false;
            }

            const source = item.source;
            if (typeof source === 'string') {
                return findEntityByFileName(section, source, filename);
            }
            else if (typeof source === 'object') {
                return matchesSummary(entity, source, typeInfo);
            }
            return false;
        });
    }

    function findEntityByFileName(section, fileName, entityFileName) {
        if (fileName.includes('*') || fileName.includes('?')) {
            const pattern = new RegExp('^' + fileName.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            if (pattern.test(entityFileName)) {
                utils.info(`selected entity from package (wildcard): ${section}/${entityFileName}`);
                return true;
            }
            utils.warn(`no entity files matched wildcard: ${section}/${fileName}`);
            return false;
        } else {
            if (fileName === entityFileName) {
                utils.info(`selected entity from package: ${section}/${fileName}`);
                return true;
            } else {
                return false;
            }
        }
    }

    function matchesSummary(entity, summary, typeInfo) {
        // Match based on identity fields
        for (const field of typeInfo.identityFields) {
            if (summary[field] !== undefined && entity[field] !== summary[field]) {
                return false;
            }
        }
        // Also check goid if present in summary
        if (summary.goid !== undefined && entity.goid !== summary.goid) {
            return false;
        }
        return true;
    }

    function readEntities(inputDir, pluralName, typeInfo, bundle, selectionPredicate) {
        utils.listDir(inputDir).forEach(item => {
            if (item.endsWith(".json")) {
                utils.info(`  ${item}`);
                const entity = utils.readFile(`${inputDir}/${item}`);
                const subImploder = subImploders[typeInfo.pluralName];
                const finalEntity = subImploder ? subImploder.apply(entity, inputDir) : entity
                if (selectionPredicate(finalEntity, typeInfo, pluralName, item)) {
                    butils.withArray(bundle, typeInfo).push(finalEntity);
                }
            }
        });
    }

    function readFolderableEntities(dir, bundle, rootDir, selectionPredicate) {
        utils.listDir(dir).forEach(item => {
            if (utils.isDirectory(dir + "/" + item)) {
                readFolderableEntities(`${dir}/${item}`, bundle, rootDir, selectionPredicate);
            } else {
                readFolderableEntity(dir, item, bundle, rootDir, selectionPredicate);
            }
        });
    }

    function readFolderableEntity(path, filename, bundle, rootDir, selectionPredicate) {
        const pluralName = butils.entityPluralNameByFile(filename);
        let typeInfo = pluralName ? graphman.typeInfoByPluralName(pluralName) : null;

        if (typeInfo) {
            const fullPath = `${path}/${filename}`;
            utils.info(`  ${fullPath.substring(rootDir.length + 1)}`);
            const entity = utils.readFile(`${path}/${filename}`);

            // for backward compatibility, check whether the entity is of type policy fragment
            if (filename.endsWith(".policy.json") && !entity.policyType) {
                typeInfo = graphman.typeInfoByPluralName("policyFragments");
            }
            if (selectionPredicate(entity, typeInfo, pluralName, filename)) {
                const entities = butils.withArray(bundle, typeInfo);
                entities.push(implodeServiceOrPolicy(entity, path));
            }
        }
    }

    function isValueFileReferenced(data, fileExtension) {
        return data && data.startsWith("{") && data.endsWith("}") &&
            (!fileExtension || (data.endsWith(fileExtension + "}") || data.endsWith(fileExtension + "}}")));
    }

    function implodeFile(data, path) {
        let filename = data.startsWith("{{") && data.endsWith("}}") ?
            data.substring(2, data.length - 2) :
            data.substring(1, data.length - 1);

        return utils.readFile(`${path}/${filename}`);
    }

    function implodeFileBinary(data, path) {
        const filename = data.match(/{([^{}]+)}/)[1];
        return utils.readFileBinary(`${path}/${filename}`);
    }

    function implodeServiceOrPolicy(entity, inputDir) {
        if (entity.policy) {
            implodePolicyCode(entity, entity.policy, inputDir);
        }

        if (Array.isArray(entity.policyRevisions)) {
            entity.policyRevisions.forEach(item => implodePolicyCode(entity, item, inputDir));
        }

        if (isValueFileReferenced(entity.wsdl)) {
            entity.wsdl = implodeFile(entity.wsdl, inputDir);
        }

        if (Array.isArray(entity.wsdlResources)) {
            entity.wsdlResources.forEach(item => {
                if (isValueFileReferenced(item.content)) {
                    item.content = implodeFile(item.content, inputDir);
                }
            });
        }

        return entity;
    }

    function implodePolicyCode(entity, policy, inputDir) {
        if (isValueFileReferenced(policy.xml)) {
            policy.xml = implodeFile(policy.xml, inputDir);
        } else if (isValueFileReferenced(policy.json, ".cjson")) {
            policy.json = JSON.stringify(JSON.parse(implodeFile(policy.json, inputDir)), null, 0);
        } else if (isValueFileReferenced(policy.yaml)) {
            policy.yaml = implodeFile(policy.yaml, inputDir);
        }

        return entity;
    }

    function implodeKey(entity, inputDir) {
        if (isValueFileReferenced(entity.p12)) {
            entity.p12 = Buffer.from(implodeFileBinary(entity.p12, inputDir)).toString('base64');
        }

        if (isValueFileReferenced(entity.pem)) {
            entity.pem = implodeFile(entity.pem, inputDir);
        }

        const certChain = entity.certChain;
        if (certChain && typeof certChain === 'string' && isValueFileReferenced(certChain)) {
            entity.certChain = readCertFile(implodeFile(certChain, inputDir), true);
        }

        return entity;
    }

    function implodeEntityCert(entity, inputDir) {
        if (isValueFileReferenced(entity.certBase64)) {
            let data = readCertFile(implodeFile(entity.certBase64, inputDir), false);
            entity.certBase64 = data[0];
        }

        return entity;
    }

    function readCertFile(content, includeHeader) {
        const lines = content.split(/\r?\n/);
        const certs = [];
        let data = null;

        for (const line of lines) {
            if (data == null) {
                if (line.indexOf("-BEGIN CERTIFICATE-") !== -1) {
                    data = includeHeader ? line : "";
                }
            } else {
                if (line.indexOf("-END CERTIFICATE-") !== -1) {
                    data += "\r\n" + (includeHeader ? line : "");
                    certs.push(data.trim());
                    data = null;
                } else {
                    data += "\r\n" + line;
                }
            }
        }

        return certs;
    }

    function filterMappings(mappings, bundle) {
        Object.keys(mappings).forEach(section => {
            const typeInfo = graphman.typeInfoByPluralName(section);
            if (!typeInfo) {
                // Unknown entity type, keep all mappings
                return;
            }

            const entityMappings = mappings[section];
            if (!Array.isArray(entityMappings)) {
                return;
            }
            const entities = bundle[typeInfo.pluralName] || [];

            // Filter mappings to only include those matching selected entities
            const filteredMappings = entityMappings.filter(mapping => {
                // Keep default mappings
                if (mapping.default) {
                    return true;
                }

                // Check if this mapping matches any selected entity
                const source = mapping.source || mapping;
                return isMappingMatchingSelectedEntity(section, source, entities, typeInfo);
            });

            if (filteredMappings.length === 0) {
                delete mappings[section];
            } else {
                mappings[section] = filteredMappings;
            }
        });
    }

    function isMappingMatchingSelectedEntity(section, source, selectedEntities, typeInfo) {
        // Check each selected entity to see if it matches this mapping
        let found = false;
        for (const entity of selectedEntities) {
            if (butils.isEntityMatches(source, entity, typeInfo) ) {
                found = true;
                break;
            }
        }

        return found;
    }
})();
