import { expect, test } from "@playwright/test";

// These tests need no accounts and no real database, so they also run on GitHub.

test.describe("@public signed-out visitors", () => {
  for (const path of ["/", "/dashboard", "/cases", "/account/orders", "/settings"]) {
    test(`${path} sends a signed-out visitor to sign in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("sign-in page has a title and labelled fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Sign in · NexusCX AI/);
    await expect(page.getByLabel("Username or email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("staff sign-in asks which role", async ({ page }) => {
    await page.goto("/staff/login");
    await expect(page.getByLabel("Signing in as")).toBeVisible();
  });

  test("unknown page sends a signed-out visitor to sign in (does not reveal which pages exist)", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page).toHaveURL(/\/login/);
  });

  test("terms and privacy pages load", async ({ page }) => {
    for (const path of ["/terms", "/privacy"]) {
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});

test.describe("@public @mobile small screens", () => {
  test("sign-in page fits a phone without sideways scrolling", async ({ page }) => {
    await page.goto("/login");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
