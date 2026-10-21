import { expect, type Page } from "@playwright/test";

export const accounts = {
  customer: { user: process.env.E2E_CUSTOMER_USER, pass: process.env.E2E_CUSTOMER_PASSWORD },
  agent: { user: process.env.E2E_AGENT_USER, pass: process.env.E2E_AGENT_PASSWORD },
};
export const haveAccounts = !!(accounts.customer.user && accounts.customer.pass && accounts.agent.user && accounts.agent.pass);

export async function signInCustomer(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username or email").fill(accounts.customer.user!);
  await page.getByLabel("Password", { exact: true }).fill(accounts.customer.pass!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account/);
}

export async function signInAgent(page: Page) {
  await page.goto("/staff/login");
  await page.getByLabel("Signing in as").selectOption("support_agent");
  await page.getByLabel("Username or email").fill(accounts.agent.user!);
  await page.getByLabel("Password", { exact: true }).fill(accounts.agent.pass!);
  await page.getByRole("button", { name: "Sign in to staff portal" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
