/* app.js - logo, login interaktif, menu per role, router, dan pembaruan otomatis */
const logo = n => `<svg width="${n}" height="${n}" viewBox="0 0 64 64" aria-label="Logo Klinik Sehat"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0b6fa8"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)"/><path d="M26 12h12v14h14v12H38v14H26V38H12V26h14z" fill="#fff"/><path d="M6 35h14l4-10 7 18 5-13 3 5h19" fill="none" stroke="#0c2a31" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LOGO_IMG = "assets/himatif.png";
let U = null, P = "", CART = [], SEL = null, LR = "Admin", TM = null;
const PG = {}, LIVE = {}, LIVE2 = {};
const ROLES = {
  Admin: { ic: "🛡️", d: "Kelola pasien, dokter, obat, kasir, dan laporan klinik." },
  Dokter: { ic: "🩺", d: "Panggil pasien, isi rekam medis, dan tulis resep." },
  Pasien: { ic: "🧑", d: "Ambil nomor antrian atau janji temu, dan pantau posisi antrian Anda." },
  Kasir: { ic: "💳", d: "Terima pembayaran, cetak struk, dan unduh kuitansi PDF." },
  Apoteker: { ic: "💊", d: "Siapkan dan serahkan resep, kelola stok dan kedaluwarsa obat." }
};
const MENU = {
  Admin: [["dash", "🏠", "Dashboard"], ["pasien", "👥", "Data Pasien"], ["dokter", "🩺", "Data Dokter"], ["staf", "🧑‍💼", "Akun Staf"], ["antri", "🎫", "Antrian"], ["resep", "📦", "Resep Obat"], ["obat", "💊", "Stok Obat"], ["bayar", "💳", "Kasir"], ["laporan", "📊", "Laporan"], ["audit", "🧾", "Jejak Audit"], ["tv", "📺", "Layar TV"], ["set", "⚙️", "Pengaturan"]],
  Dokter: [["dash", "🏠", "Dashboard"], ["rekam", "📋", "Rekam Medis"], ["set", "⚙️", "Pengaturan"]],
  Pasien: [["daftar", "🎫", "Berobat dan Riwayat"], ["profil", "👤", "Profil Saya"], ["set", "⚙️", "Pengaturan"]],
  Kasir: [["bayar", "💳", "Kasir"], ["antri", "🎫", "Antrian"], ["set", "⚙️", "Pengaturan"]],
  Apoteker: [["resep", "📦", "Resep Obat"], ["obat", "💊", "Stok Obat"], ["set", "⚙️", "Pengaturan"]]
};

async function init() {
  try { const t = localStorage.getItem("klinik_tema"); if (t) document.documentElement.dataset.theme = t; LR = localStorage.getItem("klinik_role") || LR; } catch (e) { }
  await mulai(); render(); initSuara();
  document.addEventListener("keydown", e => { if (e.key == "Escape") closeModal(); });
  $("m").addEventListener("click", e => { if (e.target.id == "m") closeModal(); });
  (async function poll() { // ambil data terbaru dari server: pasien tiap 5 detik, peran lain tiap 8 detik
    await new Promise(r => setTimeout(r, U && U.role == "Pasien" ? 5000 : 8000));
    if (U && !document.hidden && $("m").style.display != "flex") {
      try { await muat(); refresh(); if (U && U.role == "Pasien") notifPasien(); } catch (e) { if (e.kode == "LOGIN") { U = null; render(); } }
    }
    poll();
  })();
}
function refresh() { if (!U) return; if ($("live") && LIVE[P]) $("live").innerHTML = LIVE[P](); if ($("live2") && LIVE2[P]) $("live2").innerHTML = LIVE2[P](); }

function render() {
  if (!U) return loginView();
  clearInterval(TM);
  const m = MENU[U.role], cur = m.find(x => x[0] == P) || m[0];
  $("app").innerHTML = `<div class="shell"><aside class="side"><div class="brand">${logo(34)}<span>Klinik Sehat<small>Prodi Teknologi Informasi</small></span></div>
    ${m.map(x => `<button class="nv ${x[0] == P ? "on" : ""}" onclick="go('${x[0]}')">${x[1]} ${x[2]}</button>`).join("")}
    <div class="me"><div>${esc(U.nama)}<br><small>${U.role}</small></div><button class="b2" style="color:#fff;border-color:#fff" onclick="logout()">Keluar</button></div></aside>
    <main class="main"><div class="top"><h2>${cur[2]}</h2><span class="mu">${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div>${U.role == "Pasien" && D.p[0] && !D.p[0].privasi ? PG.privasi() : PG[cur[0]]()}</main></div>`;
}
function go(p) { if (p == "tv") { window.open("tv.html", "_blank"); return; } P = p; render(); window.scrollTo(0, 0); }
async function logout() {
  try { await api("auth?do=logout", {}); } catch (e) { }
  U = null; P = ""; SEL = null; CART = []; D = { p: [], d: [], o: [], a: [], r: [], b: [], npas: 0 };
  await mulai(); render();
}

/* ---------- Login ---------- */
function loginView() {
  const duty = PUB.d.filter(d => d.hari.includes(new Date().getDay()));
  const aktif = PUB.aktif;
  $("app").innerHTML = `<div class="login"><div class="l"><canvas id="pt" class="pt"></canvas><div class="logo3d" title="Seret atau klik untuk memutar logo"><div class="glow"></div><div class="ow bk2">${ORB}</div><div class="float"><div class="spinw"><div id="coin">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<i style="transform:translateZ(-${n}px);background:hsl(0 0% ${80 - n * 5}%)"></i>`).join("")}<img class="fc" src="${LOGO_IMG}" alt="Logo HIMATIF Universitas PGRI Silampari" draggable="false"><img class="bk" src="${LOGO_IMG}" alt="" draggable="false"><span class="shine"></span></div></div></div><div class="ow fr">${ORB}</div><div class="sh"></div></div><h1>Klinik Sehat</h1><div class="prodi">Prodi Teknologi Informasi</div>
  <p id="rd"></p>
  <div class="clockw" id="cw" onclick="togJam()" title="Klik untuk ganti format 12/24 jam">${CLOCK}<div><div id="clk" class="dgs"></div><small id="tgl"></small><small class="hint">Klik jam untuk ganti format</small></div></div>
  <small class="dl">Dokter bertugas hari ini</small>
  <div class="chips">${duty.length ? duty.map((d, i) => `<span class="chip" style="animation-delay:${i * .12}s">${esc(d.nama)}<small>${esc(d.sp)}</small></span>`).join("") : `<span class="chip">Tidak ada jadwal praktik hari ini</span>`}</div>
  <div class="lv"><div><b>${aktif}</b><small>antrian aktif</small></div><div><b>${PUB.pasien}</b><small>pasien terdaftar</small></div></div>
  <div class="np" id="np" onclick="toggleSuara()" title="Klik untuk menyalakan atau mematikan suara"><span class="eq"><i></i><i></i><i></i></span><span id="npt"></span><input type="range" id="vol" min="0" max="100" value="100" oninput="setVol(this.value/100)" onclick="event.stopPropagation()" aria-label="Volume musik"></div>
  <svg class="ecg" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,30 90,30 110,30 125,6 145,54 160,30 400,30"/></svg></div>
  <div class="r" id="fr"><small class="mu" id="sal"></small><h2>Masuk ke Klinik Sehat</h2><label>Masuk sebagai</label>
  <div class="roles">${Object.keys(ROLES).map(r => `<button class="role" id="rl-${r}" onclick="pilihRole('${r}')"><span>${ROLES[r].ic}</span>${r}</button>`).join("")}</div>
  <div id="fa"><label>Akun</label><select id="akun"></select></div>
  <div id="fn"><label>NIK</label><input id="nikl" inputmode="numeric" maxlength="16" placeholder="16 digit NIK" onkeydown="if(event.key=='Enter')login()"></div>
  <label>Password</label><div class="pw"><input id="pw" type="password" onkeydown="if(event.key=='Enter')login()"><button type="button" class="eye" onclick="togPw(this)">Lihat</button></div>
  <button class="b big" id="btn" onclick="login()">Masuk</button><div id="err" class="err"></div><div id="dp"></div><p class="mu" style="margin-top:16px;font-size:12px">Dikembangkan oleh Indra Wahyudi dan Tim TI Tahun 2026. <a href="#tentang" onclick="tampilTentang();return false" style="color:var(--teal)">Tentang dan tim pengelola</a></p></div></div>`;
  pilihRole(ROLES[LR] ? LR : "Admin");
  tick(); clearInterval(TM); TM = setInterval(tick, 1000);
  logo3D();
  updateNP(); if (SND.unlocked) startMusic();
}
/* ---------- Login: logo 3D, orbit, partikel, dan jam interaktif ---------- */
const ORB = `<div class="orb"><div class="ring"><i style="top:-5px;left:calc(50% - 5px)"></i><i style="right:-5px;top:calc(50% - 5px)"></i><i style="left:14%;bottom:7%"></i></div></div>`;
const CLOCK = (() => {
  const t = Array.from({ length: 60 }, (_, i) => { const a = i * Math.PI / 30, m = i % 5 == 0, r = m ? 37 : 42; return `<line x1="${50 + r * Math.sin(a)}" y1="${50 - r * Math.cos(a)}" x2="${50 + 46 * Math.sin(a)}" y2="${50 - 46 * Math.cos(a)}" stroke-width="${m ? 2 : 1}"/>`; }).join("");
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="face" cx="50" cy="50" r="48"/>${t}<line id="hh" x1="50" y1="50" x2="50" y2="29" stroke-width="3.5"/><line id="hm" x1="50" y1="50" x2="50" y2="17" stroke-width="2.5"/><line id="hs" x1="50" y1="58" x2="50" y2="11"/><circle cx="50" cy="50" r="3" fill="#fff"/></svg>`;
})();
let L3 = 0, JAM12 = false, CT = "";

function hands(smooth) {
  if (!$("hs")) return;
  const n = new Date(), s = n.getSeconds() + (smooth ? n.getMilliseconds() / 1000 : 0), m = n.getMinutes() + s / 60, h = n.getHours() % 12 + m / 60;
  $("hs").setAttribute("transform", `rotate(${s * 6} 50 50)`); $("hm").setAttribute("transform", `rotate(${m * 6} 50 50)`); $("hh").setAttribute("transform", `rotate(${h * 30} 50 50)`);
}
function togJam() { JAM12 = !JAM12; CT = ""; tick(); toast(JAM12 ? "Format 12 jam" : "Format 24 jam"); }
function tick() {
  const box = $("clk"); if (!box) return;
  const n = new Date(), t = n.toLocaleTimeString("id-ID", { hour12: JAM12, hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":");
  if (CT.length != t.length) { box.innerHTML = [...t].map(c => `<span class="dg${/\d/.test(c) ? "" : " sep"}"></span>`).join(""); CT = " ".repeat(t.length); }
  [...t].forEach((c, i) => { if (c != CT[i]) { const e = box.children[i]; e.textContent = c; if (/\d/.test(c)) { e.classList.remove("fl"); void e.offsetWidth; e.classList.add("fl"); } } });
  CT = t;
  $("tgl").textContent = n.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const h = n.getHours(); if ($("sal")) $("sal").textContent = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  hands(false);
}

function logo3D() {
  const c = $("coin"), panel = document.querySelector(".login .l"), cv = $("pt"), box = document.querySelector(".logo3d"), cw = $("cw"), id = ++L3;
  if (!c || !panel || !cv || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let rx = 0, ry = 0, ay = 0, tx = 0, ty = 0, vy = 0, drag = false, lx = 0, moved = 0, mx = -999, my = -999, W = 0, H = 0;
  const ctx = cv.getContext("2d"), dpr = window.devicePixelRatio || 1;
  const size = () => { const r = panel.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); window.addEventListener("resize", () => { if (id == L3) size(); });
  const ps = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 3 + Math.random() * 7, v: .15 + Math.random() * .4, plus: Math.random() < .55, a: .15 + Math.random() * .3, vx: 0 }));

  function burst() { // percikan dan riak saat logo diklik
    sfx("burst"); const r = document.createElement("span"); r.className = "rp"; box.appendChild(r); setTimeout(() => r.remove(), 900);
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("span"), a = Math.PI * 2 * i / 16, d = 90 + Math.random() * 60;
      s.className = "sp"; s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d + "px"); box.appendChild(s); setTimeout(() => s.remove(), 850);
    }
  }
  panel.addEventListener("pointermove", e => { const r = panel.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; if (!drag) { ty = (mx / r.width - .5) * 56; tx = -(my / r.height - .5) * 44; } });
  panel.addEventListener("pointerleave", () => { mx = my = -999; tx = ty = 0; });
  box.addEventListener("pointerdown", e => { drag = true; lx = e.clientX; moved = 0; try { box.setPointerCapture(e.pointerId); } catch (x) { } });
  box.addEventListener("pointermove", e => { if (!drag) return; const d = e.clientX - lx; lx = e.clientX; moved += Math.abs(d); ry += d * .8; vy = d * .8; });
  box.addEventListener("pointerup", () => { if (!drag) return; drag = false; if (moved < 5) { vy = 30; burst(); } }); // ketuk = putar dengan momentum
  box.addEventListener("pointercancel", () => { drag = false; });

  (function loop() {
    if (id != L3 || !$("coin")) return;
    rx += (tx - rx) * .08; ay += (ty - ay) * .08;
    if (!drag) { if (Math.abs(vy) > .4) { ry += vy; vy *= .965; } else { vy = 0; ry += (Math.round(ry / 360) * 360 + ty - ry) * .08; } }
    c.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    const a = ((ry % 360) + 540) % 360 - 180;
    c.style.setProperty("--sx", (50 + a * .7) + "%"); c.style.setProperty("--sy", (50 + rx * 1.2) + "%");
    cw.style.transform = `perspective(700px) rotateX(${rx * .3}deg) rotateY(${ay * .3}deg)`;
    hands(true);
    ctx.clearRect(0, 0, W, H); ctx.strokeStyle = ctx.fillStyle = "#7fe0d3";
    ps.forEach(p => {
      const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy) || 1;
      if (d < 130) { const f = (130 - d) / 130; p.vx += dx / d * f * 1.1; p.y += dy / d * f * 1.1; }
      p.x += p.vx; p.vx *= .92; p.y -= p.v;
      if (p.y < -12) { p.y = H + 12; p.x = Math.random() * W; }
      ctx.globalAlpha = p.a; ctx.lineWidth = 1.5; ctx.beginPath();
      if (p.plus) { ctx.moveTo(p.x - p.s, p.y); ctx.lineTo(p.x + p.s, p.y); ctx.moveTo(p.x, p.y - p.s); ctx.lineTo(p.x, p.y + p.s); ctx.stroke(); }
      else { ctx.arc(p.x, p.y, p.s / 2, 0, 7); ctx.fill(); }
      if (d < 150) { ctx.globalAlpha = (1 - d / 150) * .4; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.stroke(); } // jaring mengikuti kursor
    });
    requestAnimationFrame(loop);
  })();
}
function pilihRole(r) {
  LR = r; try { localStorage.setItem("klinik_role", r); } catch (e) { }
  Object.keys(ROLES).forEach(k => $("rl-" + k).classList.toggle("on", k == r));
  $("rd").textContent = ROLES[r].d; $("err").textContent = "";
  const ps = r == "Pasien";
  $("fa").style.display = ps ? "none" : ""; $("fn").style.display = ps ? "" : "none"; $("pw").value = "";
  $("dp").innerHTML = ps ? `<button class="b2 big" style="margin-top:8px" onclick="formAkun()">Daftar akun pasien baru</button> <button class="b2 big" style="margin-top:8px" onclick="formLupa()">Lupa password?</button>` : r == "Admin" && !PUB.adm ? `<p class="mu">Password admin belum dibuat. Klik Masuk untuk membuatnya.</p>` : "";
  const lst = r == "Admin" ? [{ id: 0, nama: "Administrator" }] : r == "Dokter" ? PUB.d : PUB.staf.filter(x => x.role == r);
  if (!ps) $("akun").innerHTML = lst.length ? lst.map(x => `<option value="${x.id}">${esc(x.nama)}</option>`).join("") : `<option value="">Belum ada akun ${r}</option>`;
  if (!ps && !lst.length) $("dp").innerHTML = `<p class="mu">Admin perlu membuat akun ${r} di menu Akun Staf.</p>`;
}
function togPw(b) { const i = $("pw"); i.type = i.type == "password" ? "text" : "password"; b.textContent = i.type == "password" ? "Lihat" : "Sembunyi"; }
function loginGagal(m) { sfx("err"); $("err").textContent = m; $("fr").classList.remove("shake"); void $("fr").offsetWidth; $("fr").classList.add("shake"); }
async function login() {
  const body = { role: LR, password: $("pw").value };
  if (LR == "Pasien") body.nik = val("nikl"); else body.id = +$("akun").value;
  try { await masuk(await api("auth?do=login", body)); }
  catch (e) { if (e.kode == "SETUP") return formSetupAdmin(); loginGagal(e.message); }
}
async function masuk(j) {
  CSRF = j.csrf; sfx("login"); stopMusic();
  if ($("btn")) { $("btn").textContent = "Memuat..."; $("btn").disabled = true; }
  const me = j.me; await muat(); U = me; P = MENU[U.role][0][0]; setTimeout(render, 350);
}
function formSetupAdmin() {
  modal(`<h3>Buat password admin</h3><p class="mu">Masukkan SETUP_KEY yang Anda atur di Environment Variables Vercel, lalu buat password admin.</p><label>Kode setup</label><input id="ak" type="password" autocomplete="off"><label>Password admin (minimal 6 karakter)</label><input id="ap1" type="password"><label>Ulangi password</label><input id="ap2" type="password"><button class="b" onclick="simpanAdmin()">Simpan dan masuk</button><span id="err" class="err"></span>`);
}
async function simpanAdmin() {
  if ($("ap1").value.length < 6) return fail("Password minimal 6 karakter.");
  if ($("ap1").value != $("ap2").value) return fail("Konfirmasi password tidak sama.");
  try { const j = await api("auth?do=setup_admin", { kode: $("ak").value, password: $("ap1").value }); closeModal(); await masuk(j); }
  catch (e) { fail(e.message); }
}

/* ---------- Pendaftaran akun pasien ---------- */
function formAkun() {
  modal(`<h3>Daftar akun pasien</h3><label>NIK (16 digit, dipakai untuk login)</label><input id="nik" maxlength="16" inputmode="numeric"><label>Nama lengkap</label><input id="nm"><label>Tanggal lahir</label><input id="tl" type="date">
  <label>Golongan darah</label><select id="gol"><option>A<option>B<option>AB<option>O</select><label>No. HP</label><input id="hp" inputmode="tel"><label>Alergi obat (jika ada)</label><input id="alg"><label>Alamat</label><input id="al">
  <label>Password (minimal 6 karakter)</label><input id="rp1" type="password" autocomplete="new-password"><label>Ulangi password</label><input id="rp2" type="password" autocomplete="new-password">
  <details style="margin:10px 0"><summary class="mu" style="cursor:pointer">Baca kebijakan privasi</summary>${kebijakanHtml()}</details>
  <label class="cek"><input type="checkbox" id="stj" style="width:auto"> Saya telah membaca dan menyetujui kebijakan privasi.</label>
  <button class="b" onclick="buatAkun()">Daftar dan masuk</button><span id="err" class="err"></span>`);
}
async function buatAkun() {
  const e = cekPasien(0); if (e) return fail(e);
  if ($("rp1").value.length < 6) return fail("Password minimal 6 karakter.");
  if ($("rp1").value != $("rp2").value) return fail("Konfirmasi password tidak sama.");
  if (!$("stj").checked) return fail("Centang persetujuan kebijakan privasi untuk melanjutkan.");
  try { const j = await api("auth?do=register", { ...dataPasien(), password: $("rp1").value, setuju: true }); closeModal(); await masuk(j); modalKode(j.kode_pulih, "Akun berhasil dibuat. Kode pemulihan Anda"); }
  catch (x) { fail(x.message); }
}
