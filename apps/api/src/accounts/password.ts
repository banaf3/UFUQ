/**
 * Password storage with scrypt (node:crypto), at the OWASP Password Storage Cheat Sheet's
 * minimum scrypt configuration: N = 2^17, r = 8, p = 1, a 16-byte random salt and a 32-byte
 * key. The stored form names its parameters, so they can be raised later without breaking
 * existing hashes: scrypt$<log2 N>$<r>$<p>$<salt base64url>$<key base64url>.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const LOG2_N = 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function scrypt(password: string, salt: Buffer, logN: number, r: number, p: number) {
  const N = 2 ** logN;
  return new Promise<Buffer>((resolve, reject) =>
    scryptCallback(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N, r, p, maxmem: 256 * N * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, LOG2_N, R, P);
  return ['scrypt', LOG2_N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [logN, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  if (![logN, r, p].every((v) => Number.isInteger(v) && v > 0) || logN > 20) return false;
  const expected = Buffer.from(parts[5] as string, 'base64url');
  const key = await scrypt(password, Buffer.from(parts[4] as string, 'base64url'), logN, r, p);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash of a random password: used to spend the same time when an email is unknown. */
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(24).toString('base64url'));
  return dummy;
}
