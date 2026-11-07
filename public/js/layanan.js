/* layanan.js - Berobat dan janji temu (pasien), Rekam Medis (dokter), Resep (apoteker), Kasir, dokumen cetak */

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const tglLabel = s => { const d = new Date(s + "T00:00:00"); return NAMA_HARI[d.getDay()] + ", " + d.getDate() + "/" + (d.getMonth() + 1); };
const tglStr = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const tglPanjang = s => new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
function tglOpsi(dokId) { // 15 hari ke depan, hanya hari ketika dokter praktik
  const dk = find(D.d, dokId); let o = "";
  for (let i = 0; i <= 14; i++) { const t = dayAgo(-i); if ((dk.hari || []).includes(new Date(t + "T00:00:00").getDay())) o += `<option value="${t}">${tglLabel(t)}${i == 0 ? " (hari ini)" : ""}</option>`; }
  return o || `<option value="">Tidak ada jadwal</option>`;
}
function isiTgl() { $("tg").innerHTML = tglOpsi($("dk").value); }

/* ---------- Pasien: tiket, janji temu, notifikasi, dan riwayat ---------- */
let NOTIF = { id: 0, lv: 9 };
function posisiSaya() {
  const t = today(), act = D.a.find(a => a.pas == U.id && a.tgl == t && (a.st == "Menunggu" || a.st == "Dipanggil")); if (!act) return null;
  const w = D.a.filter(x => x.dok == act.dok && x.tgl == t && x.st == "Menunggu").sort(byPri);
  return { act, ahead: act.st == "Dipanggil" ? 0 : Math.max(0, w.findIndex(x => x.id == act.id)) };
}
const levelNotif = p => p.act.st == "Dipanggil" ? -1 : p.ahead == 0 ? 0 : p.ahead <= 2 ? 2 : 9;
function siapNotif() { const p = posisiSaya(); NOTIF = p ? { id: p.act.id, lv: levelNotif(p) } : { id: 0, lv: 9 }; }
function notifPasien() { // dipanggil tiap polling: bunyi, getar, dan notifikasi browser saat giliran mendekat
  const p = posisiSaya(); if (!p) { NOTIF = { id: 0, lv: 9 }; return; }
  const lv = levelNotif(p), a = p.act;
  if (lv < (NOTIF.id == a.id ? NOTIF.lv : 9)) {
    const msg = lv < 0 ? `Giliran Anda! Nomor ${a.no} dipanggil. Silakan masuk ke ruang dokter.` : lv == 0 ? `Anda berikutnya (nomor ${a.no}). Bersiaplah.` : `Giliran Anda hampir tiba: ${p.ahead} antrian di depan.`;
    sfx("notif"); toast(msg, 7000); if (typeof navigator != "undefined" && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    tampilNotif(msg);
  }
  NOTIF = { id: a.id, lv };
}
async function tampilNotif(msg) { // lewat service worker bila ada (lebih andal di HP), jika tidak notifikasi biasa
  if (!window.Notification || Notification.permission != "granted") return;
  try { const reg = typeof navigator != "undefined" && navigator.serviceWorker && await navigator.serviceWorker.getRegistration("sw.js"); if (reg) return reg.showNotification("Klinik Sehat", { body: msg, icon: "assets/himatif.png", tag: "antrian" }); new Notification("Klinik Sehat", { body: msg, icon: "assets/himatif.png" }); } catch (e) { }
}
function izinNotif() {
  if (!window.Notification) return toast("Browser ini tidak mendukung notifikasi");
  Notification.requestPermission().then(r => { toast(r == "granted" ? "Notifikasi browser diaktifkan" : "Notifikasi tidak diizinkan"); render(); });
}

LIVE.daftar = () => {
  const t = today(), my = D.a.filter(a => a.pas == U.id), p = posisiSaya();
  let top = "";
  if (p) top = `<div class="ticket"><small>Nomor antrian Anda - ${esc(find(D.d, p.act.dok).nama)}</small><b>${p.act.no}</b><span>${p.act.st == "Dipanggil" ? "Giliran Anda. Silakan masuk ke ruang dokter." : p.ahead + " antrian di depan Anda, perkiraan " + p.ahead * 10 + " menit"}</span><button class="b2" onclick="konfirm('Batalkan antrian ini?','batalSaya(${p.act.id})')">Batalkan antrian</button></div>`;
  const depan = my.filter(a => a.tgl > t && a.st == "Menunggu").sort((a, b) => a.tgl.localeCompare(b.tgl));
  if (depan.length) top += `<div class="panel"><h3>Janji temu mendatang</h3>${depan.map(a => `<div class="drow"><div><b>${tglPanjang(a.tgl)}</b> - ${esc(find(D.d, a.dok).nama)}<br><small class="mu">Nomor ${a.no}. ${esc(a.kel)}</small></div><button class="b2" onclick="konfirm('Batalkan janji temu ini?','batalSaya(${a.id})')">Batalkan</button></div>`).join("")}</div>`;
  return top;
};
LIVE2.daftar = () => {
  const my = D.a.filter(a => a.pas == U.id).reverse();
  const rows = my.map(a => {
    const r = D.r.find(x => x.aid == a.id), b = D.b.find(x => x.aid == a.id);
    const dok = r ? [r.res.length ? `<button class="b2" onclick="resep(${r.id})">Resep</button>` : "", r.sakit > 0 ? `<button class="b2" onclick="suratSakit(${r.id})">Surat sakit</button>` : "", r.ruj ? `<button class="b2" onclick="suratRujukan(${r.id})">Rujukan</button>` : "", b && b.lunas ? `<button class="b2" onclick="kuitansiPdf(${b.id})">Kuitansi PDF</button>` : ""].join("") : "";
    return `<tr><td><b>${a.no}</b><td>${a.tgl}<td>${esc(find(D.d, a.dok).nama)}<td>${badge(a.st)}<td>${r ? esc((r.icd ? r.icd + " - " : "") + r.dx) + (r.kor ? ` <span class="bd amb" title="Dokter mengoreksi data ini">dikoreksi</span>` : "") : "-"}<td>${r && r.res.length ? (r.rs == "Diserahkan" ? "Sudah diserahkan" : "Sedang disiapkan") : "-"}<td>${b ? (b.lunas ? badge("Lunas") : "Belum bayar") : "-"}<td>${dok}`;
  });
  return `<div class="panel"><h3>Riwayat kunjungan</h3>${tbl(["No", "Tanggal", "Dokter", "Status", "Diagnosis", "Obat", "Tagihan", "Dokumen"], rows)}</div>`;
};
PG.daftar = () => {
  siapNotif();
  const izin = window.Notification && Notification.permission == "default" ? `<button class="b2" onclick="izinNotif()">Aktifkan notifikasi browser</button>` : "";
  const form = D.d.length ? `<div class="panel"><h3>Ambil antrian atau janji temu</h3><p class="mu">Pilih hari ini atau hingga 14 hari ke depan. Anda akan diberi bunyi dan pemberitahuan saat giliran hampir tiba (selama halaman ini terbuka). ${izin}</p>
  <label>Dokter</label><select id="dk" onchange="isiTgl()">${D.d.map(d => `<option value="${d.id}">${esc(d.nama)} - ${esc(d.sp)} (${rp(d.tarif)})</option>`).join("")}</select>
  <label>Tanggal kunjungan</label><select id="tg">${tglOpsi(D.d[0].id)}</select><label>Keluhan</label><textarea id="kl" rows="3"></textarea><label>Prioritas</label><select id="pr"><option>Normal<option>Darurat</select>
  <button class="b" onclick="daftar()">Ambil nomor antrian</button><span id="err" class="err"></span></div>` : `<div class="panel">Belum ada dokter terdaftar.</div>`;
  return `<div id="live">${LIVE.daftar()}</div>${form}<div id="live2">${LIVE2.daftar()}</div>`;
};
async function daftar() {
  if (!val("kl")) return fail("Keluhan wajib diisi.");
  if (!$("tg").value) return fail("Dokter ini belum punya jadwal dalam 14 hari ke depan.");
  const j = await act("antrian_daftar", { dok: +$("dk").value, tgl: $("tg").value, kel: val("kl"), pri: $("pr").value }); if (!j) return;
  render(); modal(`<div class="tk">${esc(j.no)}</div><p style="text-align:center">${j.tgl == today() ? "Nomor antrian" : "Janji temu " + tglPanjang(j.tgl)} untuk ${esc(j.dokter)}.${j.tgl == today() ? "<br>Perkiraan tunggu: " + j.tunggu + " menit." : "<br>Datang pada hari tersebut dan pantau antrian di halaman ini."}</p>`);
}
async function batalSaya(id) { if (await act("antrian_batal", { id })) { render(); toast("Antrian dibatalkan"); } }

/* ---------- Dokter: antrian hari ini dan pemeriksaan lengkap ---------- */
LIVE.rekam = () => {
  const q = D.a.filter(a => a.dok == U.id && a.tgl == today() && (a.st == "Menunggu" || a.st == "Dipanggil")).sort(byPri);
  return `<div class="panel"><h3>Antrian hari ini (darurat didahulukan)</h3><button class="b" onclick="panggilNext()">Panggil pasien berikutnya</button>${q.map(a => `<div class="drow"><div><b>${a.no}</b> ${esc(find(D.p, a.pas).nama)} ${badge(a.pri)} ${badge(a.st)}<br><small class="mu">${esc(a.kel)}</small></div><div>${a.st == "Menunggu" ? `<button class="b2" onclick="panggil(${a.id})">Panggil</button>` : `<button class="b2" onclick="panggilUlang(${a.id})">Panggil ulang</button>`}<button class="b" onclick="periksa(${a.id})">Periksa</button></div></div>`).join("") || "<p class='mu'>Tidak ada antrian hari ini.</p>"}</div>`;
};
LIVE2.rekam = () => {
  const mine = D.r.filter(r => r.dok == U.id).slice().reverse().slice(0, 15);
  return `<div class="panel"><h3>Rekam medis terbaru saya</h3><p class="mu">Salah isi? Koreksi dengan alasan. Data lama tidak hilang karena setiap koreksi tercatat di jejak.</p>${tbl(["Tanggal", "Pasien", "Diagnosis", "Koreksi", "Aksi"], mine.map(r => `<tr><td>${r.tgl}<td>${esc(find(D.p, r.pas).nama)}<td>${esc((r.icd ? r.icd + " - " : "") + r.dx)}<td>${r.kor ? r.kor + "x" : "-"}<td><button class="b2" onclick="formKoreksi(${r.id})">Koreksi</button>${r.kor ? `<button class="b2" onclick="jejakKoreksi(${r.id})">Jejak</button>` : ""}`))}</div>`;
};
PG.rekam = () => `<div id="live">${LIVE.rekam()}</div>${SEL ? formPeriksa() : ""}<div id="live2">${LIVE2.rekam()}</div>`;
const LABEL_KOREKSI = { td: "Tekanan darah", suhu: "Suhu", bb: "Berat badan", tb: "Tinggi badan", icd: "Kode ICD-10", dx: "Diagnosis", tin: "Tindakan", sakit: "Istirahat (hari)", ruj: "Rujukan" };
function formKoreksi(id) {
  const r = find(D.r, id);
  modal(`<h3>Koreksi rekam medis</h3><p class="mu">${esc(find(D.p, r.pas).nama)} - ${r.tgl}. Obat dan resep tidak bisa diubah di sini.</p>
  <div class="row"><div><label>Tekanan darah</label><input id="kx_td" value="${esc(r.td)}"></div><div><label>Suhu (C)</label><input id="kx_sh" type="number" step="0.1" value="${esc(r.suhu)}"></div></div>
  <div class="row"><div><label>Berat badan (kg)</label><input id="kx_bb" type="number" step="0.1" value="${esc(r.bb)}"></div><div><label>Tinggi badan (cm)</label><input id="kx_tb" type="number" step="0.1" value="${esc(r.tb)}"></div></div>
  <label>Diagnosis</label><input id="kx_dx" list="icd" value="${esc((r.icd ? r.icd + " - " : "") + r.dx)}"><datalist id="icd">${ICD.map(x => `<option value="${x[0]} - ${x[1]}">`).join("")}</datalist>
  <label>Tindakan</label><input id="kx_tn" value="${esc(r.tin)}"><div class="row"><div><label>Istirahat (hari)</label><input id="kx_sk" type="number" min="0" max="30" value="${r.sakit}"></div><div><label>Rujukan</label><input id="kx_rj" value="${esc(r.ruj)}"></div></div>
  <label>Alasan koreksi (wajib)</label><input id="kx_al" placeholder="mis. salah memilih diagnosis"><button class="b" onclick="simpanKoreksi(${id})">Simpan koreksi</button><span id="err" class="err"></span>`);
}
async function simpanKoreksi(id) {
  let dx = val("kx_dx"), icd = ""; const m = dx.match(/^([A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)\s+-\s+(.+)$/i);
  if (m) { icd = m[1].toUpperCase(); dx = m[2]; }
  if (!dx) return fail("Diagnosis wajib diisi."); if (val("kx_al").length < 5) return fail("Alasan koreksi wajib diisi (minimal 5 karakter).");
  if (await act("rekam_koreksi", { id, td: val("kx_td"), suhu: val("kx_sh"), bb: val("kx_bb"), tb: val("kx_tb"), icd, dx, tin: val("kx_tn"), sakit: +val("kx_sk") || 0, ruj: val("kx_rj"), alasan: val("kx_al") })) { closeModal(); render(); toast("Koreksi disimpan dan dicatat"); }
}
async function jejakKoreksi(id) {
  const j = await act("rekam_jejak", { id }); if (!j) return;
  modal(`<h3>Jejak koreksi</h3>` + (j.jejak.filter(x => x.aksi == "rekam_koreksi").map(x => `<div class="panel"><b>${esc(x.waktu)}</b> oleh ${esc(x.oleh)}<br><span class="mu">Alasan:</span> ${esc(x.rincian.alasan || "-")}<table>${Object.entries(x.rincian.perubahan || {}).map(([k, v]) => `<tr><td>${LABEL_KOREKSI[k] || k}<td>${esc(v[0] === "" ? "(kosong)" : v[0])} &rarr; <b>${esc(v[1] === "" ? "(kosong)" : v[1])}</b>`).join("")}</table></div>`).join("") || "<p class='mu'>Belum ada koreksi.</p>"));
}
function formPeriksa() {
  const a = find(D.a, SEL), p = find(D.p, a.pas), hist = D.r.filter(r => r.pas == p.id).slice(-3).reverse(), h = today();
  return `<div class="panel" id="frm"><h3>Pemeriksaan ${esc(p.nama)} (${umur(p.tl)} th)</h3>${p.alergi ? `<div class="warn">Alergi: ${esc(p.alergi)}</div>` : ""}<p class="mu">Keluhan: ${esc(a.kel)}${hist.length ? "<br>Riwayat terakhir: " + hist.map(r => r.tgl + " " + esc(r.dx)).join("; ") : ""}</p>
  <div class="row"><input id="td" placeholder="Tekanan darah, mis. 120/80"><input id="sh" type="number" step="0.1" placeholder="Suhu (C)"></div>
  <div class="row"><input id="bb" type="number" step="0.1" placeholder="Berat badan (kg)" oninput="hitungBmi()"><input id="tb" type="number" step="0.1" placeholder="Tinggi badan (cm)" oninput="hitungBmi()"></div><div id="bmi" class="mu"></div>
  <label>Diagnosis (ketik untuk mencari kode ICD-10, atau tulis bebas)</label><input id="dx" list="icd" autocomplete="off" placeholder="mis. J06.9 - Infeksi saluran napas atas akut"><datalist id="icd">${ICD.map(x => `<option value="${x[0]} - ${x[1]}">`).join("")}</datalist>
  <input id="tn" placeholder="Tindakan">
  <div class="row"><div><label>Surat sakit: istirahat (hari)</label><input id="sk" type="number" min="0" max="30" value="0"></div><div><label>Rujukan (kosongkan jika tidak ada)</label><input id="rj" placeholder="mis. RSUD, Poli Penyakit Dalam"></div></div>
  <label>Resep obat</label><div class="row"><select id="ob">${D.o.map(o => `<option value="${o.id}" ${o.exp && o.exp < h ? "disabled" : ""}>${esc(o.nama)} (stok ${o.stok})${o.exp && o.exp < h ? " - kedaluwarsa" : ""}</option>`).join("")}</select><input id="jm" type="number" value="1" min="1"></div>
  <button class="b2" onclick="addObat()">Tambah ke resep</button><div id="cart">${cartHtml()}</div><button class="b" onclick="simpan()">Simpan rekam medis</button> <button class="b2" onclick="SEL=null;render()">Batal</button><span id="err" class="err"></span></div>`;
}
function hitungBmi() {
  const bb = +$("bb").value, tb = +$("tb").value / 100; if (!(bb > 0 && tb > 0)) { $("bmi").textContent = ""; return; }
  const v = bb / (tb * tb); $("bmi").textContent = `IMT ${v.toFixed(1)} - ${v < 18.5 ? "kurus" : v < 25 ? "normal" : v < 30 ? "berat badan lebih" : "obesitas"} (kategori WHO)`;
}
async function panggil(id) { if (await act("antrian_panggil", { id })) render(); }
async function panggilUlang(id) { if (await act("antrian_ulang", { id })) toast("Dipanggil ulang, layar TV akan mengumumkan lagi"); }
function periksa(id) { SEL = id; CART = []; render(); $("frm").scrollIntoView({ behavior: "smooth" }); }
function cartHtml() {
  const tarif = find(D.d, find(D.a, SEL).dok).tarif, obat = CART.reduce((s, c) => s + find(D.o, c.id).harga * c.jml, 0);
  return CART.map((c, i) => `<p>💊 ${esc(find(D.o, c.id).nama)} x${c.jml} <button class="b2" onclick="delItem(${i})">Hapus</button></p>`).join("") + `<p class="mu">Estimasi tagihan: ${rp(tarif + obat)} (konsultasi ${rp(tarif)} + obat ${rp(obat)})</p>`;
}
function drawCart() { $("cart").innerHTML = cartHtml(); }
function delItem(i) { CART.splice(i, 1); drawCart(); }
function addObat() {
  const o = find(D.o, $("ob").value), j = +$("jm").value, ada = CART.find(c => c.id == o.id), pakai = (ada ? ada.jml : 0) + j;
  if (o.exp && o.exp < today()) return fail(o.nama + " sudah kedaluwarsa.");
  if (!(j >= 1) || pakai > o.stok) return fail("Jumlah melebihi stok (" + o.stok + ").");
  fail(""); if (ada) ada.jml = pakai; else CART.push({ id: o.id, jml: j }); drawCart();
}
async function simpan() {
  let dx = val("dx"), icd = ""; const m = dx.match(/^([A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)\s+-\s+(.+)$/i);
  if (m) { icd = m[1].toUpperCase(); dx = m[2]; }
  if (!dx) return fail("Diagnosis wajib diisi.");
  if (val("sh") && (+val("sh") < 34 || +val("sh") > 43)) return fail("Suhu harus antara 34 dan 43 C.");
  const aid = SEL;
  if (!await act("rekam_simpan", { aid, td: val("td"), suhu: val("sh"), bb: val("bb"), tb: val("tb"), icd, dx, tin: val("tn"), sakit: +val("sk") || 0, ruj: val("rj"), res: CART })) return;
  SEL = null; CART = []; render();
  const r = D.r.find(x => x.aid == aid);
  modal(`<h3>Rekam medis disimpan</h3><p class="mu">Tagihan dibuat otomatis dan resep dikirim ke apotek. Cetak dokumen untuk pasien:</p>${r ? [r.res.length ? `<button class="b2" onclick="resep(${r.id})">Resep</button>` : "", r.sakit > 0 ? `<button class="b2" onclick="suratSakit(${r.id})">Surat sakit</button>` : "", r.ruj ? `<button class="b2" onclick="suratRujukan(${r.id})">Surat rujukan</button>` : ""].join("") : ""}`);
}

/* ---------- Dokumen cetak: resep, surat sakit, surat rujukan ---------- */
function kop() { return `<div style="display:flex;gap:10px;align-items:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px">${logo(40)}<div><b>KLINIK SEHAT</b><br><small>Prodi Teknologi Informasi</small></div></div>`; }
const ttd = r => `<p style="margin-top:34px;text-align:right">${tglPanjang(r.tgl)}<br><br><br><br><b>${esc(find(D.d, r.dok).nama)}</b></p>`;
const cetak = `<button class="b noprint" onclick="window.print()">Cetak</button>`;
function resep(rid) {
  const r = find(D.r, rid);
  modal(`${kop()}<h3>Resep</h3><p>Tanggal: ${tglPanjang(r.tgl)}<br>Pasien: ${esc(find(D.p, r.pas).nama)}<br>Dokter: ${esc(find(D.d, r.dok).nama)}<br>Diagnosis: ${esc((r.icd ? r.icd + " - " : "") + r.dx)}</p><p>${r.res.map(o => `R/ ${esc(find(D.o, o.id).nama)} No. ${o.jml}`).join("<br>") || "Tanpa obat."}</p>${cetak}`);
}
function suratSakit(rid) {
  const r = find(D.r, rid), p = find(D.p, r.pas), akhir = new Date(r.tgl + "T00:00:00"); akhir.setDate(akhir.getDate() + r.sakit - 1);
  modal(`${kop()}<h3 style="text-align:center;text-decoration:underline">SURAT KETERANGAN SAKIT</h3><p>Yang bertanda tangan di bawah ini, ${esc(find(D.d, r.dok).nama)}, menerangkan bahwa:</p><p style="margin-left:14px">Nama: <b>${esc(p.nama)}</b><br>Umur: ${umur(p.tl)} tahun<br>Alamat: ${esc(p.al || "-")}</p><p>telah diperiksa pada ${tglPanjang(r.tgl)} dan perlu beristirahat selama <b>${r.sakit} (${terbilang(r.sakit)}) hari</b>, terhitung mulai ${tglPanjang(r.tgl)} sampai dengan ${tglPanjang(tglStr(akhir))}.</p><p>Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>${ttd(r)}${cetak}`);
}
function suratRujukan(rid) {
  const r = find(D.r, rid), p = find(D.p, r.pas);
  modal(`${kop()}<h3 style="text-align:center;text-decoration:underline">SURAT RUJUKAN</h3><p>Kepada Yth.<br><b>${esc(r.ruj)}</b></p><p>Mohon pemeriksaan dan penanganan lanjutan untuk pasien:</p><p style="margin-left:14px">Nama: <b>${esc(p.nama)}</b><br>Umur: ${umur(p.tl)} tahun<br>Alergi: ${esc(p.alergi || "tidak ada")}</p><p>Hasil pemeriksaan ${tglPanjang(r.tgl)}: tekanan darah ${esc(r.td || "-")}, suhu ${esc(r.suhu || "-")} C, berat badan ${esc(r.bb || "-")} kg, tinggi badan ${esc(r.tb || "-")} cm.<br>Diagnosis: <b>${esc((r.icd ? r.icd + " - " : "") + r.dx)}</b>${r.tin ? "<br>Tindakan: " + esc(r.tin) : ""}</p><p>Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>${ttd(r)}${cetak}`);
}

/* ---------- Resep obat (Apoteker dan Admin) ---------- */
LIVE.resep = () => {
  const list = D.r.filter(r => r.res && r.res.length).slice().reverse();
  const kartu = r => { const p = find(D.p, r.pas); return `<div class="drow"><div><b>${esc(p.nama)}</b> ${p.alergi ? `<span class="bd red">Alergi: ${esc(p.alergi)}</span>` : ""}<br><small class="mu">${r.tgl} - ${esc(find(D.d, r.dok).nama)}</small><br>${r.res.map(x => esc(find(D.o, x.id).nama) + " x" + x.jml).join(", ")}</div><div>${r.rs == "Menunggu" ? `<button class="b" onclick="serah(${r.id})">Tandai diserahkan</button>` : `<span class="bd grn">Diserahkan</span>`}</div></div>`; };
  const tunggu = list.filter(r => r.rs == "Menunggu"), selesai = list.filter(r => r.rs == "Diserahkan").slice(0, 15);
  return `<div class="panel"><h3>Resep menunggu disiapkan (${tunggu.length})</h3>${tunggu.map(kartu).join("") || "<p class='mu'>Tidak ada resep yang menunggu.</p>"}</div><div class="panel"><h3>Sudah diserahkan (15 terakhir)</h3>${selesai.map(kartu).join("") || "<p class='mu'>Belum ada.</p>"}</div>`;
};
PG.resep = () => `<div id="live">${LIVE.resep()}</div>`;
async function serah(id) { if (await act("resep_serah", { id })) { render(); toast("Resep ditandai diserahkan"); } }

/* ---------- Kasir (Kasir dan Admin) ---------- */
const bRows = q => D.b.filter(b => !b.lunas && find(D.p, b.pas).nama.toLowerCase().includes(q.toLowerCase())).map(b => `<tr><td>${esc(find(D.p, b.pas).nama)}<td>${b.tgl}<td>${rp(b.tarif)}<td>${rp(b.obat)}<td><b>${rp(b.tarif + b.obat)}</b><td><button class="b" onclick="formBayar(${b.id})">Bayar</button>`);
PG.bayar = () => {
  const t = today(), lu = D.b.filter(b => b.lunas).reverse(), hari = lu.filter(b => (b.tglb || b.tgl) == t), bl = D.b.filter(b => !b.lunas);
  return `<div class="stats s3"><div>Belum dibayar<b>${bl.length}</b></div><div>Diterima hari ini<b>${rp(hari.reduce((s, b) => s + b.total, 0))}</b></div><div>Transaksi hari ini<b>${hari.length}</b></div></div>
  <div class="panel"><h3>Tagihan belum dibayar</h3><input placeholder="Cari nama pasien..." oninput="$('bt').innerHTML=tbl(['Pasien','Tanggal','Konsultasi','Obat','Total','Aksi'],bRows(this.value))"><div id="bt">${tbl(["Pasien", "Tanggal", "Konsultasi", "Obat", "Total", "Aksi"], bRows(""))}</div></div>
  <div class="panel"><h3>Riwayat pembayaran</h3>${tbl(["Pasien", "Tanggal", "Metode", "Total", "Struk"], lu.slice(0, 50).map(b => `<tr><td>${esc(find(D.p, b.pas).nama)}<td>${b.tglb || b.tgl}<td>${b.metode}<td>${rp(b.total)}<td><button class="b2" onclick="struk(${b.id})">Lihat</button><button class="b2" onclick="kuitansiPdf(${b.id})">PDF</button>`))}</div>`;
};
function formBayar(id) {
  const b = find(D.b, id);
  modal(`<h3>Pembayaran ${esc(find(D.p, b.pas).nama)}</h3><p>Konsultasi ${rp(b.tarif)}<br>Obat ${rp(b.obat)}<br><b>Total ${rp(b.tarif + b.obat)}</b></p><label>Metode</label><select id="mt" onchange="$('tt').textContent=rp(this.value=='BPJS'?${b.obat}:${b.tarif + b.obat})"><option>Tunai<option>QRIS<option>BPJS</select><p>Yang dibayar: <b id="tt">${rp(b.tarif + b.obat)}</b></p><p class="mu">BPJS menanggung biaya konsultasi, pasien hanya membayar obat.</p><button class="b" onclick="bayar(${id})">Konfirmasi pembayaran</button>`);
}
async function bayar(id) {
  if (!await act("bayar", { id, metode: $("mt").value })) return;
  closeModal(); render(); toast("Pembayaran lunas"); struk(id);
}
function struk(id) {
  const b = find(D.b, id);
  modal(`${kop()}<h3>Struk Pembayaran</h3><p>Tanggal: ${tglPanjang(b.tglb || b.tgl)}<br>Pasien: ${esc(find(D.p, b.pas).nama)}</p><p>Konsultasi: ${rp(b.tarif)}<br>Obat: ${rp(b.obat)}<br>Metode: ${b.metode}<br><b>Total dibayar: ${rp(b.total)}</b></p><button class="b noprint" onclick="window.print()">Cetak struk</button> <button class="b2 noprint" onclick="kuitansiPdf(${id})">Unduh kuitansi PDF</button>`);
}

/* ---------- Kuitansi PDF ---------- */
function kuitansiPdf(id) {
  const b = find(D.b, id), p = find(D.p, b.pas), a = find(D.a, b.aid), d = find(D.d, a.dok);
  const no = "K-" + String(b.id).padStart(6, "0"), e = [], W = 420, L = 40, R = 380;
  const lb = (s, z) => s.length * z * 0.52, tengah = (s, y, z, tb) => e.push({ t: s, x: Math.round((W - lb(s, z)) / 2), y, s: z, b: tb }), kiri = (s, x, y, z, tb) => e.push({ t: s, x, y, s: z, b: tb }), kanan = (s, y, z, tb) => e.push({ t: s, x: Math.round(R - lb(s, z)), y, s: z, b: tb });
  tengah("KLINIK SEHAT", 552, 20, 1); tengah("Prodi Teknologi Informasi", 536, 10); e.push({ g: [L, 524, R, 524] });
  tengah("KUITANSI PEMBAYARAN", 498, 14, 1); tengah("No. " + no, 482, 10);
  [["Diterima dari", p.nama], ["Tanggal", tglPanjang(b.tglb || b.tgl)], ["Dokter", d.nama], ["Metode bayar", b.metode]].forEach((x, i) => { kiri(x[0], L, 446 - i * 20, 11); kiri(": " + x[1], 140, 446 - i * 20, 11); });
  kiri("Rincian", L, 350, 11, 1); e.push({ g: [L, 344, R, 344] });
  kiri("Konsultasi dokter", L, 328, 11); kanan(rp(b.tarif), 328, 11);
  kiri("Obat", L, 308, 11); kanan(rp(b.obat), 308, 11);
  let y = 288; if (b.metode == "BPJS") { kiri("Ditanggung BPJS (konsultasi)", L, y, 11); kanan("-" + rp(b.tarif), y, 11); y -= 20; }
  e.push({ g: [L, y + 10, R, y + 10] }); kiri("TOTAL DIBAYAR", L, y - 12, 13, 1); kanan(rp(b.total), y - 12, 13, 1); e.push({ k: [L - 6, y - 24, R - L + 12, 38] });
  const kata = "Terbilang: " + rupiahKata(b.total), baris = []; let cur = "";
  kata.split(" ").forEach(w => { if ((cur + " " + w).length > 58) { baris.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }); baris.push(cur);
  baris.forEach((s, i) => kiri(s, L, y - 52 - i * 14, 10));
  kiri("Kasir,", 300, 160, 11); e.push({ g: [280, 100, R, 100] }); kiri("(tanda tangan dan nama)", 292, 88, 8);
  tengah("Dokumen ini dibuat oleh sistem Klinik Sehat", 40, 8);
  unduh("kuitansi-" + no + ".pdf", pdfBuat([e]), "application/pdf");
}
