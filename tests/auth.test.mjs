// Test the actual typed client with Node's built-in runner and no new packages.
// Vite's public build setting is replaced only in the in-memory test module.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

let moduleId = 0;
async function client(fetchImpl) {
  const source = (await readFile(new URL("../src/api/auth.ts", import.meta.url), "utf8"))
    .replaceAll("import.meta.env.VITE_API_URL", '"http://test.invalid"');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window = new EventTarget();
  globalThis.fetch = fetchImpl;
  const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${moduleId++}`);
  return { api, storage };
}

const challenge = { challenge_id: "test-challenge", flow: "login", verification_required: true, resend_after_seconds: 60 };
const session = { access_token: "access", refresh_token: "refresh", expires_at: 9999999999, flow: "login", token_type: "bearer", user: { id: "uuid", email: "one@example.com", full_name: "One", is_verified: true, onboarding_completed: true } };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("password login stores a challenge, never an authenticated session", async () => {
  const { api } = await client(async (url, init) => {
    assert.ok(url.endsWith("/auth/login"));
    assert.deepEqual(JSON.parse(init.body), { email: "one@example.com", password: "password123" });
    return reply(challenge);
  });
  await api.login("one@example.com", "password123");
  assert.equal(api.getSessionToken(), null);
  assert.equal(api.getPendingChallenge(), "test-challenge");
  assert.equal(api.getPendingEmail(), "one@example.com");
  assert.ok(api.getResendSeconds() > 0);
});

test("verification submits the challenge and saves both tokens, without a development code", async () => {
  const { api, storage } = await client(async (url, init) => {
    if (url.endsWith("/auth/login")) return reply(challenge);
    assert.deepEqual(JSON.parse(init.body), { email: "one@example.com", code: "123456", challenge_id: "test-challenge" });
    return reply(session);
  });
  await api.login("one@example.com", "password123");
  const result = await api.verifyOtp("one@example.com", "123456");
  assert.equal(result.user.onboarding_completed, true);
  assert.equal(api.getSessionToken(), "access");
  assert.equal(storage.get("perennial.refresh_token"), "refresh");
  assert.equal(api.getPendingChallenge(), "");
  assert.equal(api.getPendingEmail(), "");
  api.clearSession();
  assert.equal(api.getSessionToken(), null);
  assert.equal(storage.has("perennial.refresh_token"), false);
});

test("concurrent unauthorized account calls share one token refresh", async () => {
  let refreshes = 0;
  const { api, storage } = await client(async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes += 1;
      assert.deepEqual(JSON.parse(init.body), { refresh_token: "old-refresh" });
      return reply(session);
    }
    if (init.headers.get("Authorization") === "Bearer old-access") return reply({ detail: "Expired" }, 401);
    assert.equal(init.headers.get("Authorization"), "Bearer access");
    return reply(url.endsWith("/me/preferences") ? { sectors: [], risk_level: null } : session.user);
  });
  storage.set("perennial.access_token", "old-access");
  storage.set("perennial.refresh_token", "old-refresh");
  await Promise.all([api.getMe(), api.getPreferences()]);
  assert.equal(refreshes, 1);
  assert.equal(api.getSessionToken(), "access");
});

test("revoked refresh clears tokens; a provider outage keeps them for retry", async () => {
  let status = 503;
  const { api, storage } = await client(async (url) => reply({ detail: "Unavailable" }, url.endsWith("/auth/refresh") ? status : 401));
  storage.set("perennial.access_token", "old-access");
  storage.set("perennial.refresh_token", "old-refresh");
  await assert.rejects(api.getMe(), (error) => error.status === 503);
  assert.equal(api.getSessionToken(), "old-access");
  status = 401;
  await assert.rejects(api.getMe(), (error) => error.status === 401);
  assert.equal(api.getSessionToken(), null);
  assert.equal(storage.has("perennial.refresh_token"), false);
});

test("in-flight refresh cannot restore a session after sign out", async () => {
  let resolveRefresh;
  const pendingRefresh = new Promise((resolve) => { resolveRefresh = resolve; });
  const { api, storage } = await client(async (url) => url.endsWith("/auth/refresh") ? pendingRefresh : reply({ detail: "Expired" }, 401));
  storage.set("perennial.access_token", "old-access");
  storage.set("perennial.refresh_token", "old-refresh");
  const request = api.getMe();
  // Let the first unauthorized response enter the refresh path.
  await new Promise((resolve) => setImmediate(resolve));
  api.clearSession();
  resolveRefresh(reply(session));
  await assert.rejects(request, (error) => error.status === 401);
  assert.equal(api.getSessionToken(), null);
});

test("forgot-password starts a real challenge and reset clears the recovery session", async () => {
  const { api, storage } = await client(async (url, init) => {
    if (url.endsWith("/auth/forgot-password")) return reply({ ...challenge, flow: "recovery" });
    assert.ok(url.endsWith("/auth/reset-password"));
    assert.equal(init.headers.get("Authorization"), "Bearer recovery");
    assert.deepEqual(JSON.parse(init.body), { new_password: "newpassword" });
    return reply({ message: "Password reset successfully" });
  });
  await api.forgotPassword("one@example.com");
  assert.equal(api.getPendingChallenge(), "test-challenge");
  storage.set("perennial.access_token", "recovery");
  storage.set("perennial.refresh_token", "recovery-refresh");
  await api.resetPassword("newpassword");
  assert.equal(api.getSessionToken(), null);
});
