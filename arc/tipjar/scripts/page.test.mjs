// Tests for the page's pure helpers (site/lib.js). Run: node --test scripts/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { ROOT } from './lib.mjs';

const ctx = { TextEncoder, TextDecoder, BigInt };
vm.createContext(ctx);
vm.runInContext(readFileSync(join(ROOT, 'site/lib.js'), 'utf8'), ctx);
const L = ctx.TipLib;

test('notes show only from tips of at least max(minTip, 1 USDC)', () => {
  assert.equal(L.noteFloor(0n), 1000000n);
  assert.equal(L.noteFloor(250000n), 1000000n);
  assert.equal(L.noteFloor(5000000n), 5000000n);
  assert.equal(L.noteShown(1n, 0n), false); // a dust tip's note is hidden
  assert.equal(L.noteShown(999999n, 0n), false);
  assert.equal(L.noteShown(1000000n, 0n), true);
  assert.equal(L.noteShown(4999999n, 5000000n), false);
  assert.equal(L.noteShown(5000000n, 5000000n), true);
});

test('encodeTip matches the ABI and decodeNote reads it back', () => {
  const data = L.encodeTip(1500000n, 'hi é');
  assert.equal(data.slice(0, 10), '0x0d9d4f06');
  const words = data.slice(10);
  assert.equal(BigInt('0x' + words.slice(0, 64)), 1500000n);
  assert.equal(BigInt('0x' + words.slice(64, 128)), 64n);
  assert.equal(BigInt('0x' + words.slice(128, 192)), 5n); // 'hi é' is 5 UTF-8 bytes
  // A Tipped log's data is (uint256 amount, string note): the call's arguments without the selector.
  const got = L.decodeNote('0x' + words);
  assert.equal(got.amount, 1500000n);
  assert.equal(got.note, 'hi é');
});

test('USDC amounts use 6 decimals', () => {
  assert.equal(L.parseUsdc('1.5'), 1500000n);
  assert.equal(L.parseUsdc('0.000001'), 1n);
  assert.equal(L.parseUsdc('1.0000001'), null);
  assert.equal(L.parseUsdc('abc'), null);
  assert.equal(L.usdc(1500000n), '1.5');
  assert.equal(L.usdc(1234567000000n), '1,234,567');
});

test('wallet error codes, nested ones included', () => {
  assert.equal(L.errCode({ code: 4902 }), 4902);
  assert.equal(L.errCode({ code: -32603, data: { originalError: { code: 4902 } } }), 4902);
  assert.equal(L.errCode({ code: 4001 }), 4001);
  assert.equal(L.errCode(null), undefined);
});
