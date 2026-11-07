/* laporan.js - Laporan (filter periode, ekspor CSV) dan Pengaturan (tema, cadangan, reset) */

const bars = l => { const m = Math.max(1, ...l.map(x => x[1])); return l.map(x => `${esc(x[0])}: <b>${x[2] || x[1]}</b><div class="bar"><i style="width:${x[1] / m * 100}%"></i></div>`).join("") || "<p class='mu'>Belum ada data.</p>"; };
const tgBayar = b => b.tglb || b.tgl;
function lapBody(hari) {
  const since = +hari ? dayAgo(+hari - 1) : "";
  const r = D.r.filter(x => x.tgl >= since), lunas = D.b.filter(b => b.lunas && tgBayar(b) >= since), bl = D.b.filter(b => !b.lunas && b.tgl >= since);
  const dx = {}; r.forEach(x => dx[x.dx] = (dx[x.dx] || 0) + 1);
  const top = Object.entries(dx).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const metode = ["Tunai", "QRIS", "BPJS"].map(m => { const s = lunas.filter(b => b.metode == m).reduce((t, b) => t + b.total, 0); return [m, s, rp(s)]; });
  const n = +hari || 30, hr = Array.from({ length: n }, (_, i) => dayAgo(n - 1 - i)), lab = hr.map(h => h.slice(8) + "/" + h.slice(5, 7));
  const kun = hr.map(h => D.a.filter(a => a.tgl == h && a.st != "Batal").length), pen = hr.map(h => lunas.filter(b => tgBayar(b) == h).reduce((t, b) => t + b.total, 0));
  return `<div class="stats s3"><div>Kunjungan<b>${r.length}</b></div><div>Pendapatan lunas<b>${rp(lunas.reduce((s, b) => s + b.total, 0))}</b></div><div>Belum lunas<b>${rp(bl.reduce((s, b) => s + b.tarif + b.obat, 0))}</b></div></div>
  <div class="panel"><h3>Tren kunjungan per hari (${n} hari terakhir)</h3>${grafikGaris(lab, kun)}</div>
  <div class="panel"><h3>Tren pendapatan per hari</h3>${grafikGaris(lab, pen, v => v >= 1000 ? Math.round(v / 1000) + "rb" : v)}</div>
  <div class="panel"><h3>Lima diagnosis terbanyak</h3>${bars(top)}</div><div class="panel"><h3>Kunjungan per dokter</h3>${bars(D.d.map(d => [d.nama, r.filter(x => x.dok == d.id).length]))}</div><div class="panel"><h3>Pendapatan per metode bayar</h3>${bars(metode)}</div>`;
}
PG.laporan = () => `<div class="panel"><label>Periode</label><select onchange="$('lap').innerHTML=lapBody(this.value)"><option value="7">7 hari terakhir<option value="30">30 hari terakhir<option value="0">Semua data (grafik 30 hari)</select>
<button class="b" onclick="exportExcel()">Unduh Excel (.xlsx)</button><button class="b2" onclick="exportCSV()">Rekam medis (CSV)</button><button class="b2" onclick="exportKeu()">Keuangan (CSV)</button></div><div id="lap">${lapBody(7)}</div>`;
function exportExcel() { // tiga lembar: rekam medis, keuangan, kunjungan harian
  const rm = [["Tanggal", "Pasien", "Dokter", "Kode ICD-10", "Diagnosis", "Tindakan", "TD", "Suhu", "BB (kg)", "TB (cm)", "Istirahat (hari)", "Rujukan", "Resep"], ...D.r.map(r => [r.tgl, find(D.p, r.pas).nama, find(D.d, r.dok).nama, r.icd, r.dx, r.tin, r.td, r.suhu, r.bb, r.tb, r.sakit, r.ruj, r.res.map(o => find(D.o, o.id).nama + " x" + o.jml).join("; ")])];
  const kb = [["Tanggal bayar", "Pasien", "Konsultasi", "Obat", "Metode", "Total dibayar", "Status"], ...D.b.map(b => [tgBayar(b), find(D.p, b.pas).nama, b.tarif, b.obat, b.metode, b.total, b.lunas ? "Lunas" : "Belum"])];
  const hr = Array.from({ length: 30 }, (_, i) => dayAgo(29 - i)), kh = [["Tanggal", "Jumlah kunjungan", "Pendapatan (Rp)"], ...hr.map(h => [h, D.a.filter(a => a.tgl == h && a.st != "Batal").length, D.b.filter(b => b.lunas && tgBayar(b) == h).reduce((t, b) => t + b.total, 0)])];
  unduh("laporan-klinik-sehat-" + today() + ".xlsx", xlsxBuat([{ nama: "Rekam Medis", rows: rm }, { nama: "Keuangan", rows: kb }, { nama: "Kunjungan 30 Hari", rows: kh }]), MIME_XLSX);
}
function exportCSV() { unduh("rekam-medis.csv", csv([["Tanggal", "Pasien", "Dokter", "Diagnosis", "Tindakan"], ...D.r.map(r => [r.tgl, find(D.p, r.pas).nama, find(D.d, r.dok).nama, r.dx, r.tin])]), "text/csv"); }
function exportKeu() { unduh("keuangan.csv", csv([["Tanggal", "Pasien", "Konsultasi", "Obat", "Metode", "Total", "Status"], ...D.b.map(b => [tgBayar(b), find(D.p, b.pas).nama, b.tarif, b.obat, b.metode, b.total, b.lunas ? "Lunas" : "Belum"])]), "text/csv"); }

PG.set = () => {
  let h = `<div class="panel"><h3>Tema tampilan</h3><select onchange="setTema(this.value)"><option value="">Ikuti perangkat<option value="light">Terang<option value="dark">Gelap</select></div>`;
  h += `<div class="panel"><h3>Ubah password</h3><input id="po" type="password" placeholder="Password lama"><input id="pn" type="password" placeholder="Password baru (minimal 6 karakter)"><button class="b" onclick="ubahPass()">Simpan password</button><span id="err" class="err"></span></div>`;
  if (U.role == "Admin") h += `<div class="panel"><h3>Data pasien dan transaksi</h3><p class="mu">Kosongkan data contoh sebelum klinik dipakai pasien sungguhan. Pasien lalu mendaftar akun sendiri. Data dokter, jadwal, dan obat tetap.</p>
  <button class="b2" onclick="konfirm('Semua pasien, antrian, rekam medis, dan tagihan akan dihapus.','kosongkanPasien()')">Kosongkan data pasien</button></div>
  <div class="panel"><h3>Cadangan data</h3><p class="mu">Data tersimpan di database MySQL server. Unduh salinan data (JSON) untuk arsip.</p><button class="b2" onclick="backup()">Unduh salinan data (JSON)</button>
  </div>`;
  h += `<div class="panel"><h3>Kebijakan privasi</h3><p class="mu">Bagaimana data pasien dikumpulkan, dipakai, dan dilindungi.</p><button class="b2" onclick="bacaKebijakan()">Baca kebijakan privasi</button></div>`;
  h += `<div class="panel"><h3>Tentang</h3><div style="display:flex;gap:12px;align-items:center">${logo(44)}<div><b>Klinik Sehat</b><br><small class="mu">Prodi Teknologi Informasi</small></div></div><p style="margin:14px 0 0"><span class="mu">Pengembang sistem</span><br><b>Indra Wahyudi dan Tim TI Tahun 2026</b></p><button class="b2" style="margin-top:12px" onclick="tampilTentang()">Buka halaman Tentang (profil tim)</button></div>`;
  return h;
};
async function kosongkanPasien() { if (await act("pasien_kosongkan")) { render(); toast("Data pasien dikosongkan"); } }
async function ubahPass() {
  if ($("pn").value.length < 6) return fail("Password baru minimal 6 karakter.");
  if (await act("ubah_password", { lama: $("po").value, baru: $("pn").value })) { $("po").value = $("pn").value = ""; fail(""); toast("Password diubah"); }
}
function setTema(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("klinik_tema", t); } catch (e) { }
}
function backup() { unduh("cadangan-klinik-sehat.json", JSON.stringify(D), "application/json"); }
