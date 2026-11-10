import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: 64 * 1024 * 1024
  });

  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64url'),
    Buffer.from(derivedKey).toString('base64url')
  ].join('$');
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;

  const [algorithm, cost, blockSize, parallelization, saltText, keyText] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !cost || !blockSize || !parallelization || !saltText || !keyText) {
    return false;
  }

  const parameters = { N: Number(cost), r: Number(blockSize), p: Number(parallelization) };
  if (
    !Number.isSafeInteger(parameters.N) ||
    !Number.isSafeInteger(parameters.r) ||
    !Number.isSafeInteger(parameters.p) ||
    parameters.N < 16_384 || parameters.N > 131_072 ||
    parameters.r < 1 || parameters.r > 16 ||
    parameters.p < 1 || parameters.p > 4
  ) return false;

  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(keyText, 'base64url');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;

    const actual = Buffer.from(await scrypt(password, salt, expected.length, {
      ...parameters,
      maxmem: 128 * 1024 * 1024
    }));

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
