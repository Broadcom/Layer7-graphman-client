// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const fs = require('fs');

// package.json
const pkgFile = "package.json";
const pkg = JSON.parse(String(fs.readFileSync(pkgFile)));
pkg.scripts.test = "jest --runInBand";
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 4));

// graphman.configuration
const cfgFile = "graphman.configuration";
const cfg = JSON.parse(String(fs.readFileSync(cfgFile)));
cfg.gateways['source-gateway'] = Object.assign({}, cfg.gateways['default']);
cfg.gateways['target-gateway'] = Object.assign({}, cfg.gateways['default'], {allowMutations: true});
fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 4));
