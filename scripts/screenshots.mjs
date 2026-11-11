// Captures README screenshots with two browser sessions on the same bus (proves live seat updates).
// Usage: npm run dev, then: npm i -D playwright-core && CHROME=/path/to/chrome node scripts/screenshots.mjs
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'screenshots';
const tomorrow = new Date(Date.now() + 330 * 60000 + 86400000).toISOString().slice(0, 10);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const vp = { viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 };
const A = await (await browser.newContext(vp)).newPage();
const B = await (await browser.newContext(vp)).newPage();
const logs = [];
for (const [n, p] of [['A', A], ['B', B]]) p.on('console', (m) => m.type() === 'error' && logs.push(`${n}: ${m.text()}`));

async function openSleeperTrip(p) {
  await p.goto('http://localhost:5173/');
  await p.getByLabel('Date of journey').fill(tomorrow);
  await p.getByRole('button', { name: 'Search buses' }).click();
  await p.getByText('buses found').waitFor();
  await p.getByRole('button', { name: 'Sleeper' }).click();
}
await A.goto('http://localhost:5173/');
await A.getByLabel('Date of journey').fill(tomorrow);
await A.getByRole('button', { name: 'Search buses' }).click();
await A.getByText('buses found').waitFor();
await A.waitForTimeout(300);
await A.screenshot({ path: `${OUT}/01-search-results.png`, fullPage: false });
await A.getByRole('button', { name: 'Sleeper' }).click();
await A.getByRole('button', { name: 'View seats' }).first().click();
await A.getByText('Live').first().waitFor();
// log in when trying to pick a seat
const free = A.locator('button.seat--available');
await free.first().click();
await A.getByRole('dialog').waitFor();
await A.getByRole('button', { name: 'Log in' }).last().click();
await A.getByRole('dialog').waitFor({ state: 'detached' });

// B: anonymous second browser looking at the same bus
await openSleeperTrip(B);
await B.getByRole('button', { name: 'View seats' }).first().click();
await B.getByText('Live').first().waitFor();

const s1 = await A.locator('button.seat--available:not(.seat--ladies)').nth(0).getAttribute('data-testid');
const s2 = await A.locator('button.seat--available:not(.seat--ladies)').nth(1).getAttribute('data-testid');
await A.getByTestId(s1).click();
await A.waitForTimeout(300);
await A.getByTestId(s2).click();
await A.getByRole('timer').waitFor();
await A.getByLabel(/Name for seat/).first().waitFor();
// B should see them as held without reloading
await B.locator(`[data-testid="${s1}"].seat--held`).waitFor({ timeout: 5000 });
await B.locator(`[data-testid="${s2}"].seat--held`).waitFor({ timeout: 5000 });
console.log('B saw live holds on', s1, s2);
await A.waitForTimeout(500);
await A.screenshot({ path: `${OUT}/02-seat-hold-tab-A.png` });
await B.screenshot({ path: `${OUT}/03-same-bus-tab-B-live-hold.png` });

// fill passengers and confirm
const names = A.getByLabel(/Name for seat/);
const ages = A.getByLabel(/Age for seat/);
await names.nth(1).fill('Ravi Kumar');
await ages.nth(0).fill('29');
await ages.nth(1).fill('31');
await A.getByLabel('Mobile number').fill('9876543210');
await A.getByRole('button', { name: 'Confirm booking' }).click();
await A.getByText('Booking confirmed').waitFor();
await B.locator(`[data-testid="${s1}"].seat--booked`).waitFor({ timeout: 5000 });
console.log('B saw booked', s1);
await A.screenshot({ path: `${OUT}/04-booking-confirmed.png` });
console.log('console errors:', logs);
await browser.close();
