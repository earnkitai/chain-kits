// The tip page. Static, no build step, no dependencies, no keys. Settings come from config.js
// (written by scripts/make-site.mjs); pure helpers from lib.js. Hosted on EarnKit it runs in a
// sandbox with an opaque origin: no browser storage, no fetch of its own files, and any page it
// opens inherits the sandbox. So reads go to the chain's public RPC, and explorer links are shown
// as text to copy into a new tab, never opened from here.
(function () {
  'use strict';
  var C = window.TIPJAR;
  var L = window.TipLib;
  var USDC = '0x3600000000000000000000000000000000000000';
  var SEL = { owner: '0x8da5cb5b', stats: '0xd80528ae', minTip: '0x0458b5b4', allowance: '0xdd62ed3e', approve: '0x095ea7b3' };
  // keccak256("Tipped(address,uint256,string)")
  var TIPPED = '0x4f629a5f1c8e7fc616770a8d34896b447f3457037c40a23347478746309d73c2';
  var LOG_CHUNK = 10000; // Arc's RPC accepts at most 10,000 blocks per eth_getLogs
  var NOTE_CHUNKS = 8;
  var NOTES_SHOWN = 8;

  var $ = function (id) { return document.getElementById(id); };
  var status = function (text) { $('status').textContent = text || ''; };

  if (!C || !L || !/^0x[0-9a-fA-F]{40}$/.test(C.jar || '')) {
    status('This page has no jar yet: run scripts/make-site.mjs.');
    $('tip-btn').disabled = true;
    return;
  }
  var short = function (a) { return a.slice(0, 6) + '...' + a.slice(-4); };
  var usdc = L.usdc;

  // ---- Copy on tap (the clipboard API may be blocked in the sandbox: then the text is selected)
  function copyText(el) {
    var text = el.getAttribute('data-copy') || el.textContent;
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var done = function () { status('Copied.'); };
    var fallback = function () {
      try {
        if (document.execCommand('copy')) return done();
      } catch (e) { /* blocked */ }
      status('Selected. Copy it with your keyboard or menu.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (e) {
      fallback();
    }
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.copy') : null;
    if (el) copyText(el);
  });
  function setCopy(id, full, shown) {
    var el = $(id);
    el.textContent = shown || full;
    el.setAttribute('data-copy', full);
    el.title = full;
  }

  // ---- Reads over the public RPC
  var rpcId = 0;
  function rpc(method, params) {
    return fetch(C.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: method, params: params || [] }),
    }).then(function (r) { return r.json(); }).then(function (b) {
      if (b.error) throw new Error(b.error.message);
      return b.result;
    });
  }
  var call = function (to, data) { return rpc('eth_call', [{ to: to, data: data }, 'latest']); };

  var minTip = 0n;
  var total = 0n;
  var tips = 0n;

  function renderText() {
    document.title = C.name;
    $('name').textContent = C.name;
    $('description').textContent = C.description;
    $('feature').textContent = C.feature;
    $('chain').textContent = 'USDC on ' + C.chain_name;
    var meta = document.querySelector('meta[name=description]');
    if (meta) meta.setAttribute('content', C.description);
    setCopy('contract', C.jar, short(C.jar));
  }

  function renderGoal() {
    if (C.feature_kind !== 'goal') return;
    var goal = L.parseUsdc(String(C.goal_usdc));
    if (!goal || goal <= 0n) return;
    var pct = Number((total * 1000n) / goal) / 10;
    $('goal').hidden = false;
    $('goal-fill').style.width = Math.min(100, pct) + '%';
    $('goal-text').textContent = usdc(total) + ' of ' + usdc(goal) + ' USDC (' + Math.floor(pct) + '%)';
  }

  function loadStats() {
    return Promise.all([call(C.jar, SEL.owner), call(C.jar, SEL.stats), call(C.jar, SEL.minTip)]).then(function (r) {
      var owner = '0x' + r[0].slice(-40);
      setCopy('owner', owner, short(owner));
      var s = r[1].replace(/^0x/, '');
      tips = BigInt('0x' + s.slice(0, 64));
      total = BigInt('0x' + s.slice(64, 128));
      $('count').textContent = tips.toLocaleString('en-US');
      $('total').textContent = usdc(total);
      $('tippers').textContent = BigInt('0x' + s.slice(128, 192)).toLocaleString('en-US');
      minTip = BigInt(r[2]);
      renderGoal();
    }).catch(function () {
      status("Couldn't read the jar right now. Refresh to try again.");
    });
  }

  // Recent notes: newest first, LOG_CHUNK blocks at a time, never before the deploy block. Only
  // notes from tips of at least max(minTip, 1 USDC) are shown (lib.js noteShown).
  function loadNotes(statsDone) {
    if (C.feature_kind !== 'notes') return Promise.resolve();
    var list = $('notes');
    var found = [];
    var scannedAll = false;
    return Promise.all([rpc('eth_blockNumber'), statsDone]).then(function (r) {
      var head = BigInt(r[0]);
      var floor = C.deploy_block != null ? BigInt(C.deploy_block) : 0n;
      var chunk = 0;
      function next(to) {
        if (to < floor) { scannedAll = true; return Promise.resolve(); }
        if (found.length >= NOTES_SHOWN || chunk >= NOTE_CHUNKS) return Promise.resolve();
        var from = to - BigInt(LOG_CHUNK - 1);
        if (from < floor) from = floor;
        chunk++;
        return rpc('eth_getLogs', [{ address: C.jar, topics: [TIPPED], fromBlock: L.hex(from), toBlock: L.hex(to) }]).then(function (logs) {
          logs.reverse().forEach(function (l) {
            var t = L.decodeNote(l.data);
            if (t.note && L.noteShown(t.amount, minTip)) found.push({ from: '0x' + l.topics[1].slice(26), amount: t.amount, note: t.note });
          });
          if (from === 0n) { scannedAll = true; return null; }
          return next(from - 1n);
        });
      }
      return next(head);
    }).then(function () {
      list.textContent = '';
      found.slice(0, NOTES_SHOWN).forEach(function (n) {
        var li = document.createElement('li');
        li.textContent = n.note;
        var who = document.createElement('span');
        who.textContent = usdc(n.amount) + ' USDC from ' + short(n.from);
        li.appendChild(who);
        list.appendChild(li);
      });
      if (!found.length) {
        var li = document.createElement('li');
        li.textContent = tips > 0n && !scannedAll ? 'No notes in the last few hours.' : 'No notes yet. Tip ' + usdc(L.noteFloor(minTip)) + ' USDC or more to leave one.';
        list.appendChild(li);
      }
      list.hidden = false;
    }).catch(function () { /* notes are extra: the jar still works */ });
  }

  // ---- Amount and note
  function amount() { return L.parseUsdc($('amount').value); }
  function refreshButton() {
    var a = amount();
    $('tip-btn').textContent = a && a > 0n ? 'Tip ' + usdc(a) + ' USDC' : 'Tip';
    var units = a ? a.toString() : '-';
    Array.prototype.forEach.call(document.querySelectorAll('.ex-units'), function (el) { el.textContent = units; el.setAttribute('data-copy', units); });
    var note = $('note').value;
    $('ex-note').textContent = note ? note : '(empty)';
    $('ex-note').setAttribute('data-copy', note);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.pill'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.pill'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      $('amount').value = b.getAttribute('data-amount');
      refreshButton();
    });
  });
  $('amount').addEventListener('input', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.pill'), function (x) {
      x.classList.toggle('on', x.getAttribute('data-amount') === $('amount').value.trim());
    });
    refreshButton();
  });
  $('note').addEventListener('input', refreshButton);

  // ---- Tip from the explorer: text to copy, never a link (a link would open inside the sandbox)
  function showExplorer(reason) {
    if (reason) status(reason);
    if (!C.explorer) return;
    $('explorer').hidden = false;
    setCopy('ex-approve-url', C.explorer + '/address/' + USDC + '?tab=write_proxy');
    setCopy('ex-tip-url', C.explorer + '/address/' + C.jar + '?tab=write_contract');
    setCopy('ex-spender', C.jar);
    setCopy('ex-usdc', USDC);
    refreshButton();
  }
  $('explorer-link').addEventListener('click', function (e) {
    e.preventDefault();
    showExplorer();
    $('explorer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  if (!C.explorer) $('explorer-link').hidden = true;

  // ---- Tip with a wallet
  var eth = window.ethereum;
  function waitReceipt(hash) {
    return new Promise(function (resolve, reject) {
      var tries = 0;
      (function poll() {
        rpc('eth_getTransactionReceipt', [hash]).then(function (r) {
          if (r) return r.status === '0x1' ? resolve(r) : reject(new Error('The transaction reverted.'));
          if (++tries > 120) return reject(new Error('Still pending. Check the explorer.'));
          setTimeout(poll, 1000);
        }, function () { setTimeout(poll, 1000); });
      })();
    });
  }
  function ensureChain() {
    return eth.request({ method: 'eth_chainId' }).then(function (id) {
      if (parseInt(id, 16) === C.chain_id) return;
      var chainId = L.hex(C.chain_id);
      return eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainId }] }).catch(function (err) {
        if (L.errCode(err) !== 4902) throw err;
        return eth.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainId,
            chainName: C.chain_name,
            nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
            rpcUrls: [C.rpc],
            blockExplorerUrls: C.explorer ? [C.explorer] : undefined,
          }],
        });
      });
    });
  }
  var send = function (from, to, data) {
    return eth.request({ method: 'eth_sendTransaction', params: [{ from: from, to: to, data: data }] });
  };

  $('tip-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = amount();
    var note = $('note').value;
    if (!a || a <= 0n) return status('Enter an amount in USDC.');
    if (a < minTip) return status('The smallest tip is ' + usdc(minTip) + ' USDC.');
    if (new TextEncoder().encode(note).length > 280) return status('Keep the note under 280 bytes (an emoji counts as 4).');
    if (!eth || C.wallet_connect === false) return showExplorer(C.explorer ? 'No wallet here. Tip from the explorer below.' : 'No wallet found.');
    var btn = $('tip-btn');
    btn.disabled = true;
    var from;
    status('Connecting your wallet...');
    eth.request({ method: 'eth_requestAccounts' }).then(function (accounts) {
      from = accounts[0];
      return ensureChain();
    }).catch(function (err) {
      // Couldn't connect here (the sandbox or the wallet): the explorer still works.
      showExplorer(L.errCode(err) === 4001 ? 'Wallet request cancelled.' : "Couldn't connect a wallet here. Tip from the explorer below.");
      throw null;
    }).then(function () {
      return call(USDC, SEL.allowance + L.addrWord(from) + L.addrWord(C.jar));
    }).then(function (allowance) {
      if (BigInt(allowance) >= a) return;
      status('Approve ' + usdc(a) + ' USDC in your wallet (step 1 of 2).');
      return send(from, USDC, SEL.approve + L.addrWord(C.jar) + L.word(a)).then(waitReceipt);
    }).then(function () {
      status('Confirm the tip in your wallet (step 2 of 2).');
      return send(from, C.jar, L.encodeTip(a, note));
    }).then(function (hash) {
      status('Sending...');
      return waitReceipt(hash).then(function () { return hash; });
    }).then(function (hash) {
      status('Thank you. Tipped ' + usdc(a) + ' USDC.');
      var tx = document.createElement('code');
      tx.className = 'copy';
      tx.textContent = C.explorer ? C.explorer + '/tx/' + hash : hash;
      $('tx').textContent = 'Transaction (copy to view): ';
      $('tx').appendChild(tx);
      $('tx').hidden = false;
      $('note').value = '';
      refreshButton();
      var stats = loadStats();
      return Promise.all([stats, loadNotes(stats)]);
    }).catch(function (err) {
      if (err === null) return;
      status(L.errCode(err) === 4001 ? 'Cancelled.' : (err && err.message) || 'The tip did not go through.');
    }).then(function () { btn.disabled = false; });
  });

  renderText();
  refreshButton();
  if (C.wallet_connect === false) showExplorer();
  var stats = loadStats();
  loadNotes(stats);
})();
