import { randomUUID } from 'node:crypto';
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

test('registration, login and logout work with PostgreSQL', async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, 'Ce parcours nécessite une base PostgreSQL de test.');

  const email = 'e2e-' + randomUUID() + '@example.test';
  const password = 'Nexora-E2E-Password-2026';

  await page.goto('/account.html');
  await expect(page.locator('#account-status'))
    .toHaveText('Vous pouvez vous connecter ou créer un compte.');

  await page.locator('[data-auth-mode="register"]').click();
  await page.locator('#register-name').fill('Compte de test');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(password);
  await page.locator('#register-confirm').fill(password);
  await page.locator('#register-form button[type="submit"]').click();

  await expect(page.locator('#account-status')).toHaveText('Votre session est active.');
  await expect(page.locator('#account-email')).toHaveText(email);

  await page.locator('#logout-button').click();
  await expect(page.locator('#account-status'))
    .toHaveText('Vous pouvez vous connecter ou créer un compte.');

  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-form button[type="submit"]').click();

  await expect(page.locator('#account-status')).toHaveText('Votre session est active.');
  await expect(page.locator('#account-email')).toHaveText(email);
});

test('contact requests are persisted by the backend', async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, 'Ce parcours nécessite une base PostgreSQL de test.');

  await page.goto('/contact.html');
  await page.locator('#name').fill('Demande de test');
  await page.locator('#email').fill('contact-' + randomUUID() + '@example.test');
  await page.locator('#organization').fill('NEXORA E2E');
  await page.locator('#subject').selectOption('Architecture cloud');
  await page.locator('#message').fill('Ceci est une demande de test automatisée pour vérifier le stockage PostgreSQL.');

  await page.locator('#contact-form button[type="submit"]').click();
  await expect(page.locator('#form-result'))
    .toContainText('Votre demande a bien été enregistrée. Référence :');
});

test('the database readiness endpoint confirms a live connection', async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, 'Ce parcours nécessite une base PostgreSQL de test.');

  const response = await page.request.get('/api/health/ready');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ready' });
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

test('loads the Cloud Lab bundle only on the Cloud Lab page', async ({ page }) => {
  const loadedBundles = [];
  page.on('request', request => {
    if (request.url().endsWith('/cloud-lab.js')) loadedBundles.push(request.url());
  });

  await page.goto('/');
  expect(loadedBundles).toHaveLength(0);

  await page.goto('/lab.html');
  await expect(page.locator('#cloud-campaign')).toBeVisible();
  await expect.poll(() => loadedBundles.length).toBe(1);
});
