import assert from "node:assert/strict";
import { beforeEach, it } from "node:test";
import { registerHooks } from "node:module";

globalThis.adminEmailDB = {};
registerHooks({ resolve(specifier, context, next) {
  const mocks = {
    "@/lib/prisma": "export const prisma = globalThis.adminEmailDB;",
    "@/lib/session": "export async function getSession() { return globalThis.adminEmailSession; }",
    "next/cache": "export function revalidatePath() {}",
  };
  if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });

const { saveAdminEmailSettings } = await import("../src/lib/admin-email-actions.ts");
const { getBoard95AdminEmails } = await import("../src/lib/admin-email-settings.ts");
const { sendBoard95Email } = await import("../src/lib/email.ts");
let settings, writes, deliveries;
const db = globalThis.adminEmailDB;
beforeEach(() => {
  globalThis.adminEmailSession = null;
  settings = null; writes = []; deliveries = [];
  process.env.BOARD95_ADMIN_EMAIL = "fallback@example.test";
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  db.board95EmailSettings = {
    async findUnique() { return settings; },
    async upsert(query) { writes.push(query); settings = query.update; },
  };
  db.emailDelivery = { async create(query) { deliveries.push(query.data); return { id: `email-${deliveries.length}` }; } };
});
function form(primaryEmail, secondaryEmail = "") {
  const data = new FormData(); data.set("primaryEmail", primaryEmail); data.set("secondaryEmail", secondaryEmail); return data;
}

it("rejects guests and non-admins before changing notification recipients", async () => {
  for (const session of [null, { user: { id: "passenger", role: "CUSTOMER" } }]) {
    globalThis.adminEmailSession = session;
    assert.match((await saveAdminEmailSettings({}, form("one@example.test"))).error, /Administrator/);
  }
  assert.equal(writes.length, 0);
});
it("validates both inboxes and rejects duplicate addresses without saving", async () => {
  globalThis.adminEmailSession = { user: { id: "admin", role: "ADMIN" } };
  for (const values of [["invalid", ""], ["one@example.test", "invalid"], ["one@example.test", " ONE@example.test "]]) {
    assert.ok((await saveAdminEmailSettings({}, form(...values))).error);
  }
  assert.equal(writes.length, 0);
});
it("saves and routes both admin inboxes, and removes the optional inbox when cleared", async () => {
  globalThis.adminEmailSession = { user: { id: "admin", role: "ADMIN" } };
  assert.equal((await saveAdminEmailSettings({}, form(" ONE@example.test ", "Two@example.test"))).saved, true);
  assert.deepEqual(await getBoard95AdminEmails(), ["one@example.test", "two@example.test"]);
  await saveAdminEmailSettings({}, form("one@example.test"));
  assert.equal(writes[1].update.secondaryEmail, null);
  assert.deepEqual(await getBoard95AdminEmails(), ["one@example.test"]);
});
it("uses the environment recipient until settings are saved", async () => {
  assert.deepEqual(await getBoard95AdminEmails(), ["fallback@example.test"]);
});
it("queues one private delivery per distinct admin inbox without contacting Resend", async () => {
  await sendBoard95Email({ to: ["ONE@example.test", "one@example.test", "two@example.test"], subject: "Application", lines: ["Review the new application."] });
  assert.deepEqual(deliveries.map(email => email.recipient), ["one@example.test", "two@example.test"]);
});
it("keeps password-reset and other direct messages addressed only to the requested inbox", async () => {
  settings = { primaryEmail: "admin@example.test", secondaryEmail: "second@example.test" };
  await sendBoard95Email({ to: "passenger@example.test", subject: "Reset password", lines: ["Reset your password."] });
  assert.deepEqual(deliveries.map(email => email.recipient), ["passenger@example.test"]);
});
