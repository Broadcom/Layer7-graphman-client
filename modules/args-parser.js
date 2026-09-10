// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

/**
 * CLI argument parser
 * @type {{parse: (function(*): boolean|*)}}
 */
module.exports = {
    /**
     * Parses the CLI arguments.
     * Supports dot notation such that one or more arguments together results a complex object as an argument.
     * A "+" token in the dot notation turns the preceding field into a controlled array: mid-path it pushes
     * a new record and makes it current, and a trailing "+" pushes a new plain value; subsequent flags on the
     * same path without "+" keep filling the current (most recently pushed) record.
     * Normalizes the values to matching data types (number, boolean, string).
     * @param args
     * @return {boolean|*}
     */
    parse: function (args) {
        const params = {__unknowns:[]};
        let argName, argValue;

        for (let arg of args) {
            if (arg.startsWith("--")) {
                if (argName && argValue === undefined) {
                    setParam(params, argName, true, true);
                }

                if (arg.length > 2) {
                    argName = arg.substring(2);
                    const sepIndex = argName.indexOf("=");
                    if (sepIndex !== -1) {
                        argValue = argName.substring(sepIndex + 1);
                        argName = argName.substring(0, sepIndex);
                        setParam(params, argName, argValue, true);
                    } else {
                        argValue = undefined;
                    }
                }
            } else if (argName) {
                const overwrite = (argValue === undefined);
                argValue = arg;
                setParam(params, argName, argValue, overwrite);
            }
        }

        if (argName && argValue === undefined) {
            setParam(params, argName, true, true);
        }

        return normalize(params);
    }
}

function setParam(params, ref, value, overwrite) {
    const refTokens = ref.split(".");
    let param = params[refTokens[0]];
    if (!param) {
        param = params[refTokens[0]] = {};
    }

    let parentObjRef = null;
    let objRef = param;

    if (refTokens.length > 1) for (let i = 1; i < refTokens.length; i++) {
        parentObjRef = objRef;
        const token = refTokens[i];

        if (token === "+") {
            if (!Array.isArray(parentObjRef.__array)) {
                parentObjRef.__array = [];
            }
            objRef = {};
            parentObjRef.__array.push(objRef);
            parentObjRef.__current = objRef;
        } else if (Array.isArray(parentObjRef.__array)) {
            const current = parentObjRef.__current;
            objRef = current[token];
            if (!objRef) {
                objRef = current[token] = {};
            }
        } else {
            objRef = parentObjRef[token];
            if (!objRef) {
                objRef = parentObjRef[token] = {};
            }
        }
    }

    if (overwrite) {
        objRef["__value"] = value;
    } else {
        let objRefValue = objRef["__value"];
        if (objRefValue === undefined) {
            objRef["__value"] = value;
        } else {
            if (!Array.isArray(objRefValue)) {
                objRefValue = objRef["__value"] = [objRefValue];
            }

            objRefValue.push(value);
        }
    }
}

function normalize(obj) {
    if (typeof obj !== 'object') {
        if (obj === 'true') return true;
        if (obj === 'false') return false;
        const num = parseInt(obj);
        return isNaN(num) || String(num) !== obj ? obj : num;
    }

    Object.entries(obj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            normalizeArrayItems(value);
        } else if (typeof value === 'object') {
            if (Array.isArray(value.__array)) {
                obj[key] = normalizeArrayItems(value.__array);
            } else if (Object.keys(value).length === 1 && value["__value"]) {
                obj[key] = normalize(value["__value"]);
            } else {
                obj[key] = normalize(value);
            }
        } else {
            obj[key] = normalize(value);
        }
    });

    return obj;
}

function normalizeArrayItems(arr) {
    arr.forEach((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)
            && Object.keys(item).length === 1 && item["__value"] !== undefined) {
            arr[index] = normalize(item["__value"]);
        } else {
            arr[index] = normalize(item);
        }
    });

    return arr;
}
