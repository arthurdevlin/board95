import assert from "node:assert/strict";
import { it } from "node:test";
import { CITIES, TRANSPORT_DISTRICTS, parseTransportLocation, transportLocationName } from "../src/lib/cities.ts";
import { CAR_HIRE_DISTRICTS } from "../src/lib/car-hire-districts.ts";

it("covers all districts consistently with car hire and retains existing Mzuzu routes", () => {
  assert.equal(TRANSPORT_DISTRICTS.length, 28);
  assert.equal(new Set(TRANSPORT_DISTRICTS).size, 28);
  assert.deepEqual(TRANSPORT_DISTRICTS.map(transportLocationName).sort(), CAR_HIRE_DISTRICTS.map(([, label]) => label).sort());
  assert.ok(CITIES.includes("Mzuzu"));
  assert.equal(parseTransportLocation(" Nkhata Bay "), "NkhataBay");
  assert.equal(transportLocationName("NkhataBay"), "Nkhata Bay");
  assert.equal(parseTransportLocation("invalid location"), undefined);
});
