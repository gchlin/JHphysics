(function () {
  'use strict';

  const config = window.CHAPTER3_CONFIG || {};
  const scene = { width: 960, height: 540 };
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const wrap = document.querySelector('.canvas-wrap');
  const playButton = document.getElementById('playButton');
  const resetButton = document.getElementById('resetButton');
  const speedSelect = document.getElementById('speedSelect');
  const massAInput = document.getElementById('massAInput');
  const massBInput = document.getElementById('massBInput');
  const simStatus = document.getElementById('simStatus');
  const formulaBox = document.getElementById('formulaBox');
  const resultList = document.getElementById('resultList');
  const tipText = document.getElementById('tipText');
  const colors = { ink: '#263746', muted: '#607080', red: '#d95745', blue: '#2563eb', teal: '#0e8791', orange: '#ee8b2f', gold: '#f2bd4b', green: '#4d9a72', pale: '#fff8ea' };
  const state = { time: 0, playing: false, raf: 0, last: 0, speed: 1, massA: 6, massB: 4 };
  const ex4Model = { g: 10, startY: 350, maxDisplacement: 1.8, pixelsPerMeter: 42 };
  let scale = 1;

  document.title = `${config.title || '牛頓第二運動定律'}｜JHphysics`;
  document.getElementById('exampleLabel').textContent = `範例 ${config.number}`;
  document.getElementById('pageTitle').textContent = config.title;
  document.getElementById('pageSubtitle').textContent = config.subtitle;
  if (formulaBox) formulaBox.innerHTML = config.formula || '';
  if (resultList) resultList.innerHTML = (config.results || []).map(item => `<li>${item}</li>`).join('');
  if (tipText) tipText.textContent = config.tip || '';
  if (massAInput) massAInput.value = state.massA;
  if (massBInput) massBInput.value = state.massB;

  function resizeCanvas() {
    const width = Math.max(1, wrap.clientWidth - 12);
    const height = Math.max(1, wrap.clientHeight - 12);
    scale = Math.min(width / scene.width, height / scene.height);
    const cssWidth = scene.width * scale;
    const cssHeight = scene.height * scale;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  }

  function clear() {
    ctx.clearRect(0, 0, scene.width, scene.height);
    ctx.fillStyle = colors.pale;
    ctx.fillRect(0, 0, scene.width, scene.height);
  }
  function text(value, x, y, size = 20, color = colors.ink, align = 'left', weight = '400') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px "Microsoft JhengHei", "PingFang TC", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const lines = String(value).split('\n');
    const lineHeight = size * 1.12;
    lines.forEach((item, index) => ctx.fillText(item, x, y + (index - (lines.length - 1) / 2) * lineHeight));
    ctx.restore();
  }
  function line(x1, y1, x2, y2, color = colors.ink, width = 3, dash = []) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }
  function arrow(x1, y1, x2, y2, color = colors.red, width = 4, label = '', labelDx = 0, labelDy = 0) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 11;
    line(x1, y1, x2, y2, color, width);
    line(x2, y2, x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6), color, width);
    line(x2, y2, x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6), color, width);
    if (label) text(label, (x1 + x2) / 2 + labelDx, (y1 + y2) / 2 + labelDy, 18, color, 'center', '700');
  }
  function roundedRect(x, y, w, h, r, fill, stroke = colors.ink, width = 2) {
    ctx.save();
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = width;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function block(x, y, w, h, label, fill = '#e9a445', angle = 0) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    roundedRect(-w / 2, -h / 2, w, h, 8, fill, '#b86627', 3);
    text(label, 0, 0, Math.min(24, w * .28), '#5d321e', 'center', '800');
    ctx.restore();
  }
  function floor(y, left = 0, right = scene.width) {
    ctx.fillStyle = '#b9c9d2'; ctx.fillRect(left, y, right - left, scene.height - y);
    line(left, y, right, y, '#607a88', 4);
  }
  function pulley(x, y, r = 34) {
    ctx.save();
    ctx.fillStyle = '#526273'; ctx.strokeStyle = '#263746'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c7d0d5'; ctx.beginPath(); ctx.arc(x, y, r * .58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#536270'; ctx.beginPath(); ctx.arc(x, y, r * .16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function labelPill(value, x, y, fill = '#fff', stroke = '#e3b39e') {
    ctx.save();
    ctx.font = '700 16px "Microsoft JhengHei", sans-serif';
    const w = ctx.measureText(value).width + 20;
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y - 15, w, 30, 15); ctx.fill(); ctx.stroke();
    text(value, x + w / 2, y, 16, colors.ink, 'center', '700');
    ctx.restore();
  }

  function readIntegerInput(input, fallback) {
    const value = Number(input && input.value);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(20, Math.max(1, Math.round(value)));
  }

  function ex4Acceleration() {
    const totalMass = state.massA + state.massB;
    if (totalMass <= 0) return 0;
    return Math.abs(state.massA - state.massB) * ex4Model.g / totalMass;
  }

  function ex4Duration() {
    const acceleration = ex4Acceleration();
    if (acceleration <= 0) return 0;
    return Math.sqrt((2 * ex4Model.maxDisplacement) / acceleration);
  }

  function updateEx4Status() {
    if (!simStatus || config.number !== 4) return;
    if (state.massA === state.massB) {
      simStatus.textContent = `A = ${state.massA} kg、B = ${state.massB} kg：兩側平衡，保持靜止`;
      return;
    }
    const heavier = state.massA > state.massB ? 'A' : 'B';
    const down = state.massA > state.massB ? 'A' : 'B';
    const up = down === 'A' ? 'B' : 'A';
    simStatus.textContent = `A = ${state.massA} kg、B = ${state.massB} kg：${heavier} 較重，${down} 下落、${up} 上升`;
  }

  function applyEx4Masses() {
    if (!massAInput || !massBInput) return;
    state.massA = readIntegerInput(massAInput, state.massA);
    state.massB = readIntegerInput(massBInput, state.massB);
    massAInput.value = state.massA;
    massBInput.value = state.massB;
    state.time = 0;
    setPlaying(false);
    updateEx4Status();
    draw();
  }

  function drawEx1() {
    clear();
    const loop = (state.time % 5.2) / 5.2;
    const y = 175 + 245 * loop;
    ctx.fillStyle = '#d6dde3'; ctx.fillRect(610, 86, 245, 330);
    ctx.fillStyle = '#f0f5f8'; ctx.fillRect(634, 110, 196, 282);
    line(634, 110, 634, 392, '#9aa8b2', 4); line(830, 110, 830, 392, '#9aa8b2', 4);
    line(730, 110, 730, y - 15, '#725a43', 5);
    ctx.fillStyle = '#3e73a4'; ctx.beginPath(); ctx.arc(730, y - 30, 16, 0, Math.PI * 2); ctx.fill();
    roundedRect(700, y - 12, 60, 84, 17, '#4ca59e', '#2e706f', 3);
    line(710, y + 70, 695, y + 115, '#334155', 8); line(750, y + 70, 765, y + 115, '#334155', 8);
    line(700, y + 5, 677, y + 45, '#334155', 8); line(760, y + 5, 783, y + 45, '#334155', 8);
    arrow(810, y + 10, 810, y + 122, colors.blue, 5, 'mg = 500 N', 52, 0);
    arrow(672, y + 35, 672, y - 80, colors.red, 5, 'T ≤ 400 N', -50, 0);
    text('下降逃生：張力上限 40 kgw', 36, 54, 22, colors.ink, 'left', '800');
    labelPill('m = 50 kg', 36, 102, '#fff', '#cbd5e1');
    labelPill('g = 10 m/s²', 155, 102, '#fff', '#cbd5e1');
    text('最小安全加速度', 44, 410, 19, colors.muted, 'left', '700');
    text('a = g − T / m = 2 m/s²', 44, 446, 25, colors.red, 'left', '800');
    text('向下', 872, 250, 16, colors.blue, 'center', '700');
  }

  function drawEx2() {
    clear();
    const travel = 90 + ((state.time * .22) % 1) * 680;
    floor(405, 65, 895);
    block(travel, 365, 112, 72, '40 kg', '#c98140');
    const cx = travel + 10, cy = 342;
    arrow(cx + 5, cy, cx + 130, cy - 98, colors.red, 5, 'F = 200 N', 18, -6);
    arrow(cx + 12, cy - 8, cx + 115, cy - 8, colors.red, 3, '160 N', 0, -18);
    arrow(cx + 115, cy - 8, cx + 115, cy - 90, colors.red, 3, '120 N', 48, 0);
    arrow(travel + 20, 330, travel + 20, 248, colors.blue, 4, 'N = 280 N', -47, 0);
    arrow(travel + 20, 402, travel + 20, 470, colors.blue, 4, 'mg = 400 N', -48, 0);
    text('37°', cx + 48, cy - 30, 22, colors.ink, 'center', '800');
    text('水平分力使木塊加速', 42, 56, 22, colors.ink, 'left', '800');
    labelPill('a = 160 / 40 = 4 m/s²', 42, 108, '#fff', '#9ed1d1');
    labelPill('N = 400 − 120 = 280 N', 42, 150, '#fff', '#9ed1d1');
  }

  function drawEx3() {
    clear();
    const theta = 37 * Math.PI / 180;
    const cartX = 120 + ((state.time * .16) % 1) * 650;
    floor(408, 40, 920);
    roundedRect(cartX, 242, 330, 145, 10, '#d7e3ea', '#80909e', 4);
    ctx.fillStyle = '#344454';
    ctx.beginPath(); ctx.arc(cartX + 85, 405, 26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cartX + 265, 405, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8b5be'; ctx.beginPath(); ctx.arc(cartX + 85, 405, 11, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cartX + 265, 405, 11, 0, Math.PI * 2); ctx.fill();
    const pivotX = cartX + 165, pivotY = 270, L = 125;
    const bobX = pivotX - L * Math.sin(theta), bobY = pivotY + L * Math.cos(theta);
    line(pivotX, pivotY, bobX, bobY, '#303f4a', 4);
    ctx.fillStyle = '#3789d4'; ctx.beginPath(); ctx.arc(bobX, bobY, 19, 0, Math.PI * 2); ctx.fill();
    arrow(cartX + 165, 215, cartX + 255, 215, colors.teal, 5, 'a', 0, -18);
    arrow(bobX, bobY, pivotX, pivotY, colors.red, 4, 'T', -22, -8);
    arrow(bobX, bobY, bobX, bobY + 82, colors.blue, 4, 'mg', 35, 0);
    text('θ', pivotX - 16, pivotY + 35, 22, colors.ink, 'center', '800');
    text('車向右等加速度，擺錘向後傾', 40, 52, 22, colors.ink, 'left', '800');
    labelPill('θ = 37°', 42, 102, '#fff', '#cbd5e1');
    labelPill('a = g tan θ ≈ 7.54 m/s²', 152, 102, '#fff', '#9ed1d1');
    labelPill('T / m = √(g² + a²) ≈ 12.5 m/s²', 42, 145, '#fff', '#f0c1a8');
  }

  function drawEx4() {
    clear();
    const pulleyX = 480, pulleyY = 140, pulleyR = 46;
    const leftX = pulleyX - pulleyR, rightX = pulleyX + pulleyR;
    const blockW = 86, blockH = 62;
    const rope = '#303f4a';
    const direction = Math.sign(state.massA - state.massB);
    const displacement = direction * Math.min(
      ex4Model.maxDisplacement,
      0.5 * ex4Acceleration() * state.time * state.time,
    ) * ex4Model.pixelsPerMeter;
    const ay = ex4Model.startY + displacement;
    const by = ex4Model.startY - displacement;

    // 參考圖中的固定支架、直桿與中央定滑輪。
    ctx.fillStyle = '#c2cbd1';
    ctx.fillRect(pulleyX - 155, 34, 310, 18);
    line(pulleyX, 52, pulleyX, 92, '#526273', 7);
    pulley(pulleyX, pulleyY, pulleyR);

    // 同一條不可伸長細繩：兩側位移大小相等、方向相反。
    line(leftX, pulleyY, leftX, ay - blockH / 2, rope, 4);
    line(rightX, pulleyY, rightX, by - blockH / 2, rope, 4);
    ctx.save();
    ctx.strokeStyle = rope;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pulleyX, pulleyY, pulleyR + 2, Math.PI, 0);
    ctx.stroke();
    ctx.restore();

    block(leftX, ay, blockW, blockH, `A\n${state.massA} kg`, '#e49a42');
    block(rightX, by, blockW, blockH, `B\n${state.massB} kg`, '#e49a42');

    // 只保留參考圖中的必要向量：兩端張力與支點支持力。
    arrow(leftX, ay - blockH / 2 - 2, leftX, ay - blockH / 2 - 46, colors.green, 4, 'T', -23, 0);
    arrow(rightX, by - blockH / 2 - 2, rightX, by - blockH / 2 - 46, colors.green, 4, 'T', 23, 0);
    arrow(pulleyX, pulleyY - pulleyR - 2, pulleyX, pulleyY - pulleyR - 72, colors.blue, 4, 'F', 25, 0);
  }

  function drawEx5() {
    clear();
    const top = { x: 520, y: 115 }, left = { x: 205, y: 425 }, right = { x: 835, y: 425 };
    ctx.fillStyle = '#b4dcd4'; ctx.strokeStyle = '#6e9f99'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    line(left.x, left.y, right.x, right.y, '#61747c', 4);
    pulley(top.x, top.y, 25);
    const travel = Math.sin(state.time * .8) * 42;
    const p1 = { x: 392 - travel * .707, y: 245 + travel * .707 };
    const p2 = { x: 648 + travel * .707, y: 245 + travel * .707 };
    line(top.x, top.y, p1.x + 45, p1.y - 16, '#303f4a', 3); line(top.x, top.y, p2.x - 45, p2.y - 16, '#303f4a', 3);
    block(p1.x, p1.y, 72, 58, 'm₁\n3 kg', '#f39a27', -Math.PI / 4);
    block(p2.x, p2.y, 72, 58, 'm₂\n4 kg', '#f39a27', Math.PI / 4);
    arrow(p1.x - 12, p1.y + 22, p1.x - 68, p1.y + 78, colors.blue, 4, '18 N', -13, 0);
    arrow(p2.x + 12, p2.y + 22, p2.x + 68, p2.y + 78, colors.red, 4, '32 N', 13, 0);
    text('37°', 258, 391, 19, colors.ink, 'center', '800'); text('53°', 780, 391, 19, colors.ink, 'center', '800');
    text('兩斜面光滑，m₂ 的下滑分力較大', 38, 48, 22, colors.ink, 'left', '800');
    labelPill('m₁g sin37° = 18 N', 38, 96, '#fff', '#9ed1d1');
    labelPill('m₂g sin53° = 32 N', 38, 138, '#fff', '#f0c1a8');
    labelPill('a = 2 m/s²　　T = 24 N', 38, 180, '#fff', '#d7c28e');
  }

  function drawEx6() {
    clear();
    const travel = 100 + ((state.time * .17) % 1) * 680;
    floor(405, 40, 920);
    block(travel, 365, 112, 78, 'A\n2 kg', '#efb13f');
    block(travel + 120, 350, 150, 108, 'B\n3 kg', '#e9a52f');
    block(travel + 272, 374, 82, 56, 'C\n1 kg', '#efb13f');
    arrow(travel - 100, 365, travel - 18, 365, colors.red, 5, '10 N', 0, -22);
    arrow(travel + 350, 374, travel + 280, 374, colors.blue, 5, '4 N', 0, -22);
    arrow(travel + 196, 255, travel + 258, 255, colors.teal, 5, 'a = 1 m/s²', 0, -20);
    arrow(travel + 313, 374, travel + 356, 374, colors.red, 3, 'FBC = 5 N', 0, 23);
    text('三物體連結，一起向右等加速度運動', 38, 54, 22, colors.ink, 'left', '800');
    labelPill('ΣF = 10 − 4 = 6 N', 38, 105, '#fff', '#f0c1a8');
    labelPill('a = 6 / (2+3+1) = 1 m/s²', 38, 147, '#fff', '#9ed1d1');
    labelPill('B：F合 = 3 N　　BC：5 N', 38, 189, '#fff', '#d7c28e');
  }

  function drawEx7() {
    clear();
    const travel = 95 + ((state.time * .15) % 1) * 600;
    floor(448, 0, 960);
    const baseX = travel, baseY = 430;
    ctx.fillStyle = '#b4dcd4'; ctx.strokeStyle = '#6e9f99'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(baseX + 300, baseY); ctx.lineTo(baseX + 300, 145); ctx.closePath(); ctx.fill(); ctx.stroke();
    const bx = baseX + 204, by = 264;
    block(bx, by, 78, 56, 'm\n6 kg', '#f39a27', Math.PI / 4);
    arrow(baseX + 130, 385, baseX + 215, 385, colors.red, 5, 'F = 200 N', 0, -22);
    arrow(bx, by, bx - 63, by - 63, colors.teal, 4, 'N = 60√2 N', -23, -3);
    arrow(bx, by, bx, by + 85, colors.blue, 4, 'mg', 32, 0);
    text('斜面與木塊相對靜止，一起向右加速', 38, 52, 22, colors.ink, 'left', '800');
    labelPill('a = g tan45° = 10 m/s²', 38, 101, '#fff', '#9ed1d1');
    labelPill('N = 60√2 N　　F = (14+6)a = 200 N', 38, 143, '#fff', '#f0c1a8');
  }

  function drawEx8() {
    clear();
    const disp = ((state.time * .2) % 1) * 100;
    floor(396, 50, 600);
    ctx.fillStyle = '#c2cbd1'; ctx.fillRect(150, 110, 130, 18);
    line(205, 128, 205, 165, '#526273', 5);
    const fixedX = 530, fixedY = 205, movableX = 650, movableY = 300 + disp / 2;
    pulley(fixedX, fixedY, 30); pulley(movableX, movableY, 35);
    const ax = 180 + disp;
    block(ax, 350, 90, 62, 'A\nm', '#e9a52f');
    block(movableX, movableY + 82, 90, 62, 'B\n2m', '#e9a52f');
    line(ax + 45, 350, fixedX - 30, 350, '#303f4a', 4);
    line(fixedX - 30, 350, fixedX - 30, fixedY, '#303f4a', 4);
    line(fixedX + 30, fixedY, movableX - 35, fixedY, '#303f4a', 4);
    line(movableX - 35, fixedY, movableX - 35, movableY, '#303f4a', 4);
    line(movableX + 35, movableY, movableX + 35, 105, '#303f4a', 4);
    line(movableX + 35, 105, 760, 105, '#303f4a', 4);
    arrow(ax + 25, 305, ax + 105, 305, colors.teal, 4, 'a₁', 0, -18);
    arrow(movableX + 72, movableY + 48, movableX + 72, movableY + 125, colors.red, 4, 'a₂', 28, 0);
    arrow(fixedX + 10, fixedY, fixedX + 10, fixedY - 58, colors.teal, 3, 'T₁', 28, 0);
    arrow(movableX - 18, movableY - 8, movableX - 18, movableY - 58, colors.teal, 3, 'T₁', -28, 0);
    arrow(movableX, movableY + 35, movableX, movableY + 98, colors.red, 3, 'T₂', 28, 0);
    text('動滑輪的位移約束：A 走 x，B 走 x/2', 38, 52, 22, colors.ink, 'left', '800');
    labelPill('a₁ = 2a₂ = 2g/3', 38, 101, '#fff', '#9ed1d1');
    labelPill('a₂ = g/3　　T₁ = 2mg/3　　T₂ = 4mg/3', 38, 143, '#fff', '#f0c1a8');
  }

  function draw() {
    if (config.number === 1) drawEx1();
    else if (config.number === 2) drawEx2();
    else if (config.number === 3) drawEx3();
    else if (config.number === 4) drawEx4();
    else if (config.number === 5) drawEx5();
    else if (config.number === 6) drawEx6();
    else if (config.number === 7) drawEx7();
    else if (config.number === 8) drawEx8();
  }
  function frame(now) {
    if (!state.playing) return;
    const delta = Math.min(.05, (now - state.last) / 1000 || 0);
    state.last = now;
    if (config.number === 4) {
      const duration = ex4Duration();
      if (duration <= 0) {
        state.time = 0;
        draw();
        setPlaying(false);
        return;
      }
      state.time = Math.min(duration, state.time + delta * state.speed);
    } else {
      state.time += delta * state.speed;
    }
    draw();
    if (config.number === 4 && state.time >= ex4Duration()) {
      setPlaying(false);
      return;
    }
    state.raf = requestAnimationFrame(frame);
  }
  function setPlaying(playing) {
    if (playing && config.number === 4 && ex4Duration() <= 0) playing = false;
    state.playing = playing;
    playButton.textContent = playing ? 'Ⅱ 暫停' : '▶ 播放';
    playButton.setAttribute('aria-label', playing ? '暫停動畫' : '播放動畫');
    playButton.classList.toggle('primary', !playing);
    if (playing) { state.last = performance.now(); cancelAnimationFrame(state.raf); state.raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(state.raf);
  }
  playButton.addEventListener('click', () => setPlaying(!state.playing));
  resetButton.addEventListener('click', () => { state.time = 0; setPlaying(false); draw(); });
  speedSelect.addEventListener('change', () => { state.speed = Number(speedSelect.value); });
  if (massAInput) massAInput.addEventListener('change', applyEx4Masses);
  if (massBInput) massBInput.addEventListener('change', applyEx4Masses);
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resizeCanvas) : null;
  if (resizeObserver) resizeObserver.observe(wrap);
  window.addEventListener('resize', resizeCanvas);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas);
  updateEx4Status();
  resizeCanvas();
})();
