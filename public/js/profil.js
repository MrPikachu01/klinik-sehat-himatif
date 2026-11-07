/* profil.js - Profil Saya, kebijakan privasi, pemulihan akun (kode pemulihan), dan notifikasi push untuk pasien */

/* Teks kebijakan privasi: contoh bawaan. Sesuaikan dengan kebijakan resmi klinik dan ketentuan perlindungan data pribadi yang berlaku. */
function kebijakanHtml() {
  return `<div class="kebijakan"><b>Kebijakan Privasi Klinik Sehat (versi 1.0)</b><ol>
  <li><b>Data yang dikumpulkan:</b> identitas (NIK, nama, tanggal lahir, golongan darah, alamat, nomor HP), data alergi, antrian, rekam medis (hasil pemeriksaan, diagnosis, resep), dan data pembayaran.</li>
  <li><b>Tujuan:</b> pelayanan kesehatan, pengaturan antrian, penyiapan obat, pembayaran, dan pelaporan internal klinik.</li>
  <li><b>Yang dapat mengakses:</b> Anda sendiri; dokter yang memeriksa Anda; apoteker (resep dan alergi); kasir (tagihan); dan admin klinik. Layar TV ruang tunggu hanya menampilkan nomor antrian.</li>
  <li><b>Keamanan:</b> password disimpan dalam bentuk terenkripsi (hash), akses dibatasi per peran, dan setiap koreksi rekam medis serta perubahan penting dicatat.</li>
  <li><b>Hak Anda:</b> melihat dan memperbarui data kontak dan alergi di menu Profil Saya, meminta koreksi data identitas atau rekam medis melalui admin atau dokter, dan menarik persetujuan dengan menghubungi admin klinik.</li>
  <li><b>Penyimpanan:</b> data disimpan selama diperlukan untuk pelayanan dan sesuai ketentuan yang berlaku bagi klinik.</li>
  <li><b>Kontak:</b> hubungi admin klinik untuk pertanyaan atau permintaan terkait data Anda.</li></ol></div>`;
}
function bacaKebijakan() { modal(`<h3>Kebijakan Privasi</h3>${kebijakanHtml()}`); }

/* ---------- gerbang persetujuan (pasien yang belum menyetujui, mis. dibuat admin atau akun lama) ---------- */
PG.privasi = () => `<div class="panel"><h3>Persetujuan kebijakan privasi</h3><p class="mu">Sebelum memakai layanan, mohon baca dan setujui kebijakan privasi berikut.</p>${kebijakanHtml()}<button class="b" onclick="setujuPrivasi()">Saya setuju dan lanjut</button> <button class="b2" onclick="logout()">Keluar</button></div>`;
async function setujuPrivasi() { if (await act("privasi_setuju")) { render(); toast("Terima kasih, persetujuan dicatat"); } }

/* ---------- kode pemulihan dan lupa password ---------- */
function modalKode(kode, judul) {
  modal(`<h3>${esc(judul)}</h3><p>Simpan <b>kode pemulihan</b> ini di tempat aman (foto atau catat). Kode dipakai jika Anda lupa password, dan <b>hanya ditampilkan sekali</b>.</p><div class="tk" style="font-size:30px;letter-spacing:.08em">${esc(kode)}</div><button class="b2" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(kode)}').then(()=>toast('Kode disalin'))">Salin kode</button> <button class="b2 noprint" onclick="window.print()">Cetak</button>`);
}
function formLupa() {
  modal(`<h3>Lupa password</h3><p class="mu">Masukkan NIK, tanggal lahir, dan <b>kode pemulihan</b> yang Anda terima saat mendaftar. Jika kode hilang, hubungi admin klinik untuk mereset password.</p>
  <label>NIK</label><input id="lp_nik" inputmode="numeric" maxlength="16"><label>Tanggal lahir</label><input id="lp_tl" type="date"><label>Kode pemulihan</label><input id="lp_kode" placeholder="XXXXX-XXXXX" autocomplete="off" style="text-transform:uppercase">
  <label>Password baru (minimal 6 karakter)</label><input id="lp_p1" type="password" autocomplete="new-password"><label>Ulangi password baru</label><input id="lp_p2" type="password" autocomplete="new-password"><button class="b" onclick="kirimLupa()">Ganti password</button><span id="err" class="err"></span>`);
}
async function kirimLupa() {
  if (!/^\d{16}$/.test(val("lp_nik")) || !val("lp_tl") || !val("lp_kode")) return fail("NIK, tanggal lahir, dan kode pemulihan wajib diisi.");
  if ($("lp_p1").value.length < 6) return fail("Password baru minimal 6 karakter.");
  if ($("lp_p1").value != $("lp_p2").value) return fail("Konfirmasi password tidak sama.");
  try { const j = await api("auth?do=lupa_password", { nik: val("lp_nik"), tl: val("lp_tl"), kode: val("lp_kode"), baru: $("lp_p1").value }); modalKode(j.kode_pulih, "Password berhasil diganti. Kode baru Anda"); toast("Silakan masuk dengan password baru", 4000); }
  catch (e) { fail(e.message); }
}
function formKodeBaru() {
  modal(`<h3>Buat kode pemulihan baru</h3><p class="mu">Kode lama tidak akan berlaku lagi. Masukkan password Anda untuk melanjutkan.</p><label>Password</label><input id="kb_pw" type="password"><button class="b" onclick="kodeBaru()">Buat kode baru</button><span id="err" class="err"></span>`);
}
async function kodeBaru() { const j = await act("pulih_kode_baru", { password: $("kb_pw").value }); if (j) modalKode(j.kode_pulih, "Kode pemulihan baru"); }

/* ---------- Profil Saya ---------- */
PG.profil = () => {
  const p = D.p[0]; if (!p) return `<div class="panel">Data profil tidak ditemukan.</div>`;
  setTimeout(cekStatusPush, 0);
  return `<div class="panel"><h3>Data saya</h3><p class="mu">NIK, nama, dan tanggal lahir tidak bisa diubah sendiri. Hubungi admin klinik jika ada kesalahan.</p>
  <div class="row"><div><label>NIK</label><input value="${esc(p.nik)}" disabled></div><div><label>Nama</label><input value="${esc(p.nama)}" disabled></div><div><label>Tanggal lahir</label><input value="${esc(p.tl)}" disabled></div></div></div>
  <div class="panel"><h3>Data yang bisa Anda ubah</h3><div class="row"><div><label>No. HP</label><input id="pf_hp" value="${esc(p.hp)}" inputmode="tel"></div><div><label>Golongan darah</label><select id="pf_gol">${["A", "B", "AB", "O"].map(g => `<option ${p.gol == g ? "selected" : ""}>${g}`).join("")}</select></div></div>
  <label>Alamat</label><input id="pf_al" value="${esc(p.al)}"><label>Alergi obat</label><input id="pf_alg" value="${esc(p.alergi)}" placeholder="Kosongkan jika tidak ada"><p class="mu">Alergi ditampilkan kepada dokter dan apoteker. Perubahan alergi dicatat di jejak audit.</p>
  <button class="b" onclick="simpanProfil()">Simpan profil</button><span id="err" class="err"></span></div>
  <div class="panel"><h3>Keamanan akun</h3><p class="mu">Ubah password di menu Pengaturan. Kode pemulihan dipakai jika Anda lupa password.</p><button class="b2" onclick="go('set')">Ubah password</button> <button class="b2" onclick="formKodeBaru()">Buat kode pemulihan baru</button></div>
  <div class="panel"><h3>Notifikasi antrian</h3><p class="mu">Dapatkan pemberitahuan giliran Anda <b>walau halaman ini ditutup</b>. ${PUB.vapid ? "" : "Fitur ini aktif setelah admin mengatur kunci notifikasi di server."}</p><span id="pushst" class="mu"></span><div><button class="b2" id="pushon" onclick="aktifkanPush()" ${PUB.vapid ? "" : "disabled"}>Aktifkan notifikasi</button> <button class="b2" id="pushoff" onclick="matikanPush()" style="display:none">Matikan notifikasi</button></div></div>
  <div class="panel"><h3>Privasi</h3><p class="mu">Anda menyetujui kebijakan privasi pada ${esc(p.privasi || "-")}.</p><button class="b2" onclick="bacaKebijakan()">Baca kebijakan privasi</button></div>`;
};
async function simpanProfil() {
  if (val("pf_hp") && !/^\d{9,14}$/.test(val("pf_hp"))) return fail("No. HP harus 9 sampai 14 digit angka.");
  if (await act("profil_simpan", { hp: val("pf_hp"), al: val("pf_al"), alergi: val("pf_alg"), gol: $("pf_gol").value })) { render(); toast("Profil disimpan"); }
}

/* ---------- Notifikasi push (tetap sampai walau tab ditutup) ---------- */
const pushDidukung = () => typeof navigator != "undefined" && "serviceWorker" in navigator && typeof window != "undefined" && "PushManager" in window && !!window.Notification;
const urlB64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...b].map(c => c.charCodeAt(0))); };
async function cekStatusPush() {
  const st = $("pushst"); if (!st) return;
  if (!pushDidukung()) { st.textContent = "Browser ini tidak mendukung notifikasi push."; return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration("sw.js"), sub = reg && await reg.pushManager.getSubscription();
    st.textContent = sub ? "Status: aktif di perangkat ini. " : "Status: belum aktif. ";
    $("pushoff").style.display = sub ? "" : "none"; $("pushon").style.display = sub ? "none" : "";
  } catch (e) { }
}
async function aktifkanPush() {
  if (!PUB.vapid) return toast("Server belum mengaktifkan notifikasi push");
  if (!pushDidukung()) return toast("Browser ini tidak mendukung notifikasi push");
  try {
    if (await Notification.requestPermission() != "granted") return toast("Izin notifikasi ditolak");
    const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(PUB.vapid) }), j = sub.toJSON();
    if (await act("push_daftar", { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth })) { toast("Notifikasi aktif, juga saat halaman ditutup", 4000); cekStatusPush(); }
  } catch (e) { toast("Gagal mengaktifkan notifikasi: " + e.message, 5000); }
}
async function matikanPush() {
  try { const reg = await navigator.serviceWorker.getRegistration("sw.js"), sub = reg && await reg.pushManager.getSubscription(); if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); await act("push_hapus", { endpoint: ep }); } toast("Notifikasi dimatikan"); cekStatusPush(); } catch (e) { toast("Gagal mematikan notifikasi"); }
}
