/**
 * Auth integration test
 * Run: npx tsx test/auth.test.ts
 * Requires the server to be running on localhost:5000
 */

const BASE = "http://localhost:5000/api/v1";

// ─── Colours ────────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  cyan:  "\x1b[36m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  yellow:"\x1b[33m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
};
const pass = `${c.green}PASS${c.reset}`;
const fail = `${c.red}FAIL${c.reset}`;

// ─── Cookie jar ─────────────────────────────────────────────────────────────
interface StoredCookie {
  name: string;
  value: string;
  path: string;
}

class CookieJar {
  private cookies: StoredCookie[] = [];

  /** Parse and store cookies from Set-Cookie headers */
  ingest(headers: Headers): void {
    // Node fetch exposes multiple Set-Cookie values joined by ", " in a single
    // header. We use getSetCookie() if available (Node 18.14+), else split.
    const raw: string[] = (headers as any).getSetCookie
      ? (headers as any).getSetCookie()
      : (headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);

    for (const line of raw) {
      const parts = line.split(";").map((s) => s.trim());
      const [nameVal, ...attrs] = parts;
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx === -1) continue;
      const name  = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();

      // Parse path attribute
      let path = "/";
      for (const attr of attrs) {
        if (attr.toLowerCase().startsWith("path=")) {
          path = attr.slice(5).trim();
        }
      }

      // Check for Max-Age=0 or Expires in the past → delete cookie
      const isExpired = attrs.some(
        (a) => a.toLowerCase() === "max-age=0" || a.toLowerCase().startsWith("expires=thu, 01 jan 1970")
      );

      if (isExpired) {
        this.cookies = this.cookies.filter(
          (c) => !(c.name === name && c.path === path)
        );
      } else {
        const existing = this.cookies.find(
          (c) => c.name === name && c.path === path
        );
        if (existing) {
          existing.value = value;
        } else {
          this.cookies.push({ name, value, path });
        }
      }
    }
  }

  /** Build Cookie header string for the given request URL path */
  header(urlPath: string): string {
    return this.cookies
      .filter((c) => urlPath.startsWith(c.path))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }

  has(name: string): boolean {
    return this.cookies.some((c) => c.name === name);
  }

  names(): string[] {
    return this.cookies.map((c) => `${c.name}(path=${c.path})`);
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────
async function req(
  method: string,
  path: string,
  jar: CookieJar | null,
  body?: unknown
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const url = BASE + path;
  const urlPath = new URL(url).pathname;
  const cookieHeader = jar ? jar.header(urlPath) : "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (jar) jar.ingest(res.headers);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

// ─── Assertion helpers ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ${pass} ${label}`);
    passed++;
  } else {
    console.log(`  ${fail} ${label}${detail ? `  ${c.dim}(${detail})${c.reset}` : ""}`);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n${c.cyan}${c.bold}── ${name} ──${c.reset}`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────
async function runTests(): Promise<void> {
  console.log(`\n${c.bold}CodeEthnics Auth Integration Tests${c.reset}`);
  console.log(`${c.dim}Target: ${BASE}${c.reset}`);

  // ── 1. Health check ────────────────────────────────────────────────────────
  section("Health check");
  {
    const r = await req("GET", "/", null);
    assert("GET / → 200", r.status === 200);
    assert("status ok", (r.data as any)?.status === "ok");
  }

  // ── 2. Sign-up validation ──────────────────────────────────────────────────
  section("Sign-up validation");
  {
    const r = await req("POST", "/auth/sign-up", null, {
      email: "bad-email",
      password: "short",
      name: "",
    });
    assert("Weak payload → 400", r.status === 400);
  }
  {
    // Duplicate sign-up (seeded email)
    const r = await req("POST", "/auth/sign-up", null, {
      email: "student@codeethnics.com",
      password: "Student@1234",
      name: "Student User",
    });
    assert("Duplicate email → 400", r.status === 400);
  }

  // ── 3. Sign-in validation ──────────────────────────────────────────────────
  section("Sign-in validation");
  {
    const r = await req("POST", "/auth/sign-in", null, {
      identifier: "student@codeethnics.com",
      password: "WrongPassword1!",
    });
    assert("Wrong password → 401", r.status === 401);
  }
  {
    const r = await req("POST", "/auth/sign-in", null, {
      identifier: "nobody@nowhere.com",
      password: "Whatever1!",
    });
    assert("Unknown email → 401", r.status === 401);
  }
  {
    const r = await req("POST", "/auth/sign-in", null, {
      identifier: "ghost_user",
      password: "Whatever1!",
    });
    assert("Unknown username → 401", r.status === 401);
  }

  // ── 4. Student session ────────────────────────────────────────────────────
  section("Student session");
  const studentJar = new CookieJar();
  {
    const r = await req("POST", "/auth/sign-in", studentJar, {
      identifier: "student@codeethnics.com",
      password: "Student@1234",
    });
    assert("Student sign-in (email) → 200", r.status === 200);
    assert("access_token cookie set", studentJar.has("access_token"),
      `cookies: ${studentJar.names().join(", ")}`);
    assert("refresh_token cookie set", studentJar.has("refresh_token"),
      `cookies: ${studentJar.names().join(", ")}`);
    const d = r.data as any;
    assert("response.user.role === student", d?.user?.role === "student");
    assert("response.user.username present", !!d?.user?.username);
  }

  // ── 5. Protected routes (student) ─────────────────────────────────────────
  section("Protected routes — student");
  {
    const r = await req("GET", "/me", studentJar);
    assert("GET /me → 200", r.status === 200);
    const d = r.data as any;
    assert("/me returns user.id", !!d?.user?.id);
    assert("/me returns redirect path", typeof d?.redirect === "string");
  }
  {
    const r = await req("GET", "/student/dashboard", studentJar);
    assert("GET /student/dashboard → 200", r.status === 200);
    assert("dashboard panel === student", (r.data as any)?.panel === "student");
  }
  {
    const r = await req("GET", "/student/profile", studentJar);
    assert("GET /student/profile → 200", r.status === 200);
    assert("profile email present", !!(r.data as any)?.email);
  }

  // ── 6. Role guard ──────────────────────────────────────────────────────────
  section("Role guard");
  {
    const r = await req("GET", "/admin/dashboard", studentJar);
    assert("Student → admin route → 403", r.status === 403);
  }
  {
    const r = await req("GET", "/me", null);
    assert("No cookie → /me → 401", r.status === 401);
  }

  // ── 7. Token refresh ──────────────────────────────────────────────────────
  section("Token refresh");
  {
    const r = await req("POST", "/auth/refresh", studentJar);
    assert("POST /auth/refresh → 200", r.status === 200,
      `status=${r.status} body=${JSON.stringify(r.data)}`);
    assert("New access_token issued", studentJar.has("access_token"),
      `cookies after: ${studentJar.names().join(", ")}`);
    // Verify the refreshed token still works
    const r2 = await req("GET", "/me", studentJar);
    assert("Refreshed token still authenticates", r2.status === 200);
  }

  // ── 8. Username login ─────────────────────────────────────────────────────
  // Note: sign-in invalidates all previous refresh tokens (single-device).
  // Run this after token refresh so studentJar's token isn't clobbered early.
  section("Username login");
  {
    const usernameJar = new CookieJar();
    const r = await req("POST", "/auth/sign-in", usernameJar, {
      identifier: "student",
      password: "Student@1234",
    });
    assert("Sign in with username → 200", r.status === 200);
    assert("access_token cookie set", usernameJar.has("access_token"));
    assert("username in response", !!(r.data as any)?.user?.username);
    // Also verify wrong username password fails
    const r2 = await req("POST", "/auth/sign-in", null, {
      identifier: "student",
      password: "WrongPass1!",
    });
    assert("Wrong password (username) → 401", r2.status === 401);
  }

  // ── 9. Admin session ──────────────────────────────────────────────────────
  section("Admin session");
  const adminJar = new CookieJar();
  {
    const r = await req("POST", "/auth/sign-in", adminJar, {
      identifier: "admin@codeethnics.com",
      password: "Admin@1234",
    });
    assert("Admin sign-in → 200", r.status === 200);
    assert("access_token cookie set", adminJar.has("access_token"));
    const d = r.data as any;
    assert("response.user.role is admin", d?.user?.role === "product_admin");
  }
  {
    const r = await req("GET", "/admin/dashboard", adminJar);
    assert("GET /admin/dashboard → 200", r.status === 200);
    assert("dashboard panel === admin", (r.data as any)?.panel === "admin");
  }
  {
    const r = await req("GET", "/admin/users", adminJar);
    assert("GET /admin/users → 200", r.status === 200);
    assert("users array returned", Array.isArray((r.data as any)?.users));
  }

  // ── 9. Change password ─────────────────────────────────────────────────────
  section("Change password");
  const changePwJar = new CookieJar();
  {
    // Sign in with original password
    await req("POST", "/auth/sign-in", changePwJar, {
      identifier: "student@codeethnics.com",
      password: "Student@1234",
    });
    // Change password
    const r = await req("POST", "/auth/change-password", changePwJar, {
      currentPassword: "Student@1234",
      newPassword: "Student@5678",
    });
    assert("Change password → 200", r.status === 200,
      `status=${r.status} body=${JSON.stringify(r.data)}`);
    // Sign in with new password
    const changePwJar2 = new CookieJar();
    const r2 = await req("POST", "/auth/sign-in", changePwJar2, {
      identifier: "student@codeethnics.com",
      password: "Student@5678",
    });
    assert("Sign in with new password → 200", r2.status === 200);
    // Restore original password
    const r3 = await req("POST", "/auth/change-password", changePwJar2, {
      currentPassword: "Student@5678",
      newPassword: "Student@1234",
    });
    assert("Restore original password → 200", r3.status === 200,
      `status=${r3.status} body=${JSON.stringify(r3.data)}`);
  }

  // ── 10. Sign out ───────────────────────────────────────────────────────────
  section("Sign out");
  {
    // Sign in fresh for sign-out test
    const soJar = new CookieJar();
    await req("POST", "/auth/sign-in", soJar, {
      identifier: "student@codeethnics.com",
      password: "Student@1234",
    });
    const r = await req("POST", "/auth/sign-out", soJar);
    assert("POST /auth/sign-out → 200", r.status === 200);
    // Cookies should be cleared (Max-Age=0) — jar removes them
    assert("access_token removed from jar", !soJar.has("access_token"),
      `cookies after sign-out: ${soJar.names().join(", ")}`);
    // Subsequent /me with cleared cookies should 401
    const r2 = await req("GET", "/me", soJar);
    assert("GET /me after sign-out → 401", r2.status === 401);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${c.bold}Results: ${passed}/${total} passed${c.reset}`);
  if (failed > 0) {
    console.log(`${c.red}${failed} test(s) failed${c.reset}`);
    process.exit(1);
  } else {
    console.log(`${c.green}All tests passed${c.reset}`);
  }
}

runTests().catch((err) => {
  console.error(`\n${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
