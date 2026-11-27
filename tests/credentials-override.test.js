// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

// The credentials of the gateway profiles can be overridden from the command line,
// --credentials.<name>.<field> <value>. None of these tests need a gateway.

const tUtils = require("./utils");
const {graphman} = tUtils;
const graphmanModule = tUtils.load("graphman");

const HOME = tUtils.config().home;

// (re)initializes the client the way the CLI does, with the given command line parameters
const init = (params = {}) => {
    graphmanModule.init(HOME, Object.assign({options: {}}, params));
    return graphmanModule.configuration();
};

afterAll(() => init());

describe("credentials are overridden using the command line parameters", () => {
    test("without overrides, the configured credentials are used as they are", () => {
        const config = init();

        expect(config.credentials.default).toBeDefined();
        expect(Object.keys(config.credentials)).not.toContain("cli-override-test");
    });

    test("only the specified fields are overridden, the rest is retained", () => {
        const configured = JSON.parse(JSON.stringify(init().credentials.default));
        const config = init({credentials: {default: {password: "cli-password"}}});

        expect(config.credentials.default.password).toBe("cli-password");
        expect(config.credentials.default.username).toBe(configured.username);
        expect(config.credentials.default.keyFilename).toBe(configured.keyFilename);
    });

    test("username and password can be overridden together", () => {
        const config = init({credentials: {default: {username: "cli-user", password: "cli-password"}}});

        expect(config.credentials.default).toMatchObject({username: "cli-user", password: "cli-password"});
    });

    test("other credentials are not touched", () => {
        const before = JSON.parse(JSON.stringify(init().credentials));
        const after = init({credentials: {default: {password: "cli-password"}}}).credentials;

        Object.keys(before).filter(name => name !== "default").forEach(name => {
            expect(after[name]).toEqual(before[name]);
        });
    });

    test("a credential that is not configured is created", () => {
        const config = init({credentials: {"cli-override-test": {username: "u1", password: "p1"}}});

        expect(config.credentials["cli-override-test"]).toEqual({username: "u1", password: "p1"});
    });

    test("the overridden credentials are used by the gateway request", () => {
        init({
            credentials: {"cli-override-test": {username: "u1", password: "p1"}},
            gateways: {"cli-override-gateway": {address: "https://localhost:8443/graphman", credential: "cli-override-test"}}
        });

        const gateway = graphmanModule.gatewayConfiguration("cli-override-gateway");
        const request = graphmanModule.request(gateway, {});

        expect(request.auth).toBe("u1:p1");
    });

    test("the overridden password of the configured credential is used by the gateway request", () => {
        init({credentials: {default: {username: "u2", password: "p2"}}});

        const request = graphmanModule.request(graphmanModule.gatewayConfiguration("default"), {});

        expect(request.auth).toBe("u2:p2");
    });
});

describe("credentials parameters are accepted by the command line", () => {
    test("no unknown parameter warning for --credentials.<name>.<field>", () => {
        const output = graphman("version",
            "--credentials.default.username", "cli-user",
            "--credentials.default.password", "cli-password");

        expect(output.stdout + output.stderr).not.toContain("unknown parameter: credentials");
    });

    test("the unknown parameters are still reported", () => {
        const output = graphman("version", "--credentialz.default.password", "cli-password");

        expect(output.stdout + output.stderr).toContain("unknown parameter: credentialz");
    });

    test("the password of a credential is not echoed back", () => {
        const output = graphman("version", "--credentials.default.password", "super-secret-cli-password");

        expect(output.stdout + output.stderr).not.toContain("super-secret-cli-password");
    });
});
