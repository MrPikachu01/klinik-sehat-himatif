/* tim.js - halaman Tentang: profil tim pengelola, foto tim, dan keterangan sistem.
   EDIT BAGIAN TIM DI BAWAH: nama, peran, dan nama berkas foto. Foto diletakkan di public/assets/tim/
   Halaman dibuka dari Pengaturan > Tentang, atau lewat tautan di halaman login (alamat #tentang). Tidak masuk menu utama. */
const TIM = {
  judul: "Tim Pengelola Klinik Sehat",
  deskripsi: "Sistem Informasi Klinik Sehat dikembangkan dan dikelola oleh Indra Wahyudi dan Tim TI Tahun 2026, Prodi Teknologi Informasi.",
  keteranganFoto: "Tim pengelola Klinik Sehat Teknologi Informasi, Tahun 2026",
  fotoTim: "assets/tim/tim.jpg",                 // foto bersama (kosongkan "" jika tidak dipakai)
  anggota: [
    { nama: "Indra Wahyudi", peran: "Pengembang sistem", foto: "assets/tim/indra.jpg", ket: "" }
    // Tambahkan anggota lain dengan format yang sama (jangan lupa koma di antara anggota):
    // , { nama: "Nama Anggota", peran: "Peran di tim", foto: "assets/tim/nama.jpg", ket: "Keterangan singkat (opsional)" }
  ],
  kontak: ""                                       // mis. "tim@klinik-anda.example" (opsional)
};

const inisial = n => String(n).trim().split(/\s+/).map(x => (x.match(/[\p{L}\p{N}]/u) || [""])[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();   // huruf pertama dari dua kata awal
function timHtml() {   // kartu anggota (foto, atau inisial jika foto belum ada)
  return `<div class="timgrid">${TIM.anggota.map(a => `<div class="timkartu"><div class="timav"><span>${esc(inisial(a.nama))}</span>${a.foto ? `<img src="${esc(a.foto)}" alt="${esc(a.nama)}" loading="lazy" onerror="this.remove()">` : ""}</div><b>${esc(a.nama)}</b><small class="mu">${esc(a.peran || "")}</small>${a.ket ? `<p class="mu" style="margin:6px 0 0;font-size:12px">${esc(a.ket)}</p>` : ""}</div>`).join("")}</div>`;
}
function tentangHtml() {
  const foto = TIM.fotoTim ? `<figure class="tn-fig"><img class="tn-foto" src="${esc(TIM.fotoTim)}" alt="${esc(TIM.keteranganFoto)}" onerror="this.parentNode.remove()"><figcaption class="mu">${esc(TIM.keteranganFoto)}</figcaption></figure>` : "";
  return `${foto}<h2>${esc(TIM.judul)}</h2><p>${esc(TIM.deskripsi)}</p>
  <h3>Anggota tim</h3>${timHtml()}${TIM.kontak ? `<p class="mu" style="margin-top:12px">Kontak: ${esc(TIM.kontak)}</p>` : ""}
  <h3>Tentang sistem</h3><p>Klinik Sehat adalah sistem informasi klinik untuk mengelola pendaftaran dan antrian pasien, janji temu, pemeriksaan dan rekam medis, resep dan stok obat, pembayaran, serta laporan. Sistem dipakai oleh lima peran: Admin, Dokter, Pasien, Kasir, dan Apoteker.</p>
  <h3>Teknologi</h3><p class="mu">Tampilan: HTML, CSS, JavaScript. Server: Python. Database: PostgreSQL. Hosting: Vercel.</p>
  <p class="mu" style="margin-top:22px;font-size:12px">Dikembangkan oleh Indra Wahyudi dan Tim TI Tahun 2026.</p>`;
}
function tampilTentang() {
  if (document.getElementById("tentangov")) return;
  const o = document.createElement("div"); o.id = "tentangov";
  o.innerHTML = `<div class="tn-top">${logo(36)}<div><b>Klinik Sehat</b><small>Tentang sistem dan tim pengelola</small></div><button class="b2" onclick="tutupTentang()">Tutup</button></div><div class="tn-isi">${tentangHtml()}</div>`;
  document.body.appendChild(o); if (document.body.style) document.body.style.overflow = "hidden";
  try { if (location.hash != "#tentang") history.replaceState(null, "", "#tentang"); } catch (e) { }
}
function tutupTentang(dariHash) {
  const o = document.getElementById("tentangov"); if (!o) return;
  o.remove(); if (document.body.style) document.body.style.overflow = "";
  if (!dariHash && typeof location != "undefined" && location.hash == "#tentang") { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { } }
}
const bukaTim = tampilTentang;   // nama lama, tetap bisa dipakai
if (typeof document != "undefined" && document.addEventListener) document.addEventListener("keydown", e => { if (e.key == "Escape") tutupTentang(); });
if (typeof window != "undefined" && window.addEventListener) window.addEventListener("hashchange", () => { if (location.hash == "#tentang") tampilTentang(); else tutupTentang(true); });
if (typeof location != "undefined" && location.hash == "#tentang") tampilTentang();
