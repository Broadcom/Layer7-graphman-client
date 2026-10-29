// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const validator = tUtils.load("args-validator");
const parser = tUtils.load("args-parser");
const utils = tUtils.load("graphman-utils");

const fakeOperation = {
    paramsSchema: {
        input: "string",
        sections: "array",
        gateway: "string",
        options: {
            excludeGoids: "boolean",
            level: "number"
        }
    }
};

function run(args, operation) {
    const params = parser.parse(args);
    validator.validate(params, args, operation || fakeOperation);
    return params;
}

test("unknown top-level parameter logs a warning but does not throw", () => {
    const warnSpy = jest.spyOn(utils, "warn").mockImplementation(() => {});
    expect(() => run(["--foo", "bar"])).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown parameter: foo"));
    warnSpy.mockRestore();
});

test("unknown nested option logs a warning but does not throw", () => {
    const warnSpy = jest.spyOn(utils, "warn").mockImplementation(() => {});
    expect(() => run(["--options.exludeGoids", "true"])).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown parameter: options.exludeGoids"));
    warnSpy.mockRestore();
});

test("known boolean option with no explicit value logs a warning and defaults to true", () => {
    const warnSpy = jest.spyOn(utils, "warn").mockImplementation(() => {});
    const params = run(["--options.excludeGoids"]);
    expect(params.options.excludeGoids).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("options.excludeGoids' was specified without a value"));
    warnSpy.mockRestore();
});

test("known type mismatch throws", () => {
    expect(() => run(["--options.excludeGoids", "notabool"])).toThrow(/expected type boolean/);
});

test("known array-type parameter given a scalar throws", () => {
    expect(() => run(["--sections", "services"])).toThrow(/expected type array/);
});

test("variables and its nested keys are never validated", () => {
    const warnSpy = jest.spyOn(utils, "warn").mockImplementation(() => {});
    expect(() => run(["--variables.whatever", "123", "--variables.nested.deep", "x"])).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
});

test("opaque subtrees allow arbitrary keys without warnings", () => {
    const opaqueOperation = {
        paramsSchema: {
            filter: "opaque",
            options: {
                mappings: "opaque"
            }
        }
    };
    const warnSpy = jest.spyOn(utils, "warn").mockImplementation(() => {});
    expect(() => run(["--filter.services.name", "eq", "foo", "--options.mappings.services.action", "DELETE"], opaqueOperation)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
});

test("common global parameters are recognized across operations", () => {
    const warnSpy = jest.spyOn(utils, "warn").mockImplementation(() => {});
    expect(() => run(["--help", "true", "--options.logSink", "stderr"])).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
});
