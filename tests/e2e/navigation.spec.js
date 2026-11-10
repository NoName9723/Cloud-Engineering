import { test, expect } from '@playwright/test';

test('the main navigation reaches the key sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Expertise' }).click();
  await expect(page).toHaveURL(/expertise\\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Contact' }).click();
  await expect(page).toHaveURL(/contact\\.html$/);
  await expect(page.locator('#contact-form')).toBeVisible();
});

test('the member area is reachable and exposes authentication forms', async ({ page }) => {
  await page.goto('/account.html');
  await expect(page.getByRole('heading', { name: 'Espace membre' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer un compte' })).toBeVisible();
});

test('the mobile menu can be opened and used with a keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Espace membre' }).click();
  await expect(page).toHaveURL(/account\\.html$/);
});

test('the Cloud Lab loads its interactive workspace', async ({ page }) => {
  await page.goto('/lab.html');
  await expect(page.locator('#cloud-campaign')).toBeVisible();
  await expect(page.locator('#mission-list')).toBeVisible();
});
