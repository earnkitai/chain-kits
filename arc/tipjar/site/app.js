// The tip page. Static, no build step, no dependencies, no keys. Settings come from config.js
// (written by scripts/make-site.mjs). Hosted on EarnKit it runs in a sandbox with an opaque origin:
// no browser storage, no fetch of its own files; reads go to the chain's public RPC.
// Without a wallet it still shows the jar, the owner and the totals, plus "Tip from the explorer".
(function () {
  'use strict';
  var C = window.TIPJAR;
  var USDC = '0x3600000000000000000000000000000000000000';
  var SEL = {
    owner: '0x8da5cb5b',
    stats: '0xd80528ae',
    minTip: '0x0458b5b4',
    allowance: '0xdd62ed3e',
    approve: '0x095ea7b3',
    tip: '0x0d9d4f06',
  };
  // keccak256("Tipped(address,uint256,string)")
  var TIPPED = '0x4f629a5f1c8e7fc616770a8d34896b447f3457037c40a23347478746309d73c2';
  var LOG_CHUNK = 10000; // Arc's RPC accepts at most 10,000 blocks per eth_getLogs
  var NOTE_CHUNKS = 8;
  var NOTES_SHOWN = 8;

  var $ = function (id) { return document.getElementById(id); };
  var status = function (text) { $('status').textContent = text || ''; };

  if (!C || !/^0x[0-9a-fA-F]{40}$/.test(C.jar || '')) {
    status('This page has no jar yet: run scripts/make-site.mjs.');
    $('tip-btn').disabled = true;
    return;
  }

  // ---- ABI helpers (just what this page needs)
  var hex = function (n) { return '0x' + BigInt(n).toString(16); };
  var word = function (n) { return BigInt(n).toString(16).padStart(64, '0'); };
  var addrWord = function (a) { return a.toLowerCase().replace(/^0x/, '').padStart(64, '0'); };
  function encodeTip(amount, note) {
    var bytes = new TextEncoder().encode(note);
    var data = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var padded = data.padEnd(Math.ceil(data.length / 64) * 64, '0');
    return SEL.tip + word(amount) + word(64) + word(bytes.length) + padded;
  }
  function decodeNote(data) {
    var d = data.replace(/^0x/, '');
    var amount = BigInt('0x' + d.slice(0, 64));
    var off = Number(BigInt('0x' + d.slice(64, 128))) * 2;
    var len = Number(BigInt('0x' + d.slice(off, off + 64)));
    var raw = d.slice(off + 64, off + 64 + len * 2);
    var bytes = new Uint8Array(raw.match(/../g) ? raw.match(/../g).map(function (h) { return parseInt(h, 16); }) : []);
    return { amount: amount, note: new TextDecoder().decode(bytes) };
  }
  function usdc(units) {
    var s = BigInt(units).toString().padStart(7, '0');
    var whole = s.slice(0, -6), frac = s.slice(-6).replace(/0+$/, '');
    return Number(whole).toLocaleString('en-US') + (frac ? '.' + frac : '');
  }
  function parseUsdc(s) {
    var m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(s).trim());
    if (!m) return null;
    return BigInt(m[1]) * 1000000n + BigInt((m[2] || '').padEnd(6, '0'));
  }
  var short = function (a) { return a.slice(0, 6) + '...' + a.slice(-4); };

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

  function renderText() {
    document.title = C.name;
    $('name').textContent = C.name;
    $('description').textContent = C.description;
    $('feature').textContent = C.feature;
    $('chain').textContent = 'USDC on ' + C.chain_name;
    var meta = document.querySelector('meta[name=description]');
    if (meta) meta.setAttribute('content', C.description);
    if (C.explorer) $('contract').href = C.explorer + '/address/' + C.jar;
    else $('contract').removeAttribute('href');
  }

  function renderGoal() {
    if (C.feature_kind !== 'goal' || !(C.goal_usdc > 0)) return;
    var goal = parseUsdc(String(C.goal_usdc)) || 1n;
    var pct = Number((total * 1000n) / goal) / 10;
    $('goal').hidden = false;
    $('goal-fill').style.width = Math.min(100, pct) + '%';
    $('goal-text').textContent = usdc(total) + ' of ' + usdc(goal) + ' USDC (' + Math.floor(pct) + '%)';
  }

  function loadStats() {
    return Promise.all([call(C.jar, SEL.owner), call(C.jar, SEL.stats), call(C.jar, SEL.minTip)]).then(function (r) {
      var owner = '0x' + r[0].slice(-40);
      $('owner').textContent = short(owner);
      if (C.explorer) $('owner').href = C.explorer + '/address/' + owner;
      var s = r[1].replace(/^0x/, '');
      total = BigInt('0x' + s.slice(64, 128));
      $('count').textContent = BigInt('0x' + s.slice(0, 64)).toLocaleString('en-US');
      $('total').textContent = usdc(total);
      $('tippers').textContent = BigInt('0x' + s.slice(128, 192)).toLocaleString('en-US');
      minTip = BigInt(r[2]);
      renderGoal();
    }).catch(function () {
      status("Couldn't read the jar right now. Refresh to try again.");
    });
  }

  // Recent notes: newest first, LOG_CHUNK blocks at a time, never before the deploy block.
  function loadNotes() {
    if (C.feature_kind !== 'notes') return Promise.resolve();
    var list = $('notes');
    var found = [];
    return rpc('eth_blockNumber').then(function (h) {
      var head = BigInt(h);
      var floor = C.deploy_block != null ? BigInt(C.deploy_block) : 0n;
      var chunk = 0;
      function next(to) {
        if (found.length >= NOTES_SHOWN || chunk >= NOTE_CHUNKS || to < floor) return Promise.resolve();
        var from = to - BigInt(LOG_CHUNK - 1);
        if (from < floor) from = floor;
        chunk++;
        return rpc('eth_getLogs', [{ address: C.jar, topics: [TIPPED], fromBlock: hex(from), toBlock: hex(to) }]).then(function (logs) {
          logs.reverse().forEach(function (l) {
            var t = decodeNote(l.data);
            found.push({ from: '0x' + l.topics[1].slice(26), amount: t.amount, note: t.note });
          });
          return from === 0n ? null : next(from - 1n);
        });
      }
      return next(head);
    }).then(function () {
      list.textContent = '';
      found.slice(0, NOTES_SHOWN).forEach(function (n) {
        var li = document.createElement('li');
        li.textContent = n.note || 'No note';
        var who = document.createElement('span');
        who.textContent = usdc(n.amount) + ' USDC from ' + short(n.from);
        li.appendChild(who);
        list.appendChild(li);
      });
      if (!found.length) {
        var li = document.createElement('li');
        li.textContent = 'No notes yet. Be the first.';
        list.appendChild(li);
      }
      list.hidden = false;
    }).catch(function () { /* notes are extra: the jar still works */ });
  }

  // ---- Amount and note
  function amount() { return parseUsdc($('amount').value); }
  function refreshButton() {
    var a = amount();
    $('tip-btn').textContent = a && a > 0n ? 'Tip ' + usdc(a) + ' USDC' : 'Tip';
    var units = a ? a.toString() : '-';
    Array.prototype.forEach.call(document.querySelectorAll('.ex-units'), function (el) { el.textContent = units; });
    $('ex-note').textContent = $('note').value ? JSON.stringify($('note').value) : '""';
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

  // ---- Tip from the explorer (always available; the only way when no wallet can connect here)
  function showExplorer(reason) {
    if (reason) status(reason);
    if (!C.explorer) return;
    $('explorer').hidden = false;
    $('ex-spender').textContent = C.jar;
    $('ex-approve').href = C.explorer + '/address/' + USDC + '?tab=write_proxy';
    $('ex-tip').href = C.explorer + '/address/' + C.jar + '?tab=write_contract';
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
      var chainId = hex(C.chain_id);
      return eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainId }] }).catch(function (err) {
        if (err && err.code !== 4902) throw err;
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
    if (new TextEncoder().encode(note).length > 280) return status('Keep the note under 280 characters.');
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
      var cancelled = err && err.code === 4001;
      showExplorer(cancelled ? 'Wallet request cancelled.' : "Couldn't connect a wallet here. Tip from the explorer below.");
      throw null;
    }).then(function () {
      return call(USDC, SEL.allowance + addrWord(from) + addrWord(C.jar));
    }).then(function (allowance) {
      if (BigInt(allowance) >= a) return;
      status('Approve ' + usdc(a) + ' USDC in your wallet (step 1 of 2).');
      return send(from, USDC, SEL.approve + addrWord(C.jar) + word(a)).then(waitReceipt);
    }).then(function () {
      status('Confirm the tip in your wallet (step 2 of 2).');
      return send(from, C.jar, encodeTip(a, note));
    }).then(function (hash) {
      status('Sending...');
      return waitReceipt(hash).then(function () { return hash; });
    }).then(function (hash) {
      status('Thank you. Tipped ' + usdc(a) + ' USDC.');
      if (C.explorer) {
        var link = document.createElement('a');
        link.href = C.explorer + '/tx/' + hash;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = ' View it';
        $('status').appendChild(link);
      }
      $('note').value = '';
      refreshButton();
      return Promise.all([loadStats(), loadNotes()]);
    }).catch(function (err) {
      if (err === null) return;
      status(err && err.code === 4001 ? 'Cancelled.' : (err && err.message) || 'The tip did not go through.');
    }).then(function () { btn.disabled = false; });
  });

  renderText();
  refreshButton();
  if (C.wallet_connect === false) showExplorer();
  loadStats();
  loadNotes();
})();
