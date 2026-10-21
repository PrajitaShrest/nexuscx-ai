import { expect, test } from "@playwright/test";
import { haveAccounts, signInAgent, signInCustomer } from "./helpers";

// The main journey across two roles, on the real database:
// customer asks for a person -> case escalated -> agent takes it and replies ->
// customer sees the reply and answers -> agent resolves -> customer rates it.
// Needs test accounts (tests/e2e/README.md). Each run creates one new case.

test.describe("journey", () => {
  test.skip(!haveAccounts, "Set E2E_CUSTOMER_* and E2E_AGENT_* to run the journey tests");

  test("escalated chat from customer question to resolved and rated", async ({ browser }) => {
    const customerCtx = await browser.newContext();
    const agentCtx = await browser.newContext();
    const customer = await customerCtx.newPage();
    const agent = await agentCtx.newPage();
    const stamp = Date.now().toString().slice(-6);

    // 1. Customer asks for a person
    await signInCustomer(customer);
    await customer.goto("/support");
    await customer.getByLabel("Your message").fill(`E2E ${stamp}: I want to speak to a real person about my refund please`);
    await customer.getByRole("button", { name: "Send message" }).click();
    const caseLabel = customer.getByText(/Case CX-\d+/).last();
    await expect(caseLabel).toBeVisible();
    const caseNumber = (await caseLabel.textContent())!.match(/CX-\d+/)![0];

    // 2. Agent finds the case, takes it and replies
    await signInAgent(agent);
    await agent.goto(`/cases?q=${caseNumber}`);
    await agent.getByRole("link", { name: caseNumber }).first().click();
    await agent.getByRole("button", { name: "Take over this case" }).click();
    await expect(agent.getByText(/has joined the chat/)).toBeVisible();
    await agent.getByLabel("Reply to the customer").fill(`Hi, this is support (${stamp}). I can help with your refund.`);
    await agent.getByRole("button", { name: "Send reply" }).click();
    await expect(agent.getByText("Sent to the customer.")).toBeVisible();

    // 3. Customer sees the reply (live update or on load) and answers
    await customer.goto("/account/chats");
    await customer.getByText(caseNumber).first().click();
    await expect(customer.getByText(`(${stamp}). I can help with your refund.`)).toBeVisible();
    await customer.getByPlaceholder("Add more details or reply to our team…").fill("Thank you, order NX-1001 please.");
    await customer.getByRole("button", { name: "Send reply" }).click();
    await expect(customer.getByText("Thank you, order NX-1001 please.")).toBeVisible();

    // 4. Agent sees the answer and resolves
    await expect(agent.getByText("Thank you, order NX-1001 please.")).toBeVisible({ timeout: 30_000 });
    await agent.getByRole("button", { name: "Resolve" }).click();
    await agent.getByRole("button", { name: "Mark resolved" }).click();
    await expect(agent.getByText("Case resolved.")).toBeVisible();

    // 5. Customer rates the chat
    await customer.reload();
    await customer.getByRole("button", { name: "5 stars" }).click();
    await customer.getByRole("button", { name: "Send rating" }).click();
    await expect(customer.getByText("Thanks for rating this chat!")).toBeVisible();

    await customerCtx.close();
    await agentCtx.close();
  });

  test("server rejects a postcode even when the browser check is removed", async ({ page }) => {
    await signInCustomer(page);
    await page.goto("/account/addresses");
    await page.getByRole("button", { name: "Add address" }).click();
    await page.getByLabel("Recipient name").fill("Test Person");
    await page.getByLabel("Street address").fill("1 Test Street");
    await page.getByLabel("Suburb").fill("Parramatta");
    const postcode = page.getByLabel("Postcode");
    // Remove the browser's own checks to prove the server checks too
    await postcode.evaluate((el: HTMLInputElement) => { el.removeAttribute("pattern"); el.removeAttribute("maxlength"); el.removeAttribute("required"); });
    await postcode.fill("12");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Postcode must be 4 digits.")).toBeVisible();
  });

  test("signed-in user sees a friendly 404 for an unknown page", async ({ page }) => {
    await signInCustomer(page);
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
  });

  test("@mobile staff menu opens on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await signInAgent(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Cases" }).click();
    await expect(page).toHaveURL(/\/cases/);
    await ctx.close();
  });
});
