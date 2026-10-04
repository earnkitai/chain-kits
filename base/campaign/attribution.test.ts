import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Attribution } from 'ox/erc8021';
import { EARNKIT_BUILDER_CODE, dataSuffix, entryMessage, repoKey } from './attribution.ts';

const codes = (hex: `0x${string}`) => (Attribution.fromData(hex) as { codes?: readonly string[] } | undefined)?.codes;

test("every transaction carries EarnKit's code, plus the builder's own when they have one", () => {
  assert.equal(EARNKIT_BUILDER_CODE, 'earnkit');
  assert.deepEqual(codes(`0xa9059cbb${dataSuffix().slice(2)}`), ['earnkit']);
  assert.deepEqual(codes(`0xa9059cbb${dataSuffix('bc_ab12cd34').slice(2)}`), ['earnkit', 'bc_ab12cd34']);
  assert.deepEqual(codes(`0xa9059cbb${dataSuffix(' earnkit ').slice(2)}`), ['earnkit']);
  assert.throws(() => dataSuffix('BC-Nope'), /lowercase/);
});

test('repoKey: scheme, www., query, fragment, trailing "/" or ".git", /tree/ and case are ignored', () => {
  assert.equal(repoKey('https://www.GitHub.com/Alice/TipJar.git/'), 'github.com/alice/tipjar');
  assert.throws(() => repoKey('https://gitlab.com/a/b'), /GitHub/);
});

test("the entry message matches EarnKit's entry-proof.ts byte for byte: program, repo, lowercase payout wallet, sorted lowercase contracts", () => {
  const C1 = `0x${'1'.repeat(40)}`;
  const C2 = `0x${'2'.repeat(40)}`;
  assert.equal(
    entryMessage('earnkit-campaign-1-base', 'https://github.com/Alice/TipJar', '0xAbC0000000000000000000000000000000000001', [
      C2,
      C1.toUpperCase().replace('0X', '0x'),
    ]),
    `EarnKit entry: earnkit-campaign-1-base github.com/alice/tipjar 0xabc0000000000000000000000000000000000001 ${C1},${C2}`,
  );
});
