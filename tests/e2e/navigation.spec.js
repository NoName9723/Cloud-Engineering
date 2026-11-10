import { test, expect } from '@playwright/test';

test('the main navigation reaches the key sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.locator('.site-nav a[href="expertise.html"]').click();
  await expect(page).toHaveURL(url => url.pathname.endsWith('/expertise.html'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.locator('.site-nav a[href="contact.html"]').click();
  await expect(page).toHaveURL(url => url.pathname.endsWith('/contact.html'));
  await expect(page.locator('#contact-form')).toBeVisible();
});

test('the member area is reachable and exposes authentication forms', async ({ page }) => {
  await page.goto('/account.html');
  await expect(page.getByRole('heading', { name: /Espace membre/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer un compte' })).toBeVisible();
});

test('the mobile menu can be opened and used', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menuButton = page.locator('.menu-toggle');
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.site-nav a[href="account.html"]').click();
  await expect(page).toHaveURL(url => url.pathname.endsWith('/account.html'));
});

test('the Cloud Lab loads its interactive workspace', async ({ page }) => {
  await page.goto('/lab.html');
  await expect(page.locator('#cloud-campaign')).toBeVisible();
  await expect(page.locator('#mission-list')).toBeVisible();
});
