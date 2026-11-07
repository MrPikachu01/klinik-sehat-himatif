/* admin.js - Dashboard, Data Pasien, Data Dokter, Akun Staf, Antrian, Stok Obat */

/* status obat: menipis (stok <= batas minimum) dan kedaluwarsa (lewat atau 30 hari lagi) */
const obatMenipis = o => o.stok <= o.smin;
function statusExp(o) {
  if (!o.exp) return "";
  const sisa = Math.floor((new Date(o.exp) - new Date(today())) / 864e5);
  return sisa < 0 ? "lewat" : sisa <= 30 ? "segera" : "";
}

/* ---------- Dashboard (bagian #live ikut diperbarui otomatis) ---------- */
LIVE.dash = () => {
  const t = today(), dok = U.role == "Dokter";
  const a = D.a.filter(x => x.tgl == t && (!dok || x.dok == U.id));
  const n = s => a.filter(x => x.st == s).length;
  const board = D.d.filter(d => !dok || d.id == U.id).map(d => {
    const q = a.filter(x => x.dok == d.id), c = q.filter(x => x.st == "Dipanggil").pop();
    return `<div class="slot"><small>${esc(d.nama)} - ${esc(d.sp)}</small><b>${c ? c.no : "--"}</b><span>${q.filter(x => x.st == "Menunggu").length} menunggu</span></div>`;
  }).join("");
  const st = [["Pasien terdaftar", D.npas], ["Antrian hari ini", a.length], ["Menunggu", n("Menunggu")], ["Selesai", n("Selesai")], ["Obat menipis", D.o.filter(obatMenipis).length], ["Obat kedaluwarsa", D.o.filter(o => statusExp(o)).length]];
  let extra = "";
  if (dok) extra = `<button class="b" onclick="panggilNext()">Panggil pasien berikutnya</button> <button class="b2" onclick="go('rekam')">Buka rekam medis</button>`;
  else {
    const days = [6, 5, 4, 3, 2, 1, 0].map(dayAgo);
    const v = days.map(d => D.b.filter(b => b.lunas && (b.tglb || b.tgl) == d).reduce((s, b) => s + b.total, 0)), mx = Math.max(1, ...v);
    extra = `<div class="panel"><h3>Pendapatan 7 hari terakhir</h3><div class="chart">${v.map((x, i) => `<div><em>${x ? Math.round(x / 1000) + "rb" : ""}</em><i style="height:${x / mx * 70}%"></i><small>${days[i].slice(5)}</small></div>`).join("")}</div></div>`;
  }
  return `<div class="board">${board}</div><div class="stats">${st.map(s => `<div>${s[0]}<b>${s[1]}</b></div>`).join("")}</div>${extra}`;
};
PG.dash = () => `<div id="live">${LIVE.dash()}</div>`;
async function panggilNext() {
  const j = await act("antrian_next"); if (j) { render(); toast("Memanggil " + j.no); }
}

/* ---------- Data Pasien: tambah, ubah, hapus, riwayat ---------- */
const pRows = q => D.p.filter(p => (p.nama + p.nik).toLowerCase().includes(q.toLowerCase())).map(p =>
  `<tr><td>${esc(p.nik)}<td>${esc(p.nama)}${p.privasi ? "" : ` <span class="bd amb" title="Belum menyetujui kebijakan privasi">belum setuju</span>`}<td>${umur(p.tl)} th<td>${p.gol}<td>${esc(p.hp || "-")}<td>${p.alergi ? `<span class="bd red">${esc(p.alergi)}</span>` : "-"}<td><button class="b2" onclick="formP(${p.id})">Ubah</button><button class="b2" onclick="riwayat(${p.id})">Riwayat</button><button class="b2" onclick="konfirm('Hapus data pasien ini?','delP(${p.id})')">Hapus</button>`).join("");
PG.pasien = () => `<div class="panel"><div class="row"><input placeholder="Cari nama atau NIK..." oninput="$('tb').innerHTML=pRows(this.value)"><div><button class="b" onclick="formP(0)">Tambah pasien</button></div></div>
<div class="tw"><table><tr><th>NIK<th>Nama<th>Umur<th>Gol<th>HP<th>Alergi<th>Aksi<tbody id="tb">${pRows("")}</tbody></table></div></div>`;
function formP(id) {
  const p = id ? find(D.p, id) : {};
  modal(`<h3>${id ? "Ubah" : "Tambah"} pasien</h3><label>NIK (16 digit)</label><input id="nik" value="${esc(p.nik || "")}" maxlength="16" inputmode="numeric"><label>Nama lengkap</label><input id="nm" value="${esc(p.nama || "")}">
  <label>Tanggal lahir</label><input id="tl" type="date" value="${p.tl || ""}"><label>Golongan darah</label><select id="gol">${["A", "B", "AB", "O"].map(g => `<option ${p.gol == g ? "selected" : ""}>${g}`).join("")}</select>
  <label>No. HP</label><input id="hp" value="${esc(p.hp || "")}" inputmode="tel"><label>Alergi obat</label><input id="alg" value="${esc(p.alergi || "")}"><label>Alamat</label><input id="al" value="${esc(p.al || "")}">
  <button class="b" onclick="simpanP(${id})">Simpan</button>${id ? ` <button class="b2" onclick="konfirm('Buat password sementara baru untuk pasien ini?','resetPass(${id})')">Reset password</button>` : ""}<span id="err" class="err"></span>`);
}
async function simpanP(id) {
  const e = cekPasien(id); if (e) return fail(e);
  const j = await act("pasien_simpan", { id, ...dataPasien() }); if (!j) return;
  closeModal(); render();
  if (j.temp) modal(`<h3>Pasien disimpan</h3><p>Password awal pasien: <b>${j.temp}</b><br><small class="mu">Catat dan berikan ke pasien. Password ini tidak ditampilkan lagi.</small></p>`); else toast("Data pasien disimpan");
}
async function resetPass(id) {
  const j = await act("pasien_reset_pass", { id }); if (j) modal(`<h3>Password baru</h3><p>Password sementara pasien: <b>${j.temp}</b><br><small class="mu">Catat dan berikan ke pasien. Tidak ditampilkan lagi.</small></p>`);
}
async function delP(id) { if (await act("pasien_hapus", { id })) { render(); toast("Pasien dihapus"); } }
function riwayat(id) {
  const r = D.r.filter(x => x.pas == id).reverse();
  modal(`<h3>Riwayat ${esc(find(D.p, id).nama)}</h3>` + (r.map(x => `<p><b>${x.tgl}</b> - ${esc(find(D.d, x.dok).nama)}<br>TD ${esc(x.td || "-")}, suhu ${esc(x.suhu || "-")} C<br>Diagnosis: ${esc((x.icd ? x.icd + " - " : "") + x.dx)}${x.bb ? "<br>BB " + esc(x.bb) + " kg, TB " + esc(x.tb || "-") + " cm" : ""}${x.sakit > 0 ? "<br>Istirahat " + x.sakit + " hari" : ""}${x.ruj ? "<br>Rujukan: " + esc(x.ruj) : ""}<br>Resep: ${x.res.map(o => esc(find(D.o, o.id).nama) + " x" + o.jml).join(", ") || "-"}${x.kor ? `<br><button class="b2" onclick="jejakKoreksi(${x.id})">Dikoreksi ${x.kor}x - lihat jejak</button>` : ""}</p>`).join("") || "<p class='mu'>Belum ada rekam medis.</p>"));
}

/* ---------- Data Dokter dan jadwal praktik ---------- */
PG.dokter = () => `<div class="panel"><button class="b" onclick="formD(0)">Tambah dokter</button><p class="mu">Klik nama hari untuk mengaktifkan atau menonaktifkan jadwal. Pasien hanya bisa mendaftar ke dokter yang praktik hari ini.</p>
${D.d.map(d => `<div class="drow"><div><b>${esc(d.nama)}</b>${d.pass ? "" : ` <span class="bd amb">Password belum diatur</span>`}<br><small class="mu">${esc(d.sp)} - ${rp(d.tarif)}</small></div><div>${HARI.map((h, i) => `<button class="day ${d.hari.includes(i) ? "on" : ""}" onclick="togHari(${d.id},${i})">${h}</button>`).join("")}</div><div><button class="b2" onclick="formD(${d.id})">Ubah</button><button class="b2" onclick="konfirm('Hapus dokter ini?','delD(${d.id})')">Hapus</button></div></div>`).join("")}</div>`;
function formD(id) {
  const d = id ? find(D.d, id) : {};
  modal(`<h3>${id ? "Ubah" : "Tambah"} dokter</h3><label>Nama dokter</label><input id="dn" value="${esc(d.nama || "")}"><label>Spesialis</label><input id="ds" value="${esc(d.sp || "")}"><label>Tarif konsultasi (Rp)</label><input id="dt" type="number" value="${d.tarif || ""}"><label>Password login dokter ${id ? "(kosongkan jika tidak diubah)" : ""}</label><input id="dpw" type="password" autocomplete="new-password"><button class="b" onclick="simpanD(${id})">Simpan</button><span id="err" class="err"></span>`);
}
async function simpanD(id) {
  if (!val("dn") || !val("ds") || !(+val("dt") > 0)) return fail("Nama, spesialis, dan tarif wajib diisi.");
  const pw = $("dpw").value; if (pw && pw.length < 6) return fail("Password minimal 6 karakter.");
  if (await act("dokter_simpan", { id, nama: val("dn"), sp: val("ds"), tarif: +val("dt"), password: pw })) { closeModal(); render(); toast("Data dokter disimpan"); }
}
async function togHari(id, h) { if (await act("dokter_hari", { id, h })) render(); }
async function delD(id) { if (await act("dokter_hapus", { id })) { render(); toast("Dokter dihapus"); } }

/* ---------- Antrian: filter dokter dan status ---------- */
LIVE.antri = () => {
  const fd = $("fd") ? $("fd").value : "", fs = $("fs") ? $("fs").value : "";
  return tbl(["No", "Tanggal", "Pasien", "Dokter", "Keluhan", "Prioritas", "Status", "Aksi"], D.a.filter(a => (!fd || a.dok == fd) && (!fs || a.st == fs)).sort((a, b) => b.tgl.localeCompare(a.tgl) || byPri(a, b)).map(a =>
    `<tr><td><b>${a.no}</b><td>${a.tgl}<td>${esc(find(D.p, a.pas).nama)}<td>${esc(find(D.d, a.dok).nama)}<td>${esc(a.kel)}<td>${badge(a.pri)}<td>${badge(a.st)}<td>${a.st == "Menunggu" && U.role == "Admin" ? `<button class="b2" onclick="konfirm('Batalkan antrian ini?','batal(${a.id})')">Batalkan</button>` : ""}`));
};
PG.antri = () => `<div class="panel"><div class="row"><select id="fd" onchange="refresh()"><option value="">Semua dokter${D.d.map(d => `<option value="${d.id}">${esc(d.nama)}`).join("")}</select>
<select id="fs" onchange="refresh()"><option value="">Semua status<option>Menunggu<option>Dipanggil<option>Selesai<option>Batal</select></div><div id="live">${LIVE.antri()}</div></div>`;
async function batal(id) { if (await act("antrian_batal", { id })) { render(); toast("Antrian dibatalkan"); } }

/* ---------- Akun Staf (Kasir dan Apoteker), khusus admin ---------- */
PG.staf = () => `<div class="panel"><button class="b" onclick="formStaf(0)">Tambah akun staf</button><p class="mu">Kasir menerima pembayaran. Apoteker menyiapkan resep dan mengelola stok obat. Admin menentukan password awalnya.</p>
${D.staf.map(x => `<div class="drow"><div><b>${esc(x.nama)}</b> <span class="bd">${x.role}</span>${x.pass ? "" : ` <span class="bd amb">Password belum diatur</span>`}</div><div><button class="b2" onclick="formStaf(${x.id})">Ubah</button><button class="b2" onclick="konfirm('Hapus akun staf ini?','delStaf(${x.id})')">Hapus</button></div></div>`).join("") || "<p class='mu'>Belum ada akun staf.</p>"}</div>`;
function formStaf(id) {
  const x = id ? D.staf.find(s => s.id == id) : {};
  modal(`<h3>${id ? "Ubah" : "Tambah"} akun staf</h3><label>Nama</label><input id="sn" value="${esc(x.nama || "")}"><label>Peran</label><select id="sr"><option ${x.role == "Kasir" ? "selected" : ""}>Kasir<option ${x.role == "Apoteker" ? "selected" : ""}>Apoteker</select>
  <label>Password ${id ? "(kosongkan jika tidak diubah)" : "awal (minimal 6 karakter)"}</label><input id="sp" type="password" autocomplete="new-password"><button class="b" onclick="simpanStaf(${id})">Simpan</button><span id="err" class="err"></span>`);
}
async function simpanStaf(id) {
  if (!val("sn")) return fail("Nama wajib diisi.");
  const pw = $("sp").value; if ((!id && pw.length < 6) || (pw && pw.length < 6)) return fail("Password minimal 6 karakter.");
  if (await act("staf_simpan", { id, nama: val("sn"), role: $("sr").value, password: pw })) { closeModal(); render(); toast("Akun staf disimpan"); }
}
async function delStaf(id) { if (await act("staf_hapus", { id })) { render(); toast("Akun staf dihapus"); } }

/* ---------- Stok Obat: cari, ubah, stok masuk, kedaluwarsa (Admin dan Apoteker) ---------- */
const oList = () => {
  const q = ($("oq") || {}).value || "", low = $("ol") && $("ol").checked;
  return D.o.filter(o => o.nama.toLowerCase().includes(q.toLowerCase()) && (!low || obatMenipis(o) || statusExp(o))).map(o => {
    const e = statusExp(o);
    return `<div class="drow"><div style="flex:1;min-width:200px"><b>${esc(o.nama)}</b> ${obatMenipis(o) ? `<span class="bd amb">Menipis</span>` : ""} ${e == "lewat" ? `<span class="bd red">Kedaluwarsa</span>` : e == "segera" ? `<span class="bd amb">Segera kedaluwarsa</span>` : ""}<br><small class="mu">${rp(o.harga)} per unit - stok ${o.stok} (minimum ${o.smin})${o.exp ? " - kedaluwarsa " + o.exp : ""}</small><div class="bar"><i style="width:${Math.min(100, o.stok / Math.max(1, o.smin * 3) * 100)}%"></i></div></div><div><button class="b2" onclick="formMasuk(${o.id})">Stok masuk</button><button class="b2" onclick="formO(${o.id})">Ubah</button><button class="b2" onclick="konfirm('Hapus obat ini?','delO(${o.id})')">Hapus</button></div></div>`;
  }).join("") || "<p class='mu'>Tidak ada obat yang cocok.</p>";
};
PG.obat = () => `<div class="panel"><div class="row"><input id="oq" placeholder="Cari obat..." oninput="$('ol2').innerHTML=oList()"><label style="align-self:center;margin:0"><input type="checkbox" id="ol" style="width:auto" onchange="$('ol2').innerHTML=oList()"> Menipis atau kedaluwarsa saja</label><div><button class="b" onclick="formO(0)">Tambah obat</button> <button class="b2" onclick="riwayatMasuk()">Riwayat stok masuk</button></div></div></div><div class="panel" id="ol2">${oList()}</div>`;
function formO(id) {
  const o = id ? find(D.o, id) : { smin: 20 };
  modal(`<h3>${id ? "Ubah" : "Tambah"} obat</h3><label>Nama obat</label><input id="on" value="${esc(o.nama || "")}"><div class="row"><div><label>Stok</label><input id="os" type="number" value="${o.stok ?? ""}"></div><div><label>Batas stok minimum</label><input id="om" type="number" value="${o.smin}"></div></div>
  <div class="row"><div><label>Harga satuan (Rp)</label><input id="oh" type="number" value="${o.harga || ""}"></div><div><label>Tanggal kedaluwarsa</label><input id="oe" type="date" value="${o.exp || ""}"></div></div><button class="b" onclick="simpanO(${id})">Simpan</button><span id="err" class="err"></span>`);
}
async function simpanO(id) {
  if (!val("on") || val("os") === "" || +val("os") < 0 || !(+val("oh") > 0) || val("om") === "" || +val("om") < 0) return fail("Nama, stok, batas minimum, dan harga wajib diisi dengan benar.");
  if (await act("obat_simpan", { id, nama: val("on"), stok: +val("os"), harga: +val("oh"), smin: +val("om"), exp: val("oe") })) { closeModal(); render(); toast("Data obat disimpan"); }
}
function formMasuk(id) {
  const o = find(D.o, id);
  modal(`<h3>Stok masuk: ${esc(o.nama)}</h3><p class="mu">Stok saat ini ${o.stok}</p><label>Jumlah masuk</label><input id="mj" type="number" min="1" value="10"><label>Tanggal kedaluwarsa batch ini (opsional)</label><input id="me" type="date"><label>Catatan (mis. nomor faktur)</label><input id="mc"><button class="b" onclick="simpanMasuk(${id})">Catat stok masuk</button><span id="err" class="err"></span>`);
}
async function simpanMasuk(id) {
  if (!(+val("mj") >= 1)) return fail("Jumlah harus 1 atau lebih.");
  if (await act("stok_masuk", { id, jumlah: +val("mj"), exp: val("me"), catatan: val("mc") })) { closeModal(); render(); toast("Stok masuk dicatat"); }
}
function riwayatMasuk() {
  modal(`<h3>Riwayat stok masuk (30 terakhir)</h3>` + tbl(["Tanggal", "Obat", "Jumlah", "Oleh", "Catatan"], D.sm.map(x => `<tr><td>${x.tanggal}<td>${esc(find(D.o, x.obat_id).nama)}<td>+${x.jumlah}<td>${esc(x.oleh)}<td>${esc(x.catatan)}`)));
}
async function delO(id) { if (await act("obat_hapus", { id })) { render(); toast("Obat dihapus"); } }

/* ---------- Jejak Audit (khusus admin) ---------- */
const LABEL_AUDIT = { rekam_koreksi: "Koreksi rekam medis", profil_ubah: "Ubah profil (alergi/gol. darah)", privasi_setuju: "Setuju kebijakan privasi", reset_password_admin: "Reset password oleh admin", reset_password_mandiri: "Reset password mandiri", kode_pulih_baru: "Kode pemulihan baru", pasien_ubah_admin: "Data pasien diubah admin" };
function ringkasAudit(a) {
  let r = {}; try { r = JSON.parse(a.rincian || "{}"); } catch (e) { }
  if (a.aksi == "rekam_koreksi") return "Alasan: " + (r.alasan || "-") + ". Diubah: " + Object.keys(r.perubahan || {}).join(", ");
  if (a.aksi == "profil_ubah") return Object.entries(r).map(([k, v]) => k + ": " + (v[0] || "(kosong)") + " -> " + (v[1] || "(kosong)")).join("; ");
  if (a.aksi == "pasien_ubah_admin") return "Bidang: " + (r.bidang || []).join(", ");
  if (a.aksi == "privasi_setuju") return "Versi " + (r.versi || "-") + " (" + (r.saat || "-") + ")";
  return "";
}
PG.audit = () => `<div class="panel"><h3>Jejak audit (100 kejadian terakhir)</h3><p class="mu">Mencatat koreksi rekam medis, perubahan data penting pasien, persetujuan privasi, dan reset password. NIK dan isi rekam medis lengkap tidak disalin ke sini.</p>${tbl(["Waktu", "Oleh", "Kejadian", "Pasien/Rekam", "Rincian"], D.audit.map(a => `<tr><td>${esc(a.waktu)}<td>${esc(a.oleh)} (${esc(a.peran)})<td>${esc(LABEL_AUDIT[a.aksi] || a.aksi)}<td>${a.objek == "pasien" ? esc(find(D.p, a.objek_id).nama) : "Rekam #" + a.objek_id}<td style="white-space:normal">${esc(ringkasAudit(a))}`))}</div>`;
