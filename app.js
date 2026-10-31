const HISTORY_SIZE = 20, BET_TIME = 40, REVEAL_TIME = 5, RESULT_TIME = 5;
const diceLayouts = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const SIDE_NAME = { T: 'Hà Thành', X: 'Ngọc Xăm' };
const CHIPS = [['1K',1e3],['10K',1e4],['50K',5e4],['100K',1e5],['500K',5e5],['5M',5e6],['10M',1e7],['50M',5e7]];
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const $ = (id) => document.getElementById(id);

// ============ TRẠNG THÁI: mỗi bàn có state riêng nên 2 bàn chạy song song, tiền dùng chung ============
function rollDice() {
  const d = [0, 0, 0].map(() => randInt(1, 6));
  const total = d[0] + d[1] + d[2];
  return { d, total, result: total >= 11 ? 'T' : 'X' };
}
function seedCrowd(t) { // số liệu "người chơi khác" chỉ để trang trí
  t.pool = { T: randInt(5e6, 40e6), X: randInt(5e6, 40e6) };
  t.players = { T: randInt(800, 2000), X: randInt(800, 2000) };
}
function makeTable(id, name, theme, color, startTimer, base) {
  const history = [];
  for (let i = 0; i < HISTORY_SIZE; i++) { // 20 phiên ngẫu nhiên, mới nhất ở đầu
    const r = rollDice();
    history.push({ session: base + HISTORY_SIZE - i, ...r, time: new Date(Date.now() - (i + 1) * 45000).toLocaleTimeString() });
  }
  const t = { id, name, theme, color, history, open: false, placed: false, x: 0, y: 64,
    session: base + HISTORY_SIZE + 1, phase: 'betting', timer: startTimer, phaseLeft: 0,
    dice: history[0].d.slice(), pending: null, side: null, staged: 0, chipsOpen: false, betAmount: 0, dotKey: null };
  seedCrowd(t);
  return t;
}
const gameState = { balance: 100000, focus: null,
  tables: { 1: makeTable(1, "Xanh", "theme-blue", "#2980b9", 40, 3309000),
            2: makeTable(2, "Đỏ", "theme-red", "#c0392b", 25, 3318000) } };
const canBet = (t) => t.phase === 'betting' && t.timer > 1;
const actTable = (id) => { const t = gameState.tables[id]; return t && t.open && gameState.focus === id ? t : null; };

// ============ CỬA SỔ BÀN ============
function windowHTML(t) {
  const id = t.id;
  const side = (s, name, range) => `
    <div class="side-panel side-${s}" data-r="box${s}" onclick="selectSide(${id},'${s}')">
      <div class="players">👥 <span data-r="players${s}">0</span></div>
      <div class="side-name">${name}</div><div class="side-range">${range}</div>
      <div class="pool" data-r="pool${s}">0</div>
      <button class="pill" type="button">ĐẶT CƯỢC</button>
      <div class="mybet" data-r="bet${s}">0</div>
    </div>`;
  const svgChart = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,18 8,8 14,15 22,4"/></svg>';
  return `<div class="win-inner">
    <div class="deco"><span class="d-dice">🎲</span><span class="d-coin">🪙</span></div>
    <div class="win-bar" data-r="bar">
      <div class="ibar left">
        <button class="ico-btn" title="Lịch sử phiên" onclick="openHistory(${id})">${svgChart}</button>
        <button class="ico-btn" title="Luật chơi" onclick="showRules()">?</button>
        <span class="win-label" style="background:${t.color}">BÀN ${t.name.toUpperCase()}</span>
      </div>
      <div class="session-plate" data-r="sessionNo">#0</div>
      <div class="ibar right">
        <button class="ico-btn" title="Vinh danh" onclick="soon()">🏆</button>
        <button class="ico-btn" title="Chat" onclick="soon()">💬</button>
        <button class="ico-btn" title="Đóng bàn" onclick="closeTable(${id})">✕</button>
      </div>
    </div>
    <div class="win-body">
      <div class="status-plate" data-r="result"></div>
      <div class="board-main">
        ${side('T', 'Hà Thành', '(11 - 17)')}
        <div class="dice-area">
          <div class="disk" data-r="disk">KÉO ĐỂ MỞ</div>
          <div class="dice-box" data-r="diceBox"><div class="dice" data-r="d1"></div><div class="dice" data-r="d2"></div><div class="dice" data-r="d3"></div></div>
          <div class="timer" data-r="timer">40</div>
        </div>
        ${side('X', 'Ngọc Xăm', '(4 - 10)')}
      </div>
      <div class="road-row">
        <button class="ico-btn rb" title="Chi tiết phiên" onclick="openHistory(${id})">📋</button>
        <div class="dot-road" data-r="dotRoad"></div>
        <button class="ico-btn rb" title="Cược nhanh" onclick="soon()">✋</button>
      </div>
      <div class="chip-wrap" data-r="chipRow"><div class="chip-inner"><div class="chip-row">${CHIPS.map(c => `<button class="chip" onclick="addChip(${id},${c[1]})">${c[0]}</button>`).join('')}</div></div></div>
      <div class="action-row" data-r="controls">
        <button class="act act-allin" onclick="allIn(${id})">ALL-IN</button>
        <button class="act act-confirm" onclick="confirmBet(${id})">ĐẶT CƯỢC</button>
        <button class="act act-cancel" onclick="cancelBet(${id})">HỦY</button>
      </div>
    </div></div>`;
}

function buildWindow(t) {
  const win = document.createElement('div');
  win.className = 'tbl-window ' + t.theme;
  win.innerHTML = windowHTML(t);
  t.win = win; t.r = {};
  win.querySelectorAll('[data-r]').forEach(el => t.r[el.dataset.r] = el);
  $('windows').appendChild(win);
  win.addEventListener('pointerdown', () => focusTable(t.id), true); // bấm vào bàn mờ để chuyển bàn

  // Kéo cả cửa sổ bằng thanh tiêu đề
  let drag = null;
  const bar = t.r.bar;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { dx: e.clientX - t.x, dy: e.clientY - t.y };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const w = win.offsetWidth;
    t.x = Math.min(Math.max(e.clientX - drag.dx, 90 - w), innerWidth - 90);
    t.y = Math.min(Math.max(e.clientY - drag.dy, 8), innerHeight - 50);
    t.y = Math.max(t.y, 8);
    if (!t.raf) t.raf = requestAnimationFrame(() => { t.raf = 0; moveWin(t); });
  });
  ['pointerup', 'pointercancel'].forEach(ev => bar.addEventListener(ev, () => drag = null));

  setupDisk(t);
}

function setupDisk(t) {
  const disk = t.r.disk; let drag = null;
  disk.addEventListener('pointerdown', (e) => {
    if (t.phase !== 'reveal' || gameState.focus !== t.id) return;
    drag = { x: e.clientX, y: e.clientY };
    disk.setPointerCapture(e.pointerId);
    disk.style.cursor = 'grabbing'; disk.style.transition = 'none';
  });
  disk.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (t.phase !== 'reveal') { drag = null; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    disk.style.transform = `translate(${dx}px, ${dy}px)`;
    if (Math.hypot(dx, dy) > 120) { drag = null; settle(t); renderAll(); } // kéo xa 120px = mở đĩa
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    disk.style.cursor = 'grab';
    disk.style.transition = 'transform .2s ease-out';
    disk.style.transform = 'translate(0,0)';
    setTimeout(() => disk.style.transition = 'none', 200);
  };
  disk.addEventListener('pointerup', release);
  disk.addEventListener('pointercancel', release);
}

function placeWindow(t) {
  const w = t.win.offsetWidth, gap = 16;
  const x1 = Math.max(8, (innerWidth - 2 * w - gap) / 2);
  let x = t.id === 1 ? x1 : x1 + w + gap;
  if (x + w > innerWidth - 8) x = Math.max(8, Math.min(x1 + 40 * (t.id - 1), innerWidth - w - 8));
  t.x = x; t.y = 70 + (t.id - 1) * 12; t.placed = true;
  moveWin(t);
}
function moveWin(t) { t.win.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`; }


function openTable(id) {
  const t = gameState.tables[id];
  $('stage').style.display = 'block'; // sảnh vẫn chạy mờ phía sau
  if (!t.open) {
    t.open = true; t.win.style.display = 'block';
    t.win.classList.remove('pop'); void t.win.offsetWidth; t.win.classList.add('pop');
    if (!t.placed) placeWindow(t);
  }
  focusTable(id);
}

function focusTable(id) {
  if (gameState.focus === id) return;
  gameState.focus = id;
  renderAll();
}

function closeTable(id) {
  const t = gameState.tables[id];
  t.staged = 0; // tiền chưa xác nhận bỏ đi; cược đã xác nhận vẫn được trả thưởng khi bàn mở kết quả
  t.open = false; t.win.style.display = 'none';
  if (gameState.focus === id) {
    const other = Object.values(gameState.tables).find(x => x.open);
    gameState.focus = other ? other.id : null;
  }
  if (histState.id === id) closeHistory();
  renderAll();
}

// ============ ĐẶT CƯỢC (chỉ thao tác được trên bàn đang rõ) ============
function selectSide(id, side) {
  const t = actTable(id);
  if (!t || !canBet(t)) return;
  if (t.betAmount > 0 && t.side !== side) { showNotif(`Bạn đã cược cửa ${SIDE_NAME[t.side]}. Bấm "HỦY" nếu muốn đổi cửa.`); return; }
  t.side = side; t.chipsOpen = true; renderAll();
}
function checkCanBet(t) {
  if (!canBet(t)) { showNotif("Đã hết thời gian đặt cược!"); return false; }
  if (!t.side) { showNotif("Hãy chọn cửa cược trước!"); return false; }
  return true;
}
function addChip(id, amt) {
  const t = actTable(id);
  if (!t || !checkCanBet(t)) return;
  if (t.staged + amt > gameState.balance) { showNotif("Không đủ tiền!"); return; }
  t.staged += amt; renderAll();
}
function allIn(id) { // chọn toàn bộ số dư, bấm ĐẶT CƯỢC mới trừ tiền
  const t = actTable(id);
  if (!t || !checkCanBet(t)) return;
  if (gameState.balance <= 0) { showNotif("Bạn đã hết tiền!"); return; }
  t.staged = gameState.balance; renderAll();
}
function confirmBet(id) {
  const t = actTable(id);
  if (!t || !checkCanBet(t)) return;
  if (t.staged <= 0) { // chưa chọn mệnh giá: bấm để mở hàng mệnh giá
    if (!t.chipsOpen) t.chipsOpen = true; else showNotif("Hãy chọn mức cược trước!");
    renderAll(); return;
  }
  if (t.staged > gameState.balance) { showNotif("Không đủ tiền!"); t.staged = 0; renderAll(); return; }
  gameState.balance -= t.staged;
  t.betAmount += t.staged; t.staged = 0; t.chipsOpen = false; renderAll();
}
function cancelBet(id) { // bỏ tiền đang chọn -> đóng mệnh giá -> hoàn cược đã đặt
  const t = actTable(id);
  if (!t || !canBet(t)) return;
  if (t.staged > 0) t.staged = 0;
  else if (t.chipsOpen) t.chipsOpen = false;
  else if (t.betAmount > 0) {
    gameState.balance += t.betAmount; t.betAmount = 0; t.side = null;
    showNotif("Đã hủy cược, tiền đã được hoàn lại.");
  }
  renderAll();
}

// ============ VÒNG ĐỜI MỖI PHIÊN ============
function tickTable(t) {
  if (t.phase === 'betting') {
    t.timer--;
    t.pool.T += randInt(2e5, 3e6); t.pool.X += randInt(2e5, 3e6);
    t.players.T += randInt(0, 3); t.players.X += randInt(0, 3);
    if (t.timer <= 0) startReveal(t);
  } else if (t.phase === 'reveal') {
    if (--t.phaseLeft <= 0) settle(t);
  } else if (t.phase === 'result') {
    if (--t.phaseLeft <= 0) newRound(t);
  }
}
function startReveal(t) {
  const r = rollDice();
  t.dice = r.d; t.pending = r; t.staged = 0; t.chipsOpen = false;
  t.phase = 'reveal'; t.phaseLeft = REVEAL_TIME;
}
function settle(t) { // chạy cho cả bàn đang xem lẫn bàn ngầm / bàn đã đóng
  if (t.phase !== 'reveal') return;
  const { d, total, result } = t.pending;
  if (t.betAmount > 0) {
    const prefix = t.open && gameState.focus === t.id ? '' : `[Bàn ${t.name}] `;
    if (t.side === result) {
      gameState.balance += t.betAmount * 2;
      showNotif(`${prefix}Chúc mừng! Bạn thắng ${t.betAmount.toLocaleString()}đ`);
    } else showNotif(`${prefix}Rất tiếc! Bạn đã thua ${t.betAmount.toLocaleString()}đ`);
  }
  t.history.unshift({ session: t.session, d: d.slice(), total, result, time: new Date().toLocaleTimeString() });
  if (t.history.length > HISTORY_SIZE) t.history.length = HISTORY_SIZE;
  t.betAmount = 0; t.staged = 0; t.chipsOpen = false; t.side = null;
  t.phase = 'result'; t.phaseLeft = RESULT_TIME;
}
function newRound(t) {
  t.session++; t.pending = null; t.timer = BET_TIME; t.phase = 'betting'; seedCrowd(t);
}
setInterval(() => { Object.values(gameState.tables).forEach(tickTable); renderAll(); }, 1000);

// ============ HIỂN THỊ ============
function drawDice(el, value) {
  if (el.dataset.v === String(value)) return;
  el.dataset.v = value; el.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (diceLayouts[value].includes(i)) dot.style.visibility = 'visible';
    el.appendChild(dot);
  }
}
function sideBetHTML(t, side) {
  if (t.side !== side) return '0';
  return t.betAmount.toLocaleString() + (t.staged > 0 ? ` <span class="staged">+${t.staged.toLocaleString()}</span>` : '');
}

const setTxt = (el, v) => { v = String(v); if (el._t !== v) { el._t = v; el.textContent = v; } };
const setHTML = (el, v) => { if (el._h !== v) { el._h = v; el.innerHTML = v; } };

function renderTable(t) {
  if (!t.open) return;
  const r = t.r, focused = gameState.focus === t.id;
  t.win.classList.toggle('dim', !focused);
  t.win.style.zIndex = focused ? 20 : 10;

  setTxt(r.sessionNo, '#' + t.session);
  ['T', 'X'].forEach(s => {
    setHTML(r['bet' + s], sideBetHTML(t, s));
    setTxt(r['pool' + s], (t.pool[s] + (t.side === s ? t.betAmount : 0)).toLocaleString());
    setTxt(r['players' + s], t.players[s].toLocaleString());
    const win = t.phase === 'result' && t.history[0].result === s;
    const cls = `side-panel side-${s}` + (t.side === s ? ' active' : '') + (win ? ' win' : '');
    if (r['box' + s]._c !== cls) { r['box' + s]._c = cls; r['box' + s].className = cls; }
  });
  const locked = !canBet(t);
  r.chipRow.classList.toggle('open', t.chipsOpen && !locked);
  r.chipRow.classList.toggle('locked', locked);
  r.controls.classList.toggle('locked', locked);

  const showCount = t.phase === 'betting' && t.timer > 1;
  setTxt(r.timer, String(Math.max(0, t.timer)).padStart(2, '0'));
  r.timer.style.display = showCount ? 'block' : 'none';
  r.timer.classList.toggle('urgent', t.timer <= 5);
  r.diceBox.style.visibility = showCount ? 'hidden' : 'visible';
  drawDice(r.d1, t.dice[0]); drawDice(r.d2, t.dice[1]); drawDice(r.d3, t.dice[2]);
  const rolling = t.phase === 'betting' && t.timer <= 1;
  [r.d1, r.d2, r.d3].forEach(el => el.classList.toggle('rolling', rolling));

  if (t.phase === 'reveal') r.disk.style.display = 'flex';
  else { r.disk.style.display = 'none'; r.disk.style.transform = 'translate(0,0)'; }

  let msg;
  if (t.phase === 'reveal') msg = `Hãy mở đĩa! (tự mở sau ${t.phaseLeft}s)`;
  else if (t.phase === 'result') msg = `${t.history[0].total} điểm - ${SIDE_NAME[t.history[0].result]}`;
  else if (t.timer <= 1) msg = 'Hết giờ đặt cược';
  else if (t.timer <= 5) msg = 'Sắp hết giờ đặt cược!';
  else if (t.timer >= BET_TIME - 3) msg = 'Bắt đầu phiên mới.';
  else msg = 'Mời đặt cược';
  setTxt(r.result, msg);
  r.result.classList.toggle('hot', t.phase !== 'betting' || t.timer <= 5);

  if (t.dotKey !== t.history[0].session) {
    t.dotKey = t.history[0].session;
    r.dotRoad.innerHTML = t.history.slice().reverse().map((h, i, a) =>
      `<span class="rd ${h.result}${i === a.length - 1 ? ' latest' : ''}" data-s="${h.session}" data-d="${h.d.join('-')}" data-t="${h.total}" data-r="${h.result}"></span>`).join('');
  }
}

function renderDock() {
  Object.values(gameState.tables).forEach(t => {
    const st = t.phase === 'betting' ? `còn ${t.timer}s` : t.phase === 'reveal' ? 'đang mở đĩa' : 'có kết quả';
    const b = $('dock' + t.id);
    b.innerHTML = `<b>BÀN ${t.name.toUpperCase()}</b><small>#${t.session} · ${st}${t.betAmount > 0 ? ' · cược ' + t.betAmount.toLocaleString() : ''}</small>`;
    b.className = `dock-btn ${t.theme}` + (t.open ? ' is-open' : '') + (gameState.focus === t.id ? ' is-focus' : '');
  });
  $('emptyHint').style.display = Object.values(gameState.tables).some(t => t.open) ? 'none' : 'block';
}

function renderSelection() {
  Object.values(gameState.tables).forEach(t => {
    const st = t.phase === 'betting' ? `còn ${t.timer}s` : t.phase === 'reveal' ? 'đang mở đĩa' : 'đã có kết quả';
    $('selStatus' + t.id).textContent = `Phiên #${t.session} - ${st}`;
    $('selRoad' + t.id).innerHTML = t.history.slice(0, 10).map(h => `<span class="bead ${h.result}">${h.total}</span>`).join('');
  });
}

function renderAll() {
  $('balance').textContent = gameState.balance.toLocaleString();
  Object.values(gameState.tables).forEach(renderTable);
  renderDock();
  $('lbBalance').textContent = gameState.balance.toLocaleString();
  if ($('lobby').style.display === 'flex') renderSelection();
  if (currentUser && gameState.balance !== lastSavedBal) saveBalance();
  if (histState.id !== null) renderHistModal(false);
}

// ============ TOOLTIP CHO NỐT ĐEN/TRẮNG ============
document.addEventListener('mouseover', (e) => {
  const d = e.target.closest && e.target.closest('.rd');
  if (!d) return;
  const tip = $('tip');
  tip.innerHTML = `<b>#${d.dataset.s}</b> · ${d.dataset.r === 'T' ? '⚫ Hà Thành' : '⚪ Ngọc Xăm'}<br>${d.dataset.d} = ${d.dataset.t} điểm`;
  tip.style.display = 'block';
  const b = d.getBoundingClientRect();
  tip.style.left = Math.min(Math.max(8, b.left + b.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = (b.top - tip.offsetHeight - 8) + 'px';
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest && e.target.closest('.rd')) $('tip').style.display = 'none';
});

// ============ MODAL LỊCH SỬ PHIÊN (biểu đồ zíc zắc) ============
const histState = { id: null, vis: [true, true, true], key: null };
const DICE_COLORS = [{ line: '#ffee33', dot: '#f0c030' }, { line: '#e01010', dot: '#b80d14' }, { line: '#e020e0', dot: '#a43bd8' }];

function replay(m) { m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); }
function openHistory(id) { histState.id = id; $('histModal').style.display = 'flex'; replay($('histModal')); renderHistModal(true); }
function closeHistory() { histState.id = null; $('histModal').style.display = 'none'; }
function toggleDice(k) { histState.vis[k] = !histState.vis[k]; renderHistModal(true); }

function gridSVG(X0, colW, top, bottom, labels) {
  let s = '';
  for (let i = 0; i <= HISTORY_SIZE; i++) s += `<line class="gl" x1="${X0 + i * colW}" y1="${top}" x2="${X0 + i * colW}" y2="${bottom}"/>`;
  labels.forEach(([v, y]) => s += `<line class="gl" x1="${X0}" y1="${y}" x2="${X0 + HISTORY_SIZE * colW}" y2="${y}"/><text class="yl" x="${X0 - 12}" y="${y}" text-anchor="end" dominant-baseline="central">${v}</text>`);
  return s;
}

function renderHistModal(force) {
  const t = gameState.tables[histState.id];
  if (!t) return;
  const key = histState.id + '-' + t.history[0].session + histState.vis.join('');
  if (!force && key === histState.key) return;
  histState.key = key;

  const h0 = t.history[0];
  $('histTable').textContent = 'Bàn ' + t.name;
  $('histLatest').textContent = 'Phiên gần nhất: #' + h0.session;
  $('histRes').innerHTML = `<span style="color:${h0.result === 'T' ? 'var(--tai)' : 'var(--xiu)'}">${SIDE_NAME[h0.result]}</span>(${h0.d.join('-')})`;
  [0, 1, 2].forEach(k => $('tg' + k).classList.toggle('off', !histState.vis[k]));

  const arr = t.history.slice().reverse(); // cũ -> mới
  const X0 = 60, colW = 720 / HISTORY_SIZE, cx = (i) => X0 + (i + 0.5) * colW;

  // Biểu đồ 1: tổng điểm 3..18 (nốt đen = Hà Thành, nốt trắng = Ngọc Xăm)
  const yT = (v) => 205 - (v - 3) / 15 * 185;
  let s = gridSVG(X0, colW, 20, 205, [3, 6, 9, 12, 15, 18].map(v => [v, yT(v)]));
  s += `<polyline fill="none" stroke="#fff" stroke-width="1.5" points="${arr.map((h, i) => cx(i) + ',' + yT(h.total)).join(' ')}"/>`;
  arr.forEach((h, i) => {
    const black = h.result === 'T';
    s += `<circle cx="${cx(i)}" cy="${yT(h.total)}" r="12" fill="${black ? '#0b0b0b' : '#f4ead0'}" stroke="#c9a14a" stroke-width="2"/>` +
         `<text x="${cx(i)}" y="${yT(h.total)}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="${black ? '#fff' : '#222'}">${h.total}</text>`;
  });
  $('chartTotal').innerHTML = s;

  // Biểu đồ 2: từng xúc xắc 1, 2, 3 (giá trị 1..6)
  const yD = (v) => 170 - (v - 1) / 5 * 150;
  s = gridSVG(X0, colW, 20, 170, [1, 2, 3, 4, 5, 6].map(v => [v, yD(v)]));
  [2, 1, 0].forEach(k => {
    if (!histState.vis[k]) return;
    s += `<polyline fill="none" stroke="${DICE_COLORS[k].line}" stroke-width="1.8" points="${arr.map((h, i) => cx(i) + ',' + yD(h.d[k])).join(' ')}"/>`;
    arr.forEach((h, i) => s += `<circle cx="${cx(i)}" cy="${yD(h.d[k])}" r="7" fill="${DICE_COLORS[k].dot}" stroke="rgba(255,255,255,.6)" stroke-width="1"/>`);
  });
  $('chartDice').innerHTML = s;
}

let notifTimeout = null;
function showNotif(msg) {
  const n = $('notif');
  n.textContent = msg; n.style.display = 'block';
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => n.style.display = 'none', 3000);
}

// ============ TÀI KHOẢN (lưu trong localStorage của trình duyệt) ============
let currentUser = null, lastSavedBal = null;
const LS_ACC = 'sunwin_accounts', LS_CUR = 'sunwin_current';
function loadAccs() { try { return JSON.parse(localStorage.getItem(LS_ACC)) || {}; } catch (e) { return {}; } }
function saveAccs(a) { try { localStorage.setItem(LS_ACC, JSON.stringify(a)); } catch (e) { showNotif('Không lưu được dữ liệu trình duyệt!'); } }
async function hashPw(pw, salt) { // mật khẩu không lưu dạng chữ thường, chỉ lưu bản băm
  const text = salt + ':' + pw;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return 'x' + h;
}
function authMsg(text, ok) { const e = $('authMsg'); e.textContent = text; e.style.color = ok ? '#2ecc71' : '#ff7a6b'; }
function authTab(m) {
  $('loginForm').style.display = m === 'login' ? 'block' : 'none';
  $('regForm').style.display = m === 'register' ? 'block' : 'none';
  $('tabLogin').classList.toggle('on', m === 'login');
  $('tabReg').classList.toggle('on', m === 'register');
  authMsg('');
}
async function doRegister() {
  const u = $('regUser').value.trim().toLowerCase(), p = $('regPass').value, p2 = $('regPass2').value, n = $('regName').value.trim();
  if (!/^[a-z0-9_]{4,20}$/.test(u)) return authMsg('Tên đăng nhập phải 4-20 ký tự, chỉ gồm chữ, số hoặc dấu _');
  if (p.length < 6) return authMsg('Mật khẩu phải có ít nhất 6 ký tự');
  if (p !== p2) return authMsg('Mật khẩu xác minh không khớp');
  if (n.length < 2 || n.length > 16) return authMsg('Tên hiển thị phải từ 2 đến 16 ký tự');
  const accs = loadAccs();
  if (accs[u]) return authMsg('Tên đăng nhập này đã tồn tại');
  const salt = Math.random().toString(36).slice(2);
  accs[u] = { salt, hash: await hashPw(p, salt), display: n, id: randInt(1e8, 9e8 - 1), balance: 100000 };
  saveAccs(accs);
  ['regUser', 'regPass', 'regPass2', 'regName'].forEach(i => $(i).value = '');
  authTab('login');
  $('lgUser').value = u; $('lgPass').value = '';
  authMsg('Đăng ký thành công! Hãy đăng nhập.', true);
}
async function doLogin() {
  const u = $('lgUser').value.trim().toLowerCase(), acc = loadAccs()[u];
  if (!acc || acc.hash !== await hashPw($('lgPass').value, acc.salt)) return authMsg('Sai tên đăng nhập hoặc mật khẩu');
  try { localStorage.setItem(LS_CUR, u); } catch (e) {}
  loginAs(u);
}
function loginAs(u) {
  const acc = loadAccs()[u];
  currentUser = u; gameState.balance = lastSavedBal = acc.balance;
  $('lbName').textContent = acc.display;
  $('lbAvatar').textContent = acc.display[0].toUpperCase();
  $('authScreen').style.display = 'none';
  $('lobby').style.display = 'flex';
  authMsg('');
  renderAll();
}
function saveBalance() {
  const a = loadAccs();
  if (!currentUser || !a[currentUser]) return;
  a[currentUser].balance = gameState.balance; saveAccs(a); lastSavedBal = gameState.balance;
}
function logout() {
  Object.values(gameState.tables).forEach(t => { gameState.balance += t.betAmount; t.betAmount = 0; }); // hoàn cược chưa mở
  saveBalance();
  try { localStorage.removeItem(LS_CUR); } catch (e) {}
  location.reload();
}

// ============ SẢNH + THÔNG TIN USER ============
function goLobby() { $('stage').style.display = 'none'; $('lobby').style.display = 'flex'; renderAll(); }
const GAMES = [
  { name: 'Bầu Cua Tôm Cá', icon: '🦀', cat: 'MINIGAMES' }, { name: 'Mini Poker', icon: '🃏', cat: 'GAME BÀI' },
  { name: 'Tiến Lên Miền Nam', icon: '♠️', cat: 'GAME BÀI' }, { name: 'Thần Tài Slots', icon: '🎰', cat: 'SLOTS' },
  { name: 'Nổ Hũ Mặt Trời', icon: '☀️', cat: 'SLOTS' }, { name: 'Idol Livestream', icon: '🎤', cat: 'LIVESTREAM' }];
let lbTab = 'ALL', jackpot = randInt(5e9, 9e9);
function renderGames() {
  $('hero').style.display = ['ALL', 'MINIGAMES'].includes(lbTab) ? 'flex' : 'none';
  $('gameGrid').innerHTML = GAMES.filter(g => lbTab === 'ALL' || g.cat === lbTab).map(g =>
    `<div class="game-card" onclick="soon()"><div class="gc-icon">${g.icon}</div><div class="gc-name">${g.name}</div><div class="gc-soon">SẮP RA MẮT</div></div>`).join('');
}
function setTab(btn) {
  lbTab = btn.textContent;
  document.querySelectorAll('#lbTabs button').forEach(b => b.classList.toggle('on', b === btn));
  showGames(); renderGames();
}
function openGame() { $('viewGames').style.display = 'none'; $('viewTables').style.display = 'block'; renderSelection(); } // bấm game rồi mới chọn bàn
function showGames() { $('viewTables').style.display = 'none'; $('viewGames').style.display = 'block'; }

// Dữ liệu trang trí cho sảnh (người thắng + hũ thưởng là số giả)
const FEED_NAMES = ['kha', 'minh', 'tuan', 'hoa', 'long', 'nam', 'vy', 'dat'];
const fakeWin = () => ({ n: FEED_NAMES[randInt(0, 7)] + '***' + randInt(10, 99), amt: randInt(2, 500) * 10000 });
let feed = Array.from({ length: 5 }, fakeWin);
let pots = { mini: randInt(2e7, 9e7), minor: randInt(2e8, 9e8), major: randInt(1e9, 3e9) }, lastFeedTop = null;
function tweenNum(el, to, ms = 1200) { // số chạy cuộn mượt tới giá trị mới
  if (!el || el.dataset.v === String(to)) return;
  const from = +el.dataset.v || 0; el.dataset.v = to;
  const t0 = performance.now(); cancelAnimationFrame(el._r);
  const step = t => {
    const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString();
    if (p < 1) el._r = requestAnimationFrame(step);
  };
  el._r = requestAnimationFrame(step);
  el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
}
function renderFeed() {
  const fresh = feed[0] !== lastFeedTop && lastFeedTop !== null; lastFeedTop = feed[0];
  $('feedList').innerHTML = feed.map((f, i) => `<div class="feed-row${fresh && i === 0 ? ' fresh' : ''}${f.amt >= 3e6 ? ' big' : ''}"><span>🏆 ${f.n}</span><b>+${f.amt.toLocaleString()}</b></div>`).join('');
  tweenNum($('jackpot'), jackpot, 1800);
  tweenNum($('jpMini'), pots.mini); tweenNum($('jpMinor'), pots.minor); tweenNum($('jpMajor'), pots.major);
}
setInterval(() => {
  jackpot += randInt(1e3, 5e4); pots.mini += randInt(200, 3e3); pots.minor += randInt(2e3, 2e4); pots.major += randInt(1e4, 9e4);
  if (Math.random() < .4) { feed.unshift(fakeWin()); feed.length = 5; }
  renderFeed();
}, 2500);

// Xúc xắc 3D nhảy múa ở banner
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const faceHTML = (cls, v) => `<div class="f ${cls}${v === 1 ? ' one' : ''}">` +
  Array.from({ length: 9 }, (_, i) => `<i${PIPS[v].includes(i + 1) ? '' : ' class="off"'}></i>`).join('') + '</div>';
(function heroDice() {
  const faces = [['f1', 1], ['f2', 3], ['f3', 6], ['f4', 4], ['f5', 2], ['f6', 5]];
  $('heroArt').innerHTML = ['A', 'B', 'C'].map((k, i) =>
    `<div class="slot" style="--d:${i * .35}s"><div class="shadow"></div><div class="die"><div class="cube cube${k}">${faces.map(([c, v]) => faceHTML(c, v)).join('')}</div></div></div>`).join('');
})();
(function floatDice() { // xúc xắc mờ trôi lên trong nền sảnh
  for (let i = 0; i < 7; i++) {
    const d = document.createElement('span');
    d.className = 'fdice'; d.textContent = '🎲';
    d.style.left = randInt(3, 95) + '%';
    d.style.fontSize = randInt(20, 42) + 'px';
    d.style.animationDuration = randInt(14, 26) + 's';
    d.style.animationDelay = '-' + randInt(0, 26) + 's';
    $('lobby').appendChild(d);
  }
})();
(function sparkles() { // hạt vàng bay lên: chỉ dùng transform/opacity nên mượt
  for (let i = 0; i < 14; i++) {
    const sp = document.createElement('span');
    sp.className = 'spark';
    sp.style.left = randInt(2, 98) + '%';
    sp.style.animationDuration = randInt(7, 14) + 's';
    sp.style.animationDelay = '-' + randInt(0, 14) + 's';
    $('lobby').appendChild(sp);
  }
})();
function topUp() { gameState.balance += 100000; renderAll(); showNotif('Đã nạp 100,000 xu thử nghiệm'); }
function showRules() { showNotif('Tổng 3 xúc xắc từ 11 trở lên: Hà Thành. Từ 4 đến 10: Ngọc Xăm. Thắng nhận gấp đôi tiền cược.'); }
function soon() { showNotif('Tính năng đang được phát triển'); }
function openUser() {
  const acc = loadAccs()[currentUser];
  $('uAvatar').textContent = acc.display[0].toUpperCase();
  $('uName').textContent = acc.display; $('uId').textContent = acc.id; $('uLogin').textContent = currentUser;
  $('uBal').textContent = gameState.balance.toLocaleString();
  $('userModal').style.display = 'flex'; replay($('userModal'));
}
function closeUser() { $('userModal').style.display = 'none'; }

Object.values(gameState.tables).forEach(buildWindow);
renderGames(); renderFeed();
(function autoLogin() { // còn phiên đăng nhập cũ thì vào thẳng sảnh
  let u = null; try { u = localStorage.getItem(LS_CUR); } catch (e) {}
  if (u && loadAccs()[u]) loginAs(u);
})();
