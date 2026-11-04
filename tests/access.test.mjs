import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canApplyForOperator, canBrowseListings, roleHome } from "../src/lib/access.ts";

describe("listing permissions and role homes", () => {
  for (const [label, user, browse, apply, home] of [
    ["guest", null, true, false, "/"],
    ["passenger", { role: "CUSTOMER" }, true, true, "/account"],
    ["bus staff or company admin", { role: "CUSTOMER", isBusMember: true }, false, false, "/operator"],
    ["taxi or bus owner", { role: "OWNER" }, false, false, "/operator"],
    ["car hire provider", { role: "CAR_HIRER" }, false, false, "/car-hire/dashboard"],
    ["system administrator", { role: "ADMIN" }, true, false, "/admin"],
    ["system administrator with bus membership", { role: "ADMIN", isBusMember: true }, true, false, "/admin"],
    ["unknown role", { role: "UNKNOWN" }, false, false, "/account"],
  ]) {
    it(`enforces permissions for ${label}`, () => {
      assert.equal(canBrowseListings(user), browse);
      assert.equal(Boolean(canApplyForOperator(user)), apply);
      assert.equal(roleHome(user), home);
    });
  }
});
