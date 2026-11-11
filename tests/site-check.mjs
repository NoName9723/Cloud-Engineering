import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredPages = [
  'index.html',
  'expertise.html',
  'solutions.html',
  'architecture.html',
  'technologies.html',
  'company.html',
  'contact.html',
  'account.html',
  'lab.html',
  '404.html'
];
const supportFiles = [
  '.nojekyll',
  '.env.example',
  '.gitignore',
  '.nvmrc',
  'package.json',
  'playwright.config.js',
  'account.js',
  'server/app.js',
  'server/index.js',
  'server/db.js',
  'server/security.js',
  'server/validation.js',
  'server/middleware/csrf.js',
  'server/middleware/error-handler.js',
  'server/routes/auth.routes.js',
  'server/routes/contact.routes.js',
  'server/db/migrate.js',
  'server/db/migrations/001_initial.sql',
  'tests/backend.test.mjs',
  'tests/e2e/navigation.spec.js',
  'robots.txt',
  'sitemap.xml',
  'assets/favicon.svg',
  'assets/og-cloud.svg'
];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

for (const file of [...requiredPages, ...supportFiles, 'styles.css', 'script.js']) {
  assert.ok(fs.existsSync(path.join(root, file)), 'Missing required file: ' + file);
}

const htmlByPage = Object.fromEntries(requiredPages.map(page => [page, read(page)]));
for (const [page, html] of Object.entries(htmlByPage)) {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate id in ' + page);
  assert.match(html, /<html lang=["']fr["']>/, page + ' must declare French as its language');
  assert.match(html, /<title>[^<]+<\/title>/, page + ' must have a page title');
  assert.match(html, /<meta name=["']description["'] content="[^"]{30,}">/, page + ' needs a useful meta description');
  assert.match(html, /class=["']skip-link["'] href=["']#main-content["']/, page + ' needs a skip link');
  assert.match(html, /<main id=["']main-content["']>/, page + ' needs a main landmark');
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, page + ' must have exactly one H1');
  assert.match(html, /rel=["']icon["']/, page + ' must load the favicon');
  assert.match(html, /property=["']og:title["']/, page + ' needs Open Graph title metadata');
  assert.match(html, /property=["']og:description["']/, page + ' needs Open Graph description metadata');
  assert.match(html, /http-equiv=["']Content-Security-Policy["']/, page + ' needs a content security policy');
  assert.match(html, /connect-src 'self'/, page + ' must allow same-origin API calls');
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i, page + ' must not contain inline scripts');
  assert.doesNotMatch(html, /\sstyle=/i, page + ' must not use inline style attributes');
  assert.match(html, /href=["']styles\.css["']/, page + ' must load styles.css');

  if (page !== '404.html') {
    assert.match(html, /src=["']script\.js["']/, page + ' must load script.js');
    assert.match(html, /rel=["']canonical["']/, page + ' needs a canonical URL');
    assert.match(html, /data-page=/, page + ' needs a page identifier');
  } else {
    assert.match(html, /name=["']robots["'] content=["']noindex,follow["']/, '404 page must not be indexed');
  }

  for (const match of html.matchAll(/(?:href|src)=["']([^"'#]+)(?:#([^"']+))?["']/g)) {
    const target = match[1];
    const anchor = match[2];
    if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(target)) continue;
    if (target.endsWith('.html')) {
      assert.ok(fs.existsSync(path.join(root, target)), 'Broken page link in ' + page + ': ' + target);
      if (anchor) {
        const targetHtml = htmlByPage[target] ?? read(target);
        assert.ok(
          targetHtml.includes('id="' + anchor + '"') || targetHtml.includes("id='" + anchor + "'"),
          'Broken anchor in ' + page + ': ' + target + '#' + anchor
        );
      }
    } else if (target.length) {
      assert.ok(fs.existsSync(path.join(root, target)), 'Missing local asset in ' + page + ': ' + target);
    }
  }
}

const css = read('styles.css');
for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  const asset = match[1];
  if (/^(?:https?:|data:)/i.test(asset)) continue;
  assert.ok(fs.existsSync(path.join(root, asset)), 'Missing CSS asset: ' + asset);
}
assert.match(css, /:focus-visible/, 'Keyboard focus indicators must be present');
assert.match(css, /prefers-reduced-motion:reduce/, 'Reduced-motion preferences must be respected');

const script = read('script.js');
assert.match(script, /event\.key==='Escape'/, 'The mobile menu must close on Escape');
assert.match(script, /event\.key==='ArrowRight'/, 'Tabbed interfaces must support arrow-key navigation');
assert.match(script, /localStorage/, 'Cloud Lab progress must be saved locally');
assert.doesNotMatch(script, /\beval\s*\(/, 'User-entered code must never be evaluated as JavaScript');
assert.match(script, /fetch\('\/api\/contact'/, 'The contact form must submit through the backend API');
assert.doesNotMatch(Object.values(htmlByPage).join('\n') + css, /images\.unsplash\.com/, 'Removed stock-photo dependencies must not return');

const account = htmlByPage['account.html'];
assert.match(account, /name=["']robots["'] content=["']noindex,nofollow["']/, 'The member area must not be indexed');
assert.match(account, /id=["']login-form["']/, 'The member area must expose the login form');
assert.match(account, /id=["']register-form["']/, 'The member area must expose the registration form');
assert.match(account, /src=["']account\.js["']/, 'The member area must load its client controller');

const contact = htmlByPage['contact.html'];
assert.match(contact, /l’API backend n’est pas encore déployée sur le site public GitHub Pages/, 'The contact page must disclose that the public API is not deployed yet');
assert.match(contact, /id=["']contact-form["']/, 'The contact page must expose the functional contact form');
assert.match(htmlByPage['account.html'], /id=["']account-service-notice["']/, 'The member page must disclose current API deployment status');
assert.match(htmlByPage['technologies.html'], /REFERENCE STACK/, 'The technologies page must expose its ecosystem map');
assert.match(htmlByPage['company.html'], /identité de marque fictive/, 'The company page must disclose the fictional brand');
const lab = htmlByPage['lab.html'];
assert.match(lab, /ACTIVE SCENARIO/, 'The Cloud Lab must expose its incident scenario overview');
assert.ok(script.includes("fixedCount()+'/'+missions.length"), 'The Cloud Lab terminal must display the current mission count');
assert.ok(script.includes('fixedCount()===missions.length'), 'The Cloud Lab operational status must use the full mission count');

for (const id of ['cloud-campaign','mission-list','code-editor','terminal-form','run-tests','deploy-fix','test-list','event-timeline','campaign-complete']) {
  assert.ok(lab.includes('id="' + id + '"'), 'Cloud Lab is missing #' + id);
}
assert.match(lab, /role=["']tablist["']/, 'Cloud Lab tools must expose a tablist role');
assert.match(lab, /aria-controls=["']lab-panel-editor["']/, 'Cloud Lab tabs must be linked to their panels');

const architecture = htmlByPage['architecture.html'];
assert.match(architecture, /aria-controls=["']architecture-panel-containers["']/, 'Architecture tabs must identify their panels');
for (const configPath of ['k8s/deployment.yaml','nginx/nginx.conf','infra/storage.tf','.github/workflows/deploy.yml','k8s/hpa.yaml','src/healthcheck.js']) {
  assert.ok(script.includes(configPath), 'Cloud Lab scenario missing config file: ' + configPath);
}
for (const missionId of ['deployment','routing','storage','pipeline','scaling','api-health']) {
  assert.ok(script.includes("id:'" + missionId + "'"), 'Cloud Lab mission missing: ' + missionId);
}
assert.equal((script.match(/\{name:'/g) || []).length, 24, 'The campaign must expose 24 automated code/configuration checks');

const robots = read('robots.txt');
const sitemap = read('sitemap.xml');
assert.match(robots, /Disallow: \/account\.html/, 'Member pages must be excluded from crawling');
assert.match(robots, /Sitemap: https:\/\/noname9723\.github\.io\/Cloud-Engineering\/sitemap\.xml/);
for (const page of requiredPages.filter(page => page !== '404.html' && page !== 'account.html')) {
  const url = page === 'index.html'
    ? 'https://noname9723.github.io/Cloud-Engineering/'
    : 'https://noname9723.github.io/Cloud-Engineering/' + page;
  assert.ok(sitemap.includes(url), 'Sitemap is missing ' + page);
}

console.log('Site quality checks passed: ' + requiredPages.length + ' pages, accessibility, security headers and Cloud Lab structure.');
