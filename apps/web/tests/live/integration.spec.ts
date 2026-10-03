import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
const fixture = JSON.parse(
  fs.readFileSync("/tmp/velora-integration-fixture.json", "utf8"),
);
const future = (days: number) =>
  new Date(Date.now() + 86400000 * days).toISOString().slice(0, 10);
async function login(page: Page, email = fixture.ownerEmail) {
  await page.goto("/desk");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
}
async function call(
  page: Page,
  path: string,
  method = "GET",
  body?: unknown,
  staff = false,
) {
  return page.evaluate(
    async ({ path, method, body, tenantId, staff }) => {
      const r = await fetch(`/api/v1/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": tenantId,
          ...(staff ? { "X-Staff-Session": "1" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, json: await r.json() };
    },
    { path, method, body, tenantId: fixture.tenantId, staff },
  );
}
async function customerLogin(page: Page) {
  await page.getByRole("button", { name: "Use demo number" }).click();
  await page.getByRole("button", { name: "Continue with Phone" }).click();
  await page.getByLabel("Demo code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Continue to Booking" }).click();
}
async function nextStep(page: Page) {
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
}
async function book(page: Page, name: string, days = 7) {
  await page.goto("/book");
  await customerLogin(page);
  await page.getByRole("button", { name: /Integration Haircut/ }).click();
  await nextStep(page);
  await page.getByLabel("Preferred professional").selectOption(fixture.staffId);
  await nextStep(page);
  await page.getByLabel("Appointment date").fill(future(days));
  await page.getByRole("button", { name: "09:00", exact: true }).click();
  await nextStep(page);
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByLabel("Phone number", { exact: true }).fill("+910000000123");
  await nextStep(page);
  await page.getByLabel("Street address").fill("42 Test Street");
  await page.getByLabel("City", { exact: true }).fill("Mumbai");
  await page.getByLabel("Postal code").fill("400001");
  await page.getByLabel("Country", { exact: true }).fill("India");
  await nextStep(page);
  await expect(
    page.getByText("42 Test Street, Mumbai, 400001, India", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Confirm Booking/ }).click();
  await expect(page).toHaveURL(/customer\/bookings/);
  await expect(page.getByText("Booking reference:")).toBeVisible();
  return page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("velora-live-booking") || "[]",
      )[0] as string,
  );
}

test("real catalogue, branch contact details, and responsive public routes", async ({
  page,
}) => {
  for (const width of [390, 768, 1448]) {
    await page.setViewportSize({ width, height: 1086 });
    for (const path of [
      "/",
      "/services",
      "/professionals",
      "/book",
      "/queue",
      "/contact",
      "/customer/bookings",
    ]) {
      await page.goto(path);
      await expect(page.getByText("Loading salon…")).toBeHidden();
      await expect(page.locator("body")).not.toContainText(
        "123 Aesthetica Lane",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
  }
  await page.goto("/services");
  await expect(
    page.getByRole("heading", { name: "Integration Haircut" }),
  ).toBeVisible();
});

test("booking persists in PostgreSQL, survives refresh, reschedules, and cancels", async ({
  page,
}) => {
  const id = await book(page, "Integration Booking");
  await page.reload();
  await expect(page.getByText("Booking reference:")).toBeVisible();
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === `velora_booking_${id}`,
  );
  expect(cookie?.httpOnly).toBeTruthy();
  expect(cookie?.sameSite).toBe("Strict");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "velora_booking_",
  );
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page.getByLabel("New date").fill(future(8));
  await expect(page.getByLabel("New time").locator("option")).not.toHaveCount(
    1,
  );
  await page.getByLabel("New time").selectOption("10:00");
  await page.getByRole("button", { name: "Save New Time" }).click();
  await expect(page.getByLabel("New date")).toBeHidden();
  const rescheduled = await call(page, `bookings/${id}`);
  expect(rescheduled.json.data.notes).toContain(
    "Customer address: 42 Test Street, Mumbai, 400001, India",
  );
  expect(rescheduled.json.data.notes).toContain(
    "Preferred contact: Phone. First visit: Yes.",
  );
  expect(rescheduled.json.data.startTime).toBe(`${future(8)}T04:30:00.000Z`);
  await page
    .getByLabel("Cancellation reason")
    .fill("Integration test complete");
  await page
    .getByRole("button", { name: "Cancel Booking", exact: true })
    .click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
});

test("combined service duration, incompatible professionals, breaks and conflict rejection", async ({
  page,
}) => {
  await page.goto("/book");
  await customerLogin(page);
  await page.getByRole("button", { name: /Integration Haircut/ }).click();
  await page.getByRole("button", { name: /Integration Hair Spa/ }).click();
  await nextStep(page);
  await expect(
    page.getByLabel("Preferred professional").locator("option"),
  ).toHaveCount(2);
  await page.getByLabel("Preferred professional").selectOption(fixture.staffId);
  await nextStep(page);
  await page.getByLabel("Appointment date").fill(future(9));
  await expect(
    page.getByRole("button", { name: "09:00", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "12:00", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "95 min" })).toBeVisible();
  const bad = await call(
    page,
    `bookings/availability?branchId=${fixture.branchId}&serviceIds=${fixture.serviceId},${fixture.spaId}&date=${future(9)}&staffId=${fixture.incompatibleStaffId}`,
  );
  expect(bad.json.data).toEqual([]);
  const input = {
    branchId: fixture.branchId,
    serviceIds: [fixture.serviceId, fixture.spaId],
    customerName: "Integration Conflict",
    customerPhone: "+910000000124",
    dateStr: future(9),
    timeStr: "09:00",
    staffId: fixture.staffId,
  };
  const first = await call(page, "bookings", "POST", input);
  expect(first.status).toBe(201);
  const second = await call(page, "bookings", "POST", input);
  expect(second.status).toBe(409);
  await call(page, `bookings/${first.json.data.id}/cancel`, "PATCH", {
    reason: "Integration cleanup",
  });
});

test("queue private receipt, cross-tab updates, reception calling and completion", async ({
  page,
  context,
}) => {
  await page.goto("/queue/join");
  await page.getByRole("button", { name: /Integration Haircut/ }).click();
  await page.getByLabel("Preferred professional").selectOption(fixture.staffId);
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Integration Queue Guest");
  await page.getByLabel("Phone number", { exact: true }).fill("+910000000125");
  await page.getByRole("button", { name: "Join Queue", exact: true }).click();
  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByText("waiting", { exact: true })).toBeVisible();
  const id = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("velora-live-queue") || "[]",
      )[0] as string,
  );
  const outsider = await context.browser()!.newContext();
  const foreign = await outsider.newPage();
  await foreign.goto("/");
  const denied = await call(foreign, `queue/track/${id}`);
  expect(denied.status).toBe(403);
  await outsider.close();
  const staff = await context.newPage();
  await login(staff);
  const row = staff
    .locator(".live-operational-row")
    .filter({ hasText: "Integration Queue Guest" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Call", exact: true }).click();
  await expect(page.getByText("called", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Assign / Start" }).click();
  await staff.getByLabel("Assigned professional").selectOption(fixture.staffId);
  await staff
    .getByRole("button", { name: "Start Service", exact: true })
    .click();
  await expect(page.getByText("in service", { exact: true })).toBeVisible();
  await staff
    .locator(".live-operational-row")
    .filter({ hasText: "Integration Queue Guest" })
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();
  const result = await call(page, `queue/track/${id}`);
  expect(result.json.data.estimatedWaitMinutes).toBe(0);
  expect(result.json.data).not.toHaveProperty("customer");
  expect(result.json.data).not.toHaveProperty("customerPhone");
});

test("queue leave persists and invalid status transitions are rejected", async ({
  page,
}) => {
  await page.goto("/queue/join");
  await page.getByRole("button", { name: /Integration Haircut/ }).click();
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Integration Leaving");
  await page.getByLabel("Phone number", { exact: true }).fill("+910000000126");
  await page.getByRole("button", { name: "Join Queue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Leave Queue" })).toBeVisible();
  await page.getByRole("button", { name: "Leave Queue" }).click();
  await expect(page.getByText("left", { exact: true })).toBeVisible();
  const id = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("velora-live-queue") || "[]",
      )[0] as string,
  );
  const again = await call(page, `queue/${id}/leave`, "PATCH", {});
  expect(again.status).toBe(400);
});

test("reception walk-in dialog, reasoned reordering, lookup and booking check-in", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Add Walk-in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Integration Haircut/ }).click();
  await dialog
    .getByLabel("Your name", { exact: true })
    .fill("Integration Desk Walkin");
  await dialog
    .getByLabel("Phone number", { exact: true })
    .fill("+910000000127");
  await dialog
    .getByRole("button", { name: "Add Walk-in", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const row = page
    .locator(".live-operational-row")
    .filter({ hasText: "Integration Desk Walkin" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Manage", exact: true }).click();
  await dialog
    .getByLabel("Reason", { exact: true })
    .fill("Integration priority reason");
  await dialog.getByLabel("New position").fill("1");
  await dialog.getByRole("button", { name: "Reorder Queue" }).click();
  await expect(dialog).toBeHidden();
  const booking = await call(
    page,
    "bookings",
    "POST",
    {
      branchId: fixture.branchId,
      serviceIds: [fixture.serviceId],
      customerName: "Integration Checkin",
      customerPhone: "+910000000128",
      dateStr: future(10),
      timeStr: "11:00",
      staffId: fixture.staffId,
    },
    true,
  );
  expect(booking.status).toBe(201);
  await page
    .getByRole("button", { name: "Quick Check In", exact: true })
    .click();
  await dialog.getByLabel("Search customers").fill("Integration Checkin");
  await expect(
    dialog.getByRole("button", { name: "Check In", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Check In", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page
      .locator(".live-operational-row")
      .filter({ hasText: "Integration Checkin" }),
  ).toBeVisible();
  const recheck = await call(
    page,
    `flow/check-in/${booking.json.data.id}`,
    "POST",
    {},
    true,
  );
  expect(recheck.status).toBe(400);
});

test("staff session, CSRF protection, tenant isolation and role enforcement", async ({
  page,
}) => {
  await login(page, fixture.receptionistEmail);
  const cookies = await page.context().cookies();
  expect(
    cookies.find((c) => c.name === "velora_session")?.httpOnly,
  ).toBeTruthy();
  expect(
    await page.evaluate(() => localStorage.getItem("velora_token")),
  ).toBeNull();
  await page.goto("/dashboard");
  await expect(
    page.getByText("Your account does not have access to this screen."),
  ).toBeVisible();
  const restricted = await call(
    page,
    `desk/overview?branchId=${fixture.otherBranchId}`,
  );
  expect(restricted.status).toBe(403);
  const csrf = await page.request.post("/api/v1/auth/logout", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect(csrf.status()).toBe(403);
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  const unauth = await call(page, `desk/overview?branchId=${fixture.branchId}`);
  expect(unauth.status).toBe(401);
});

test("owner insights use live API values and reporting-date filter", async ({
  page,
}) => {
  await login(page);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Owner Insights" }),
  ).toBeVisible();
  await page.getByLabel("Reporting date").fill(future(100));
  await expect(
    page.getByText("No service demand recorded for this date."),
  ).toBeVisible();
  const analytics = await call(
    page,
    `analytics/dashboard?branchId=${fixture.branchId}&date=${future(100)}`,
  );
  expect(analytics.json.data.customersToday).toBe(0);
  expect(analytics.json.data.avgWaitMinutes).toBe(0);
  await page.getByLabel("Reporting date").fill(future(10));
  await expect(page.getByText("Integration Haircut")).toBeVisible();
});

test("private booking access, tenant context and resource branch isolation", async ({
  page,
  browser,
}) => {
  await login(page);
  const record = await call(
    page,
    "bookings",
    "POST",
    {
      branchId: fixture.branchId,
      serviceIds: [fixture.serviceId],
      customerName: "Integration Private",
      customerPhone: "+910000000129",
      dateStr: future(14),
      timeStr: "09:00",
      staffId: fixture.staffId,
    },
    true,
  );
  expect(record.status).toBe(201);
  const outsider = await browser.newContext();
  const foreign = await outsider.newPage();
  await foreign.goto("/");
  const denied = await call(foreign, `bookings/${record.json.data.id}`);
  expect(denied.status).toBe(403);
  const noTenant = await foreign.request.get("/api/v1/services");
  expect(noTenant.status()).toBe(400);
  await outsider.close();
  const other = await call(
    page,
    "queue/join",
    "POST",
    {
      branchId: fixture.otherBranchId,
      serviceIds: [fixture.serviceId],
      customerName: "Integration Other Branch",
      customerPhone: "+910000000130",
    },
    true,
  );
  expect(other.status).toBe(201);
  await page.getByRole("button", { name: "Sign Out" }).click();
  await login(page, fixture.receptionistEmail);
  const mutation = await call(
    page,
    `queue/${other.json.data.id}/status`,
    "PATCH",
    { status: "CALLED" },
    true,
  );
  expect(mutation.status).toBe(403);
  const foreignTenant = await page.evaluate(async () => {
    const response = await fetch("/api/v1/desk/overview", {
      headers: { "X-Tenant-Id": "foreign-tenant" },
    });
    return response.status;
  });
  expect(foreignTenant).toBe(403);
});

test("simultaneous reservations cannot double-book a professional", async ({
  page,
}) => {
  await page.goto("/book");
  const results = await page.evaluate(
    async ({ fixture, date }) => {
      const data = {
        branchId: fixture.branchId,
        serviceIds: [fixture.serviceId],
        customerName: "Integration Race",
        customerPhone: "+910000000131",
        dateStr: date,
        timeStr: "09:00",
        staffId: fixture.staffId,
      };
      return Promise.all(
        [1, 2].map(async () => {
          const response = await fetch("/api/v1/bookings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Tenant-Id": fixture.tenantId,
            },
            body: JSON.stringify(data),
          });
          return { status: response.status, json: await response.json() };
        }),
      );
    },
    { fixture, date: future(15) },
  );
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
});

test("reception new booking dialog, date selection and no-show action", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "New Booking", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Integration Haircut/ }).click();
  await dialog
    .getByLabel("Preferred professional")
    .selectOption(fixture.staffId);
  await dialog.getByLabel("Appointment date").fill(future(16));
  await dialog.getByRole("button", { name: "09:00", exact: true }).click();
  await dialog
    .getByLabel("Your name", { exact: true })
    .fill("Integration No Show");
  await dialog
    .getByLabel("Phone number", { exact: true })
    .fill("+910000000132");
  await dialog.getByRole("button", { name: /Confirm Booking/ }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("Reception date").fill(future(16));
  const row = page
    .locator(".live-operational-row")
    .filter({ hasText: "Integration No Show" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "No Show", exact: true }).click();
  await expect(row).toBeHidden();
});

test("staff layouts fit mobile/tablet and keyboard dialog focus returns", async ({
  page,
}) => {
  await login(page);
  for (const width of [390, 768, 1448]) {
    await page.setViewportSize({ width, height: 1086 });
    for (const path of ["/desk", "/dashboard"]) {
      await page.goto(path);
      await expect(
        page.getByRole("button", { name: "Sign Out" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
  }
  await page.goto("/desk");
  const open = page.getByRole("button", {
    name: "Customer Lookup",
    exact: true,
  });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(open).toBeFocused();
});

test("header booking requires demo login; sign-up, validation, back navigation and logout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact");
  // The same header CTA used at desktop remains the public entry point.
  await page.locator(".header-cta").click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Appointment date")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Velora" }),
  ).toBeVisible();
  await page.getByLabel("Mobile number").fill("+919999999999");
  await page.getByRole("button", { name: "Continue with Phone" }).click();
  await expect(page.locator(".customer-auth-card [role=alert]")).toContainText(
    "Use the demo number",
  );
  await page.getByRole("button", { name: "Use demo number" }).click();
  await page.getByRole("button", { name: "Continue with Phone" }).click();
  await page.getByLabel("Demo code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Continue to Booking" }).click();
  await expect(page.locator(".customer-auth-card [role=alert]")).toContainText(
    "123456",
  );
  await page.getByLabel("Demo code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Continue to Booking" }).click();
  await expect(
    page.getByRole("button", { name: "Continue →", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Integration Haircut/ }).click();
  await nextStep(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Integration Haircut/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await nextStep(page);
  await nextStep(page);
  await page.getByLabel("Appointment date").fill(future(16));
  await page.getByRole("button", { name: "09:00", exact: true }).click();
  await nextStep(page);
  await nextStep(page);
  expect(
    await page
      .getByLabel("Your name", { exact: true })
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBeTruthy();
  await page.getByLabel("Your name", { exact: true }).fill("  ");
  await nextStep(page);
  await expect(page.locator(".booking-layout .live-error")).toContainText(
    "full name",
  );
  await page.getByLabel("Your name", { exact: true }).fill("Demo Customer");
  await nextStep(page);
  await page.getByLabel("Street address").fill("42 Demo Street");
  await page.getByLabel("City", { exact: true }).fill("Mumbai");
  await page.getByLabel("Postal code").fill("400001");
  await page.getByLabel("Country", { exact: true }).fill("India");
  await page.getByLabel("Preferred contact").selectOption("Email");
  await expect(
    page.getByRole("button", { name: "Continue →", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "Demo Customer",
  );
  await page.getByLabel("Email (optional)").fill("demo@example.com");
  await nextStep(page);
  await expect(page.getByLabel("Street address")).toHaveValue("42 Demo Street");
  await nextStep(page);
  await expect(
    page.getByRole("heading", { name: "Review Your Appointment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Confirm Booking/ }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: /Confirm Booking/ }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Log out", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
