// Payment rail tests — license keys + LS webhook signature verification.
import { issueLicense, validateLicense } from "./license-keys.js";
import lsWebhook, { stableStringify } from "./ls-webhook.js";

let passed = 0, failed = 0;
const ok = (c, n) => { if (c) { passed++; console.log("  ✓", n); } else { failed++; console.error("  ✗ FAIL:", n); } };

const ENV = { LS_LICENSE_SECRET: "test-secret-123" };

console.log("license keys");
const pro = await issueLicense("pro", ENV);
const studio = await issueLicense("studio", ENV);
const founder = await issueLicense("founder", ENV);
ok(/^SK1-[0-9a-z]+-[0-9a-f]{16}$/.test(pro), "pro key format");
ok(/^SK4-/.test(studio) && /^SKF-/.test(founder), "studio/founder prefixes");
ok(await issueLicense("pro", {}) === null, "no secret → null (rail inert)");

let v = await validateLicense(pro, ENV);
ok(v.valid && v.plan === "pro" && v.monthlySermons === 12, "pro validates → 12/mo");
v = await validateLicense(studio, ENV);
ok(v.valid && v.monthlySermons === 40, "studio validates → 40/mo");
v = await validateLicense(founder, ENV);
ok(v.valid && v.plan === "founder", "founder validates");

ok((await validateLicense(pro.toLowerCase(), ENV)).valid, "case-insensitive");
ok(!(await validateLicense("SK1-xxx-deadbeefdeadbeef", ENV)).valid, "garbage rejected");
const tamper = (k) => k.slice(0, -1) + (k.endsWith("0") ? "1" : "0"); // guaranteed different last char
ok(!(await validateLicense(tamper(pro), ENV)).valid, "tampered key rejected");
ok(!(await validateLicense(pro, { LS_LICENSE_SECRET: "other" })).valid, "wrong secret rejected");
const future = "SK1-" + (Date.now() + 86400000).toString(36) + "-0000000000000000";
ok(!(await validateLicense(future, ENV)).valid, "future stamp rejected");
ok(!(await validateLicense(pro, {})).valid && (await validateLicense(pro, {})).reason === "not_configured", "no secret → not_configured");

console.log("ls webhook");
let code, body; const res = { status(c){ code=c; return this; }, json(j){ body=j; return this; }, end(){ return this; } };
await lsWebhook({ method: "GET" }, res);
ok(code === 405, "GET → 405");
await lsWebhook({ method: "POST", headers: {}, body: {} }, res);
ok(code === 503, "no secret → 503 not_configured");

// Sign a real LS-shaped payload
const payload = { meta: { event_name: "order_created" }, data: { attributes: { user_email: "pastor@church.org", first_order_item: { variant_id: 777 } } } };
const raw = JSON.stringify(payload);
const enc = new TextEncoder();
const key = await crypto.subtle.importKey("raw", enc.encode("whsec-test"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)))).map(b => b.toString(16).padStart(2, "0")).join("");
process.env.LS_WEBHOOK_SECRET = "whsec-test";
process.env.LS_VARIANTS = JSON.stringify({ "777": "founder" });

await lsWebhook({ method: "POST", headers: { "x-signature": "deadbeef" }, body: raw }, res);
ok(code === 401, "bad signature → 401");
// Parsed-object body signed over recursively sorted keys (serialization quirk) → accepted via stable-stringify fallback
const sortedRaw = stableStringify(payload);
const sigSorted = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(sortedRaw)))).map(b => b.toString(16).padStart(2, "0")).join("");
await lsWebhook({ method: "POST", headers: { "x-signature": sigSorted }, body: payload }, res);
ok(code === 200 && body.ok && body.plan === "founder", "sorted-key serialization verified via stable-stringify fallback");
await lsWebhook({ method: "POST", headers: { "x-signature": sig }, body: payload }, res);
ok(code === 200 && body.ok && body.plan === "founder", "valid signature → 200, plan from variant map");
ok(/^SKF-/.test(body.license), "webhook issues founder license key");
const issuedLicense = body.license; // capture before subsequent calls overwrite `body`
const ignore = { meta: { event_name: "subscription_updated" }, data: { attributes: {} } };
const raw2 = JSON.stringify(ignore);
const sig2 = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw2)))).map(b => b.toString(16).padStart(2, "0")).join("");
await lsWebhook({ method: "POST", headers: { "x-signature": sig2 }, body: raw2 }, res);
ok(code === 200 && body.ignored === "subscription_updated", "non-order event → ignored 200");
delete process.env.LS_WEBHOOK_SECRET;

// webhook-issued key validates end to end
const vk = await validateLicense(issuedLicense, { LS_WEBHOOK_SECRET: "whsec-test" });
ok(vk.valid && vk.plan === "founder", "issued key validates under webhook secret");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
