/* audio.js - musik latar halaman login (file mp3, atau musik bawaan jika file tidak ada) dan efek suara klik */
const MUSIC_FILE = "assets/audio/momentum.mp3";
const MUSIK_GAIN = 1.6;   // penguat musik bawaan (sebelumnya 0.6)
const SND = { on: true, vol: 1, ac: null, master: null, mg: null, el: null, timer: null, playing: false, unlocked: false };
try { SND.on = localStorage.getItem("klinik_suara") !== "0"; const v = localStorage.getItem("klinik_vol"); if (v !== null) SND.vol = Math.min(1, Math.max(0, +v)); } catch (e) { }

function ac() {
  if (!SND.ac) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    SND.ac = new C(); SND.master = SND.ac.createGain(); SND.master.gain.value = .9;
    const k = SND.ac.createDynamicsCompressor(); SND.master.connect(k); k.connect(SND.ac.destination); // pembatas agar volume keras tidak pecah
  }
  if (SND.ac.state == "suspended") SND.ac.resume();
  return SND.ac;
}
function tone(f, t, d, type, v, dest) {
  const c = SND.ac, o = c.createOscillator(), g = c.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v || .15, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(dest || SND.master); o.start(t); o.stop(t + d + .02);
}
function kick(t, d) {
  const c = SND.ac, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
  g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
  o.connect(g); g.connect(d); o.start(t); o.stop(t + .2);
}
function hat(t, d, nb) {
  const c = SND.ac, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = nb; f.type = "highpass"; f.frequency.value = 7000; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .05);
  s.connect(f); f.connect(g); g.connect(d); s.start(t); s.stop(t + .06);
}

/* ---------- Efek suara ---------- */
function sfx(n) {
  if (!SND.on) return; const c = ac(); if (!c) return; const t = c.currentTime;
  if (n == "klik") { tone(660, t, .08, "triangle", .16); tone(990, t + .03, .1, "sine", .1); }
  else if (n == "pop") tone(440, t, .06, "sine", .1);
  else if (n == "login") [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * .08, .25, "triangle", .13));
  else if (n == "err") { tone(180, t, .18, "square", .08); tone(140, t + .12, .22, "square", .08); }
  else if (n == "notif") [880, 1175, 880, 1175].forEach((f, i) => tone(f, t + i * .16, .22, "sine", .22));
  else if (n == "burst") [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * .05, .3, "sine", .1));
}

/* ---------- Musik latar ---------- */
function startSynth() { // musik bawaan: progresi C - G - Am - F, 116 BPM
  const c = ac(); if (!c || SND.timer) return;
  const mg = SND.mg = c.createGain(); mg.gain.value = 0; mg.connect(SND.master); mg.gain.linearRampToValueAtTime(MUSIK_GAIN * SND.vol, c.currentTime + 2);
  const nb = c.createBuffer(1, Math.floor(c.sampleRate * .1), c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const CH = [[261.63, 329.63, 392], [196, 246.94, 293.66], [220, 261.63, 329.63], [174.61, 220, 261.63]];
  const MEL = [[659, 784, 1047], [587, 784, 988], [659, 880, 1047], [698, 880, 1047]];
  const ARP = [0, 1, 2, 1, 2, 1, 2, 1], st = 60 / 116 / 2;
  let step = 0, next = c.currentTime + .15;
  const play = (s, t) => {
    const bar = Math.floor(s / 8) % 4, i = s % 8, ch = CH[bar];
    tone(ch[ARP[i]] * 2, t, .35, "triangle", .08, mg);
    if (i == 0) ch.forEach(f => tone(f, t, st * 8, "sine", .05, mg));
    if (i == 0 || i == 4) tone(ch[0] / 2, t, .45, "sine", .18, mg);
    const m = [0, 3, 6].indexOf(i); if (m >= 0) tone(MEL[bar][m], t, .55, "sine", .08, mg);
    if (i % 2 == 0) kick(t, mg); else hat(t, mg, nb);
  };
  SND.timer = setInterval(() => { while (next < c.currentTime + .4) { play(step++, next); next += st; } }, 100);
}
function fade(a, to, ms) {
  const from = a.volume, t0 = performance.now();
  (function s() { const k = Math.min(1, (performance.now() - t0) / (ms || 1500)); a.volume = from + (to - from) * k; if (k < 1) requestAnimationFrame(s); })();
}
function startMusic() {
  if (!SND.on || SND.playing || U) return;
  SND.playing = true; updateNP();
  const a = new Audio(MUSIC_FILE); a.loop = true; a.volume = 0;
  const ke_bawaan = () => { if (SND.playing && !SND.timer) { SND.el = null; startSynth(); updateNP(); } };
  a.addEventListener("error", ke_bawaan, { once: true });
  a.play().then(() => { if (!SND.playing) { a.pause(); return; } SND.el = a; fade(a, SND.vol); updateNP(); })
    .catch(e => { if (e && e.name == "NotAllowedError") { SND.playing = false; updateNP(); } else ke_bawaan(); });
}
function stopMusic() {
  if (!SND.playing) return; SND.playing = false;
  const a = SND.el; if (a) { fade(a, 0, 900); setTimeout(() => a.pause(), 950); SND.el = null; }
  if (SND.timer) { const c = SND.ac, mg = SND.mg; clearInterval(SND.timer); SND.timer = null; mg.gain.cancelScheduledValues(c.currentTime); mg.gain.setValueAtTime(mg.gain.value, c.currentTime); mg.gain.linearRampToValueAtTime(0, c.currentTime + .9); setTimeout(() => mg.disconnect(), 1000); }
  updateNP();
}
function setVol(v) {
  SND.vol = Math.min(1, Math.max(0, v)); try { localStorage.setItem("klinik_vol", SND.vol); } catch (e) { }
  if (SND.el) SND.el.volume = SND.vol;
  if (SND.mg && SND.ac) SND.mg.gain.setTargetAtTime(MUSIK_GAIN * SND.vol, SND.ac.currentTime, .05);
}
function toggleSuara() {
  SND.on = !SND.on; try { localStorage.setItem("klinik_suara", SND.on ? "1" : "0"); } catch (e) { }
  if (!SND.on) stopMusic(); else { sfx("klik"); if (!U) startMusic(); }
  updateNP();
}
function updateNP() {
  const b = $("snd"); if (b) b.textContent = SND.on ? "🔊" : "🔇";
  const np = $("np"); if (!np) return;
  if ($("vol")) $("vol").value = Math.round(SND.vol * 100);
  np.classList.toggle("on", SND.playing && (!!SND.el || !!SND.timer));
  $("npt").textContent = !SND.on ? "Suara mati. Klik untuk menyalakan" : SND.el ? "Momentum - Uplifting Motivational Corporate" : SND.timer ? "Musik latar (versi bawaan)" : "Sentuh layar untuk memutar musik";
}
function initSuara() {
  const b = document.createElement("button"); b.id = "snd"; b.className = "snd"; b.setAttribute("aria-label", "Nyalakan atau matikan suara"); b.onclick = toggleSuara; document.body.appendChild(b);
  const gesture = () => { SND.unlocked = true; if (!U) startMusic(); }; // browser baru mengizinkan suara setelah sentuhan pertama
  document.addEventListener("pointerdown", gesture); document.addEventListener("keydown", gesture);
  document.addEventListener("click", e => { const t = e.target.closest("button"); if (t && t.id != "snd") sfx(t.classList.contains("nv") ? "klik" : "pop"); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (SND.el) SND.el.pause(); if (SND.ac) SND.ac.suspend(); }
    else if (SND.playing) { if (SND.el) SND.el.play().catch(() => { }); if (SND.ac) SND.ac.resume(); }
  });
  updateNP();
}
