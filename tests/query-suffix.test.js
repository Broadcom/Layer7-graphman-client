// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

function describeQuery(query) {
    return graphman("describe", "--query", query).stdout;
}

function fields(query) {
    return describeQuery(query).split("\n").map(line => line.trim());
}

describe("two-stage query suffix", () => {

    test("summary selects only summary fields", () => {
        const lines = fields("services:summary");
        expect(lines).toContain("checksum");
        expect(lines).toContain("serviceType");
        expect(lines).not.toContain("wsdl");
    });

    test("summary with field exclusion", () => {
        const lines = fields("services:summary:-checksum");
        expect(lines).toContain("goid");
        expect(lines).not.toContain("checksum");
    });

    test("summary,dependencies with exclusion and inclusion", () => {
        const all = fields("services:summary,dependencies:-goid,checksum");
        const lines = all.slice(0, all.indexOf("policy {")); // entity fields, ahead of the dependencies
        expect(lines).not.toContain("goid");
        expect(lines).toContain("checksum");
        expect(lines).toContain("name");
    });

    test("none with explicit fields", () => {
        const lines = fields("services:none:goid,name");
        expect(lines).toContain("goid");
        expect(lines).toContain("name");
        expect(lines).not.toContain("guid");
        expect(lines).not.toContain("checksum");
    });

    test("-* is treated as none", () => {
        const lines = fields("services:-*:goid");
        expect(lines).toContain("goid");
        expect(lines).not.toContain("name");
    });

    test("legacy single-stage field list still works", () => {
        const lines = fields("services:-checksum");
        expect(lines).toContain("wsdl");
        expect(lines).not.toContain("checksum");
        expect(fields("services:-*,goid")).not.toContain("name");
    });

    test("all returns standard fields", () => {
        const lines = fields("services:all:-wsdl");
        expect(lines).toContain("checksum");
        expect(lines).not.toContain("wsdl");
    });

    test("dependencies without policy selection adds only allDependencies", () => {
        const lines = fields("services:summary,dependencies");
        expect(lines).toContain("allDependencies {");
        expect(lines).not.toContain("xml");
    });

    test("dependencies with standard fields adds policy xml and allDependencies", () => {
        const lines = fields("services:dependencies");
        expect(lines).toContain("xml");
        expect(lines).toContain("allDependencies {");
    });

    test("no dependencies unless requested", () => {
        expect(fields("services:summary")).not.toContain("allDependencies {");
    });

    test("all:full injects dependencies for services and policies", () => {
        const count = fields("all:full").filter(line => line === "allDependencies {").length;
        expect(count).toBe(2);
    });

    test("file based queries do not get duplicate dependencies", () => {
        const count = fields("service:full").filter(line => line.startsWith("allDependencies")).length;
        expect(count).toBe(1);
    });
});
