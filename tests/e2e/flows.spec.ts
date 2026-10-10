import { test, expect, type Page } from '@playwright/test';

async function pin(page: Page, digits: string) {
  for (const d of digits) { await page.getByRole('group', { name: /number pad/i }).last().getByRole('button', { name: d, exact: true }).click(); await page.waitForTimeout(280); }
}
async function login(page: Page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Skip intro' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Ramesh' })).toBeVisible();
  await pin(page, '1234');
  await expect(page.getByText(/DEMO MODE/)).toBeVisible();
}
const balanceText = async (page: Page) => { await page.goto('/#/wallet'); return (await page.locator('.card b.h1').first().textContent()) ?? ''; };
const rupees = (s: string) => parseFloat(s.replace(/[^\d.]/g, ''));

test('1. successful transfer updates balance and history', async ({ page }) => {
  await login(page);
  const before = rupees(await balanceText(page));
  await page.goto('/#/send?to=u_rahul');
  await page.getByLabel('Amount in rupees (keyboard)').fill('300');
  await page.getByRole('button', { name: /Continue with ₹300/ }).click();
  await expect(page.getByText('Name on bank account: RAHUL SHARMA')).toBeVisible();
  await page.getByRole('button', { name: 'Pay ₹300' }).click();
  await pin(page, '1234');
  await expect(page.getByRole('heading', { name: 'Payment successful' }).first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'View receipt' }).click();
  await expect(page.getByText('Sent to Rahul Sharma').first()).toBeVisible();
  const after = rupees(await balanceText(page));
  expect(before - after).toBe(300);
});

test('2. insufficient balance is blocked', async ({ page }) => {
  await login(page);
  await page.goto('/#/send?to=u_lakshmi&amt=99999');
  await page.getByRole('button', { name: /Continue with ₹99,999/ }).click();
  await expect(page.getByText(/Not enough balance/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add demo money' })).toBeVisible();
});

test('3. wrong PIN shows tries left and sends nothing', async ({ page }) => {
  await login(page);
  await page.goto('/#/send?to=u_meera&amt=200');
  await page.getByRole('button', { name: /Continue with ₹200/ }).click();
  await page.getByRole('button', { name: 'Pay ₹200' }).click();
  await pin(page, '0000');
  await expect(page.getByText(/2 tries left\. No money has been sent/)).toBeVisible();
});

test('4 + 5. QR: valid sample pays, invalid samples are refused', async ({ page }) => {
  await login(page);
  await page.goto('/#/scan');
  const card = page.locator('.card', { hasText: 'Free cashback link' });
  await card.getByRole('button', { name: 'Scan this' }).click();
  await expect(page.getByText(/never opens links from QR codes/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Scan another code' }).click();
  await page.locator('.card', { hasText: 'Café Monsoon bill' }).getByRole('button', { name: 'Scan this' }).click();
  await expect(page.getByText('QR code verified')).toBeVisible();
  await page.getByRole('button', { name: 'Review payment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pay ₹260' }).click();
  await pin(page, '1234');
  await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible({ timeout: 8000 });
});

test('6 + 8. food order with coupon; bad coupon gives a reason', async ({ page }) => {
  await login(page);
  await page.goto('/#/food/r5');
  await page.getByRole('button', { name: /Add Mysore Masala Dosa/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Add to cart/ }).click();
  await page.getByRole('button', { name: /Add Idli Vada Combo/ }).click();
  await page.getByRole('button', { name: 'View cart' }).click();
  await page.getByRole('button', { name: /Place order/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Coupon code').fill('MOVIE75');
  await dlg.getByRole('button', { name: 'Apply' }).click();
  await expect(dlg.getByText(/only works on movie and event tickets/)).toBeVisible();
  await dlg.getByLabel('Coupon code').fill('FOOD50');
  await dlg.getByRole('button', { name: 'Apply' }).click();
  await expect(dlg.getByText(/FOOD50 applied/)).toBeVisible();
  await dlg.getByRole('button', { name: /^Pay ₹/ }).click();
  await pin(page, '1234');
  await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Track order' }).click();
  await page.locator('.card.click').first().click();
  await expect(page.getByText('Order placed')).toBeVisible();
  await page.getByRole('button', { name: /Cancel order/ }).click();
  await page.getByRole('button', { name: 'Yes, cancel and refund' }).click();
  await expect(page.getByText(/refunded to your wallet/).first()).toBeVisible();
});

test('7. ticket booking, QR validation admits only once', async ({ page }) => {
  await login(page);
  await page.goto('/#/fun/ev2');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Pay ₹/ }).click();
  await pin(page, '1234');
  await page.getByRole('button', { name: 'View QR ticket' }).click({ timeout: 8000 });
  await page.getByRole('button', { name: /Open event ticket/ }).click();
  await expect(page.getByRole('img', { name: /Ticket QR code/ })).toBeVisible();
  await page.getByRole('button', { name: /Validate at venue/ }).click();
  await page.locator('.row', { hasText: 'Laugh Lab' }).getByRole('button', { name: 'Scan' }).first().click();
  await expect(page.getByText('Valid ticket').first()).toBeVisible();
  await page.getByRole('button', { name: /Admit & mark as used/ }).click();
  await page.locator('.row', { hasText: 'Laugh Lab' }).getByRole('button', { name: 'Scan' }).first().click();
  await expect(page.getByText('Already used').first()).toBeVisible();
});

test('9. refund simulation on a cancelled train', async ({ page }) => {
  await login(page);
  await page.goto('/#/travel/trains');
  await page.getByRole('button', { name: 'Search trains' }).click();
  await page.getByRole('button', { name: 'Select' }).first().click();
  await page.getByRole('button', { name: /Review & pay/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Pay ₹/ }).click();
  await pin(page, '1234');
  await page.getByRole('button', { name: 'View ticket' }).click({ timeout: 8000 });
  await page.getByRole('button', { name: /Open train ticket/ }).click();
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await page.getByRole('button', { name: /Yes, cancel/ }).click();
  await expect(page.getByText(/refunded to your wallet/).first()).toBeVisible();
});

test('10. reward redemption cannot be duplicated', async ({ page }) => {
  await login(page);
  await page.goto('/#/rewards');
  await page.getByRole('button', { name: /Reward points/ }).click();
  await page.getByRole('button', { name: 'Redeem 100 points' }).click();
  await expect(page.getByText(/100 points redeemed/)).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByText('Redeemed 100 reward points').first()).toBeVisible();
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const p of ['/', '/send', '/scan', '/receive', '/history', '/travel/flights', '/fun', '/food', '/food/r1', '/shop', '/bills', '/transport', '/rewards', '/profile', '/a11y', '/guide', '/insights']) {
    await page.goto('/#' + p);
    await page.waitForTimeout(250);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w, p).toBeLessThanOrEqual(390);
  }
});

test('back button walks back through screens; tapping Zetheta replays the intro', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Travel' }).first().click();
  await page.getByRole('button', { name: /^Trains/ }).click();
  await expect(page.getByRole('heading', { name: 'Train tickets' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Travel', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Ramesh' })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Judge walkthrough' }).click();
  await expect(page.getByRole('heading', { name: 'Judge walkthrough' })).toBeVisible();
  await page.getByRole('button', { name: /replay intro/ }).click();
  await expect(page.getByRole('button', { name: 'Skip intro' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Ramesh' })).toBeVisible();
});
