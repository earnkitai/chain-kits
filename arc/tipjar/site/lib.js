// Pure helpers for the tip page: ABI encoding, USDC amounts, which notes to show.
// No DOM, no network, so scripts/page.test.mjs tests them in Node.
(function (root) {
  'use strict';
  var TIP = '0x0d9d4f06'; // tip(uint256,string)
  // Notes from tips under this floor are hidden (they still count in the totals). A note costs at
  // least 1 USDC to show, so the page can't be cheaply covered in text.
  var NOTE_FLOOR = 1000000n;

  var hex = function (n) { return '0x' + BigInt(n).toString(16); };
  var word = function (n) { return BigInt(n).toString(16).padStart(64, '0'); };
  var addrWord = function (a) { return a.toLowerCase().replace(/^0x/, '').padStart(64, '0'); };

  function encodeTip(amount, note) {
    var bytes = new TextEncoder().encode(note);
    var data = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var padded = data.padEnd(Math.ceil(data.length / 64) * 64, '0');
    return TIP + word(amount) + word(64) + word(bytes.length) + padded;
  }

  function decodeNote(data) {
    var d = data.replace(/^0x/, '');
    var amount = BigInt('0x' + d.slice(0, 64));
    var off = Number(BigInt('0x' + d.slice(64, 128))) * 2;
    var len = Number(BigInt('0x' + d.slice(off, off + 64)));
    var raw = d.slice(off + 64, off + 64 + len * 2);
    var pairs = raw.match(/../g) || [];
    var bytes = new Uint8Array(pairs.map(function (h) { return parseInt(h, 16); }));
    return { amount: amount, note: new TextDecoder().decode(bytes) };
  }

  function usdc(units) {
    var s = BigInt(units).toString().padStart(7, '0');
    var whole = s.slice(0, -6), frac = s.slice(-6).replace(/0+$/, '');
    return BigInt(whole).toLocaleString('en-US') + (frac ? '.' + frac : '');
  }

  function parseUsdc(s) {
    var m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(s).trim());
    if (!m) return null;
    return BigInt(m[1]) * 1000000n + BigInt((m[2] || '').padEnd(6, '0'));
  }

  /** The smallest tip whose note is shown: max(minTip, 1 USDC). */
  function noteFloor(minTip) {
    var m = BigInt(minTip || 0);
    return m > NOTE_FLOOR ? m : NOTE_FLOOR;
  }
  var noteShown = function (amount, minTip) { return BigInt(amount) >= noteFloor(minTip); };

  /** A wallet error's code, also when the wallet nests it (MetaMask mobile: data.originalError). */
  function errCode(err) {
    if (!err) return undefined;
    if (err.code !== undefined && err.code !== -32603) return err.code;
    var nested = err.data && err.data.originalError;
    return nested && nested.code !== undefined ? nested.code : err.code;
  }

  var api = {
    hex: hex, word: word, addrWord: addrWord, encodeTip: encodeTip, decodeNote: decodeNote,
    usdc: usdc, parseUsdc: parseUsdc, noteFloor: noteFloor, noteShown: noteShown, errCode: errCode,
  };
  root.TipLib = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
