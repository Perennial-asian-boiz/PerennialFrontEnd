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
  assert.equal(api.hasPendingLoginCode("one@example.com"), true);
  assert.equal(api.hasPendingLoginCode("other@example.com"), false);
});

test("a successful resend starts the server-provided cooldown", async () => {
  const { api } = await client(async (url) => {
    if (url.endsWith("/auth/login")) {
      return reply({ ...challenge, resend_after_seconds: 0 });
    }
    assert.ok(url.endsWith("/auth/resend-otp"));
    return reply({ ...challenge, resend_after_seconds: 60 });
  });

  await api.login("one@example.com", "password123");
  assert.equal(api.getResendSeconds(), 0);
  await api.resendOtp("one@example.com");
  assert.ok(api.getResendSeconds() > 0);
});

test("signup remains an email-link flow and does not sign the user in", async () => {
  const { api } = await client(async (url, init) => {
    assert.ok(url.endsWith("/auth/signup"));
    assert.deepEqual(JSON.parse(init.body), { email: "new@example.com", full_name: "New User", password: "password123" });
    return reply({ ...challenge, flow: "signup", verification_method: "email_link" }, 201);
  });
  const result = await api.signup("new@example.com", "New User", "password123");
  assert.equal(result.verification_method, "email_link");
  assert.equal(api.getSessionToken(), null);
  assert.equal(api.hasPendingLoginCode("new@example.com"), false);
});

test("an expired challenge cannot be resumed from the sign-in page", async () => {
  const { api, storage } = await client(async () => reply(challenge));
  await api.login("one@example.com", "password123");
  storage.set("perennial.challenge_expires_at", String(Date.now() - 1));
  assert.equal(api.hasPendingLoginCode("one@example.com"), false);
});

test("duplicate email errors do not become account-created success", async () => {
  const { api } = await client(async () => reply({ detail: "This email is already registered. Please sign in instead." }, 409));
  await assert.rejects(api.signup("one@example.com", "One", "password123"), (error) => error.status === 409);
  assert.equal(api.getPendingChallenge(), "");
  assert.equal(api.getSessionToken(), null);
});

test("signup exposes safe per-field errors without saving an account or challenge", async () => {
  const { api } = await client(async () => reply({
    detail: "Choose a longer password.", code: "weak_password",
    field_errors: { password: "Choose a longer password.", email: 123, unknown: "ignored" },
  }, 422));
  await assert.rejects(api.signup("new@example.com", "Ád", "password123"), (error) => {
    assert.equal(error.status, 422);
    assert.equal(error.code, "weak_password");
    assert.deepEqual(error.fieldErrors, { password: "Choose a longer password." });
    return true;
  });
  assert.equal(api.getPendingChallenge(), "");
  assert.equal(api.getSessionToken(), null);
});

test("email delivery setup errors remain general errors, not password errors", async () => {
  const message = "Email verification isn't fully set up yet. Please try again later or contact support.";
  const { api } = await client(async () => reply({ detail: message, code: "email_address_not_authorized", field_errors: {} }, 503));
  await assert.rejects(api.signup("new@example.com", "New User", "password123"), (error) => {
    assert.equal(error.message, message);
    assert.deepEqual(error.fieldErrors, {});
    return true;
  });
});

test("signup validation identifies each field, accepts Unicode names, and never includes the password", async () => {
  const passwordRequirementsSource = await readFile(new URL("../src/lib/passwordRequirements.ts", import.meta.url), "utf8");
  const passwordRequirementsCompiled = ts.transpileModule(passwordRequirementsSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const passwordRequirementsUrl = `data:text/javascript;base64,${Buffer.from(passwordRequirementsCompiled).toString("base64")}`;
  const source = (await readFile(new URL("../src/lib/signupValidation.ts", import.meta.url), "utf8"))
    .replace('from "./passwordRequirements"', `from "${passwordRequirementsUrl}"`);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const { validateSignup } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  const valid = { full_name: "Ád Nguyễn", email: "one@example.com", password: "Password123", confirmPassword: "Password123" };
  assert.deepEqual(validateSignup(valid), {});
  const empty = validateSignup({ full_name: "   ", email: "", password: "", confirmPassword: "" });
  assert.deepEqual(Object.keys(empty), ["full_name", "email", "password", "confirmPassword"]);
  const errors = validateSignup({ ...valid, email: "bad-email", password: "secret" });
  assert.match(errors.email, /valid email/);
  assert.match(errors.password, /uppercase letter/);
  assert.match(errors.confirmPassword, /do not match/);
  assert.equal(JSON.stringify(errors).includes("secret"), false);
  assert.match(validateSignup({ ...valid, password: "x".repeat(201) }).password, /no more than 200/);
  assert.match(validateSignup({ ...valid, full_name: "x".repeat(201) }).full_name, /no more than 200/);
  assert.match(validateSignup({ ...valid, email: "<name>@example.com" }).email, /valid email/);
  assert.match(validateSignup({ ...valid, password: "alllowercase1" }).password, /uppercase letter/);
  assert.match(validateSignup({ ...valid, password: "ALLUPPERCASE1" }).password, /lowercase letter/);
  assert.match(validateSignup({ ...valid, password: "NoNumberHere" }).password, /number/);
});

test("confirming an emailed token never stores its credentials as an app login", async () => {
  const { api, storage } = await client(async (url, init) => {
    assert.ok(url.endsWith("/auth/confirm-email"));
    assert.equal(init.headers.has("Authorization"), false);
    assert.deepEqual(JSON.parse(init.body), { access_token: "email-only-token" });
    return reply({ email_confirmed: true });
  });
  assert.equal((await api.confirmEmailLink("email-only-token")).email_confirmed, true);
  assert.equal(api.getSessionToken(), null);
  assert.equal(storage.has("perennial.refresh_token"), false);
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
  assert.equal(api.hasPendingLoginCode("one@example.com"), false);
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

test("forgot-password accepts the generic response and reset clears the recovery session", async () => {
  const { api, storage } = await client(async (url, init) => {
    if (url.endsWith("/auth/forgot-password")) return reply({ message: "If an account exists for this email, password reset instructions will be sent." });
    assert.ok(url.endsWith("/auth/reset-password"));
    assert.equal(init.headers.get("Authorization"), "Bearer recovery");
    assert.deepEqual(JSON.parse(init.body), { new_password: "newpassword" });
    return reply({ message: "Password reset successfully" });
  });
  await api.forgotPassword("one@example.com");
  assert.equal(api.getPendingChallenge(), "");
  storage.set("perennial.access_token", "recovery");
  storage.set("perennial.refresh_token", "recovery-refresh");
  await api.resetPassword("newpassword");
  assert.equal(api.getSessionToken(), null);
});
