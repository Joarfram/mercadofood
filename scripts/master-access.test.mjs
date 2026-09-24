import assert from "node:assert/strict";
import { isMasterHostname } from "../lib/master/domain.ts";
import { hasPlatformAccess } from "../lib/master/access.ts";

assert.equal(isMasterHostname("master.meumercadofood.com"), true);
assert.equal(isMasterHostname("master.meumercadofood.com:443"), true);
assert.equal(isMasterHostname("meumercadofood.com"), false);
assert.equal(isMasterHostname("cliente.meumercadofood.com"), false);
assert.equal(hasPlatformAccess("master", "master"), true);
assert.equal(hasPlatformAccess("support", "master"), false);
assert.equal(hasPlatformAccess("viewer", "master"), false);
assert.equal(hasPlatformAccess(undefined, "master"), false);
console.log("master-access: 8 cenários aprovados");
