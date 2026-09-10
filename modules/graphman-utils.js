// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const fs = require("fs");
const putil = require("path");
const HOME_DIR = putil.dirname(__dirname);
const MODULES_DIR = HOME_DIR + "/modules";
const QUERIES_DIR = HOME_DIR + "/queries";
const SCHEMA_DIR = HOME_DIR + "/schema";
const SCHEMA_METADATA_BASE_FILE = "metadata-base.json";
const SCHEMA_METADATA_FILE = "metadata.json";
const POLICY_SCHEMA_FILE = "policy-code-schema.json";

const NONE_LEVEL = 0;
const WARN_LEVEL = 1;
const INFO_LEVEL = 2;
const FINE_LEVEL = 3;
const DEBUG_LEVEL = 10;

const SECRET_BASE64_PREFIX = "$b64.";
const STDIN_MARKER = "-";

let logLevel = INFO_LEVEL;
let logSink = console.log;
let wrapperDir = HOME_DIR;
let stdinConsumed = false;

const defaultExtn = {ref: {apply: function (input, context) {return input;}}};
const extns = {};

class GraphmanOperationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GraphmanOperationError';
    }
}

module.exports = {
    newError: function (msg) {
        return new GraphmanOperationError(msg);
    },

    loggingAt: function (level) {
        if (level === 'warn' && logLevel === WARN_LEVEL) return true;
        else if (level === 'info' && logLevel === INFO_LEVEL) return true;
        else if (level === 'fine' && logLevel === FINE_LEVEL) return true;
        else return level === 'debug' && logLevel === DEBUG_LEVEL;
    },

    logTo: function (sink) {
        if (sink === 'stderr') {
            logSink = console.error;
        } else if (sink === 'stdout') {
            logSink = console.log;
        } else if (sink) {
            this.warn("unsupported log sink, " + sink);
        }
    },

    logAt: function (level) {
        if (level === 'warn') {
            logLevel = WARN_LEVEL;
        } else if (level === 'info') {
            logLevel = INFO_LEVEL;
        } else if (level === 'fine') {
            logLevel = FINE_LEVEL;
        } else if (level === 'debug') {
            logLevel = DEBUG_LEVEL;
        } else if (level === 'nolog') {
            logLevel = NONE_LEVEL;
        }
    },

    wrapperHome: function (path) {
        if (path) {
            if (!this.existsFile(path)) {
                throw this.newError("home directory does not exist, " + path);
            }

            if (!this.isDirectory(path)) {
                throw this.newError("incorrect home directory, " + path);
            }

            wrapperDir = path;
        }

        return wrapperDir;
    },

    home: function () {
        return HOME_DIR;
    },

    modulesDir: function (workspace) {
        return workspace ? this.path(workspace, "modules") : MODULES_DIR;
    },

    schemasDir: function () {
        return SCHEMA_DIR;
    },

    schemaDir: function (schemaVersion) {
        const path = this.path(SCHEMA_DIR, schemaVersion);
        if (!this.existsFile(path)) {
            throw this.newError("unsupported schema, " + schemaVersion);
        }

        return path;
    },

    schemaMetadataBaseFile: function (schemaVersion) {
        return this.path(this.schemaDir(schemaVersion), SCHEMA_METADATA_BASE_FILE);
    },

    schemaMetadataFile: function (schemaVersion) {
        return this.path(this.schemaDir(schemaVersion), SCHEMA_METADATA_FILE);
    },

    policySchemaFile: function (schemaVersion) {
      return this.path(this.schemaDir(schemaVersion), POLICY_SCHEMA_FILE)
    },

    queriesDir: function (workspace) {
        return workspace ? this.path(workspace, "queries") : QUERIES_DIR;
    },

    queryDirs: function (schemaVersion) {
        return [
            this.path(this.queriesDir(this.wrapperHome()), schemaVersion),
            this.path(this.queriesDir(this.wrapperHome())),
            this.path(this.queriesDir(), schemaVersion),
            this.queriesDir()
        ];
    },

    queryFile: function (query, schemaVersion) {
        const paths = this.queryDirs(schemaVersion);
        const path = paths.find(item => this.existsFile(this.path(item, query)));
        return path ? this.path(path, query) : this.path(paths[0], query);
    },

    isDirectory: function (fd) {
        const stat = fs.statSync(fd);
        return stat && stat.isDirectory();
    },

    isFile: function (fd) {
        const stat = fs.statSync(fd);
        return stat && stat.isFile();
    },

    mkDir: function (dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    },

    listDir: function (dir) {
       return fs.readdirSync(dir);
    },

    existsFile: function (file) {
        return fs.existsSync(file);
    },

    path: function (rootPath, ...paths) {
        let result = rootPath;
        paths.forEach(item => result += (item.startsWith("/") ? item : "/" + item));
        return result;
    },

    safePath: function (rootPath, ...paths) {
        let result = rootPath;

        paths.forEach(item => {
            const tokens = item.split('/');
            tokens.filter(token => token.length !== 0).forEach(token => result += "/" + this.safeName(token));
        });

        return result;
    },

    parentPath: function (path) {
        return path ? putil.dirname(path) : ".";
    },

    stdinMarker: function () {
        return STDIN_MARKER;
    },

    readStdin: function () {
        if (stdinConsumed) {
            throw this.newError("standard input is already consumed, it can be read only once");
        }

        if (process.stdin.isTTY) {
            throw this.newError("no data piped to the standard input");
        }

        stdinConsumed = true;
        const data = fs.readFileSync(0, 'utf-8').trim();
        if (!data) {
            throw this.newError("no data piped to the standard input");
        }

        try {
            return JSON.parse(data);
        } catch (e) {
            throw this.newError("standard input is not a valid json bundle, " + e.message);
        }
    },

    readFile: function (file) {
        if (file === STDIN_MARKER) {
            return this.readStdin();
        }

        if (!fs.existsSync(file)) {
            throw "file doesn't exist, " + file;
        }

        var data = fs.readFileSync(file, 'utf-8');
        return file.endsWith(".json") || file.endsWith(".bundle") ? JSON.parse(data) : data;
    },

    readFileBinary: function (file) {
        if (!fs.existsSync(file)) {
            throw "file doesn't exist, " + file;
        }

        return fs.readFileSync(file);
    },

    writeFile: function (file, data) {
        this.mkDir(this.parentPath(file));
        fs.writeFileSync(file, this.pretty(data));
    },

    writeFileBinary: function (file, data) {
        this.mkDir(this.parentPath(file));
        fs.writeFileSync(file, data);
    },

    print: function (data) {
        if (data) console.log(this.pretty(data));
        else console.log();
    },

    logAdditionalErrorDetails: function (e) {
        const errors = e["errors"];
        if (Array.isArray(errors)) {
            errors.filter(item => item.message).forEach((item, index) => {
                this.warn(`  internal error [${index}]: `, item.message);
            });
        }

        if (this.loggingAt("debug") || (!e.message && !errors)) {
            logSink(e);
        }
    },

    log: function (prefix, ...args) {
        let text = prefix;

        if (args[0].length > 0) {
            args[0].forEach(item => {
                const isObj = (typeof item === 'object');
                text += " " + (isObj ? replaceNewLineMarkers(this.pretty(item)) : this.pretty(item));
            });
        }

        logSink(text);
    },

    error: function (message, ...args) {
        this.log("[error] " + message, args);
    },

    warn: function (message, ...args) {
        if (logLevel >= WARN_LEVEL) this.log("[warn] " + message, args);
    },

    info: function (message, ...args) {
        if (logLevel >= INFO_LEVEL) this.log("[info] " + message, args);
    },

    fine: function (message, ...args) {
        if (logLevel >= FINE_LEVEL) this.log("[fine] " + message, args);
    },

    debug: function (message, ...args) {
        if (logLevel >= DEBUG_LEVEL) this.log("[debug] " + message, args);
    },

    pretty: function (data, space) {
        return typeof data === 'object' ? JSON.stringify(data, null, space || 2) : data;
    },

    writeResult: function (file, bundle) {
        if (file) {
            this.info("writing to file " + file);
            this.writeFile(file, bundle);
        } else {
            this.print(bundle);
            this.print();
        }
    },

    writePartsResult: function (dir, parts) {
        parts.forEach(part => {
            if (part.filename) {
                this.info(`writing ${part.name} part to file ${dir}/${part.filename}`);
                this.writeFileBinary(this.path(dir, part.filename), part.data);
            } else {
                this.debug(`ignoring the ${part.name} part`);
            }
        });
    },

    safeName: function (name) {
        return name.replace(/[\/:*?"<>|]/g,"+");
    },

    zeroPad: function (num, places) {
        return num.toString().padStart(places, '0');
    },

    base64StringEncode: function (data) {
        return Buffer.from(data).toString('base64');
    },

    base64StringDecode: function (data) {
        return Buffer.from(data, 'base64').toString('utf-8')
    },

    encodeSecret: function (secret) {
        if (secret) {
            return SECRET_BASE64_PREFIX + this.base64StringEncode(secret);
        }

        return secret;
    },

    decodeSecret: function (secret) {
        if (secret && secret.startsWith(SECRET_BASE64_PREFIX)) {
            return this.base64StringDecode(secret.substring(SECRET_BASE64_PREFIX.length));
        }

        return secret;
    },

    /**
     * register the enabled extensions
     * @param listOrItem one or more enabled extension names
     */
    extensions: function (listOrItem) {
        if (Array.isArray(listOrItem)) {
            listOrItem.forEach(item => extns[item] = {ref: null});
        } else if (listOrItem) {
            extns[listOrItem] = {ref: null};
        }

        return Object.keys(extns);
    },

    /**
     * Load and get the extension
     * @param ref extension name
     * @returns {{apply: function(*, *): *}}
     */
    extension: function (ref) {
        let extn = extns[ref];
        if (!extn) {
            this.warn(ref + " graphman extension is not enabled, falling back to the default");
            extn = defaultExtn;
        }

        if (!extn.ref) {
            extn.ref = loadExtension(this, ref);
        }

        return extn.ref;
    },

    mappings: function (actions) {
        const result = {};

        if (actions) {
            this.verifyMappingAction(actions.action);
            result['default'] = {action: actions.action, level: actions.level || '0'};
            delete actions.action;
            delete actions.level;
        } else {
            result['default'] = {action: null, level: '0'};
        }

        Object.keys(actions||{}).forEach(key => {
            this.verifyMappingAction(actions[key].action, key);

            const instr = result[key] = result[key] || {};
            instr.action = actions[key].action || result['default'].action;
            instr.level = actions[key].level || result['default'].level;
        });

        return result;
    },

    verifyMappingAction: function (action, type) {
        if (!action) return;

        switch (action) {
            case "NEW_OR_EXISTING":
            case "NEW_OR_UPDATE":
            case "ALWAYS_CREATE_NEW":
            case "IGNORE":
            case "DELETE":
                return;
        }

        throw "invalid mapping action " + action + (type ? " specified for " + type : "");
    },

    /**
     * Builds a generic operation context for extensions
     * @param operation operation name (e.g., "import", "export", "renew", "diff")
     * @param gateway gateway configuration (optional)
     * @param options operation options
     * @param additionalContext additional context properties (optional)
     * @returns {Object} operation context
     */
    buildOperationContext: function (operation, gateway, options, additionalContext) {
        const context = {
            operation: operation,
            gateway: gateway,
            options: options || {},
        };

        if (additionalContext) {
            Object.assign(context, additionalContext);
        }

        return context;
    }
}

function replaceNewLineMarkers(data) {
    return data
        .replaceAll("\\r\\n", "\n")
        .replaceAll("\\n", "\n");
}

function loadExtension(utils, ref) {
    try {
        let filename = utils.modulesDir(utils.wrapperHome()) + "/graphman-extension-" + ref + ".js";
        if (utils.existsFile(filename)) {
            return require(filename);
        }

        filename = utils.modulesDir(utils.home()) + "/graphman-extension-" + ref + ".js";
        if (utils.existsFile(filename)) {
            return require(filename);
        }

        utils.info(ref + " extension is missing, falling back to the default");
    } catch (e) {
        utils.warn(`failed to load the ${ref} extension, cause=${e.code}, falling back to the default`);
    }

    return defaultExtn.ref;
}
