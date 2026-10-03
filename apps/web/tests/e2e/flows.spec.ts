import { test, expect } from "@playwright/test";
test("booking confirmation persists and supports reschedule", async ({
  page,
}) => {
  await page.goto("/book");
  await page
    .getByRole("button", { name: "Confirm Booking", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm Booking", exact: true })
    .last()
    .click();
  await expect(page.getByText("Enter your full name")).toBeVisible();
  await page.getByLabel("Full name").fill("Demo Guest");
  await page.getByLabel("Mobile number").fill("+65 8123 4567");
  await page
    .getByRole("button", { name: "Confirm Booking", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your booking is confirmed" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View My Booking" }).click();
  await expect(page.getByRole("heading", { name: "Demo Guest" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Demo Guest" })).toBeVisible();
  await page.getByRole("link", { name: "Reschedule" }).click();
  await page
    .getByRole("button", { name: "15", exact: true })
    .isDisabled()
    .then((v) => expect(v).toBe(true));
  await page.getByRole("button", { name: "17", exact: true }).click();
  await page.getByRole("button", { name: "10:00", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm Booking", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toHaveValue("Demo Guest");
  await page
    .getByRole("button", { name: "Save New Time", exact: true })
    .click();
  await page.getByRole("link", { name: "View My Booking" }).click();
  await expect(page.getByText("2025-04-17 at 10:00")).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel Booking", exact: true })
    .click();
  await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
});
test("walk-in joins, syncs between tabs and leaves without exposing others", async ({
  page,
  context,
}) => {
  await page.goto("/queue/join");
  await page.getByLabel("Full name").fill("Demo Walker");
  await page.getByLabel("Mobile number").fill("+65 8234 5678");
  await page
    .getByRole("button", { name: "Join Live Queue", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "A024" })).toBeVisible();
  await expect(page.getByText("Nicole Tan")).toHaveCount(0);
  const desk = await context.newPage();
  await desk.goto("/desk");
  await expect(
    desk.getByRole("heading", { name: "Demo Walker" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Leave Queue Remove/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Leave Queue", exact: true })
    .click();
  await expect(desk.getByRole("heading", { name: "Demo Walker" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Join Queue Again" }),
  ).toBeVisible();
});
test("reception completion changes customer queue ETA", async ({
  page,
  context,
}) => {
  await page.goto("/queue");
  const before = await page.locator(".phone-status").innerText();
  const desk = await context.newPage();
  await desk.goto("/desk");
  await desk
    .getByRole("button", { name: "Complete", exact: true })
    .first()
    .click();
  await expect(page.locator(".phone-status")).not.toHaveText(before);
});
test("analytics filters change data", async ({ page }) => {
  await page.goto("/dashboard");
  const before = await page.locator(".kpi-grid").innerText();
  await page.getByLabel("Analytics branch").selectOption("orchard");
  await expect(page.locator(".kpi-grid")).not.toHaveText(before);
  await page.getByLabel("Analytics date range").selectOption("week");
  await expect(
    page.getByRole("heading", { name: "16 min", exact: true }).first(),
  ).toBeVisible();
});
for (const width of [390, 768, 1448])
  for (const route of ["/", "/book", "/queue", "/desk", "/dashboard"])
    test(`layout ${width} ${route}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1086 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await expect(page.locator("h1")).toBeVisible();
      await page.locator("h1").click();
      await page.screenshot({
        path: `../../docs/screenshots/${width}-${route === "/" ? "home" : route.slice(1)}.png`,
        fullPage: true,
      });
    });

test("reception creates a walk-in and completes the queue lifecycle", async ({
  page,
}) => {
  await page.goto("/desk");
  await page.getByRole("button", { name: "Add Walk-in", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Professional", exact: true })
    .selectOption("ava");
  await page.getByLabel("Full name").fill("Lifecycle Guest");
  await page.getByLabel("Mobile number").fill("+65 8234 5678");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add Walk-in", exact: true })
    .click();
  const row = page.locator(".queue-row").filter({ hasText: "Lifecycle Guest" });
  await row.getByRole("button", { name: "Call", exact: true }).click();
  await row.getByRole("button", { name: "Check In", exact: true }).click();
  await page
    .locator(".active-row")
    .filter({ hasText: "Isabella Chen" })
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  await row.getByRole("button", { name: "Start", exact: true }).click();
  const active = page
    .locator(".active-row")
    .filter({ hasText: "Lifecycle Guest" });
  await expect(active).toBeVisible();
  await active.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(active).toHaveCount(0);
});
test("booking dialog supports keyboard access and escape", async ({ page }) => {
  await page.goto("/book");
  const confirm = page.getByRole("button", {
    name: "Confirm Booking",
    exact: true,
  });
  await expect(confirm).toBeEnabled();
  await confirm.focus();
  await confirm.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Full name").press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(confirm).toBeFocused();
});
