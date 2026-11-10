import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('script.js', 'utf8');
const start = source.indexOf('const missions=[');
const end = source.indexOf('const freshState', start);
assert.ok(start >= 0 && end > start, 'Could not locate the Cloud Lab scenario catalogue');

// This compiles only the repository-authored scenario catalogue. User-edited code
// in the browser is never passed to Function/eval and is only checked as text.
const missions = new Function(source.slice(start, end) + '; return missions;')();

assert.equal(missions.length, 5, 'The campaign must contain five connected incidents');
assert.deepEqual(missions.map(mission => mission.id), ['deployment','routing','storage','pipeline','scaling']);

const repairs = {
  deployment: code => code.replace('app: nexora-edge', 'app: nexora-api').replace('/ready', '/health'),
  routing: code => code.replace('api-service:8081', 'api-service:8080').replace('nexora_backend', 'nexora_api').replace('return 503 "upstream unavailable";', 'return 200 "ok";'),
  storage: code => code.replace('AES128', 'AES256').replace('"Suspended"', '"Enabled"').replace('days = 7', 'days = 30'),
  pipeline: code => code.replace('npm run test:unit', 'npm test').replace('  deploy:\n    runs-on:', '  deploy:\n    needs: test\n    runs-on:'),
  scaling: code => code.replace('legacy-api', 'nexora-api').replace('minReplicas: 1', 'minReplicas: 2').replace('maxReplicas: 2', 'maxReplicas: 10').replace('averageUtilization: 90', 'averageUtilization: 65')
};

let totalChecks = 0;
for (const mission of missions) {
  assert.equal(mission.tests.length, 4, `${mission.id} must have four checks`);
  const brokenResults = mission.tests.map(test => test.check(mission.initial));
  assert.ok(brokenResults.some(result => !result), `${mission.id}: broken starter configuration should fail at least one check`);

  const repairedCode = repairs[mission.id](mission.initial);
  const repairedResults = mission.tests.map(test => test.check(repairedCode));
  assert.ok(repairedResults.every(Boolean), `${mission.id}: expected repair should pass every check; failed: ${mission.tests.filter((test,index) => !repairedResults[index]).map(test => test.name).join(', ')}`);
  totalChecks += mission.tests.length;
}

assert.equal(totalChecks, 20, 'The campaign must validate twenty configuration checks');
console.log(`Cloud Lab tests passed: ${missions.length} incidents, ${totalChecks} checks, starter faults reproduced and known repairs accepted.`);
