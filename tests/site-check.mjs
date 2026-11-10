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
  'lab.html',
  '404.html'
];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

for (const page of requiredPages) {
  assert.ok(fs.existsSync(path.join(root, page)), `Missing page: ${page}`);
}

const htmlByPage = Object.fromEntries(requiredPages.map(page => [page, read(page)]));
const allIds = {};
for (const [page, html] of Object.entries(htmlByPage)) {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate id in ${page}`);
  allIds[page] = new Set(ids);
  assert.match(html, /href=["']styles\.css["']/, `${page} must load styles.css`);
  if (page !== '404.html') {
    assert.match(html, /src=["']script\.js["']/, `${page} must load script.js`);
  }

  for (const match of html.matchAll(/(?:href|src)=["']([^"'#]+)(?:#([^"']+))?["']/g)) {
    const target = match[1];
    const anchor = match[2];
    if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(target)) continue;
    if (target.endsWith('.html')) {
      assert.ok(fs.existsSync(path.join(root, target)), `Broken page link in ${page}: ${target}`);
      if (anchor) {
        const targetHtml = htmlByPage[target] ?? read(target);
        assert.ok(targetHtml.includes(`id="${anchor}"`) || targetHtml.includes(`id='${anchor}'`), `Broken anchor in ${page}: ${target}#${anchor}`);
      }
    } else if (target.length) {
      assert.ok(fs.existsSync(path.join(root, target)), `Missing local asset in ${page}: ${target}`);
    }
  }
}

const css = read('styles.css');
for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  const asset = match[1];
  if (/^(?:https?:|data:)/i.test(asset)) continue;
  assert.ok(fs.existsSync(path.join(root, asset)), `Missing CSS asset: ${asset}`);
}

const lab = htmlByPage['lab.html'];
for (const id of ['cloud-campaign','mission-list','code-editor','terminal-form','run-tests','deploy-fix','test-list','event-timeline','campaign-complete']) {
  assert.ok(lab.includes(`id="${id}"`), `Cloud Lab is missing #${id}`);
}
const script = read('script.js');
for (const configPath of ['k8s/deployment.yaml','nginx/nginx.conf','infra/storage.tf','.github/workflows/deploy.yml','k8s/hpa.yaml','src/healthcheck.js']) {
  assert.ok(script.includes(configPath), `Cloud Lab scenario missing config file: ${configPath}`);
}
for (const missionId of ['deployment','routing','storage','pipeline','scaling']) {
  assert.ok(script.includes(`id:'${missionId}'`), `Cloud Lab mission missing: ${missionId}`);
}
assert.equal((script.match(/\{name:/g) || []).length, 24, 'The campaign must expose 24 automated code/configuration checks');
assert.match(script, /Cloud Incident Lab/);
assert.match(script, /localStorage/);
assert.doesNotMatch(script, /\beval\s*\(/, 'User-entered code must never be evaluated as JavaScript');
assert.doesNotMatch(Object.values(htmlByPage).join('\n') + css, /images\.unsplash\.com/, 'Old stock-photo dependencies should not return');

console.log(`Site check passed: ${requiredPages.length} pages, local links/assets, Cloud Lab UI contract.`);
