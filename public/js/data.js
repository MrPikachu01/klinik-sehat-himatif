/* data.js - fungsi bantu (data berasal dari server lewat api.js) */
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
let D = { p: [], d: [], o: [], a: [], r: [], b: [], npas: 0 }; // diisi dari server (/api/state)

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rp = n => "Rp" + Number(n).toLocaleString("id-ID");
const dayAgo = n => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }; // tanggal lokal, bukan UTC
const today = () => dayAgo(0);
const find = (arr, id) => arr.find(x => x.id == id) || { nama: "-" };
const umur = t => Math.floor((Date.now() - new Date(t)) / 31557600000);
const byPri = (a, b) => (a.pri == "Darurat" ? 0 : 1) - (b.pri == "Darurat" ? 0 : 1) || a.id - b.id;
const badge = s => `<span class="bd ${s == "Darurat" ? "red" : s == "Selesai" || s == "Lunas" ? "grn" : s == "Dipanggil" ? "amb" : ""}">${s}</span>`;
const tbl = (head, rows) => `<div class="tw"><table><tr>${head.map(h => `<th>${h}`).join("")}${rows.join("") || `<tr><td colspan="${head.length}" class="mu">Belum ada data.`}</table></div>`;

function modal(h) { $("m").innerHTML = `<div class="bx">${h}<p class="noprint"><button class="b2" onclick="closeModal()">Tutup</button></p></div>`; $("m").style.display = "flex"; }
function closeModal() { $("m").style.display = "none"; }
function toast(t, ms) { const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), ms || 2500); }

/* ---------- Fungsi bantu tambahan: konfirmasi, validasi, unduh ---------- */
const val = i => $(i).value.trim();
const fail = m => { (document.querySelector("#m #err") || $("err")).textContent = m; };
function konfirm(pesan, kode) { modal(`<h3>Konfirmasi</h3><p>${pesan}</p><button class="b" onclick="${kode};closeModal()">Ya, lanjutkan</button>`); }
function unduh(nama, isi, tipe) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([isi], { type: tipe })); a.download = nama; a.click(); }
function csv(rows) { return rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n"); }

/* Validasi dan pengambilan data form pasien (dipakai admin dan pendaftaran akun) */
function cekPasien(id) {
  if (!/^\d{16}$/.test(val("nik"))) return "NIK harus 16 digit angka.";
  if (D.p.some(p => p.nik == val("nik") && p.id != id)) return "NIK sudah terdaftar. Silakan login.";
  if (!val("nm") || !val("tl")) return "Nama dan tanggal lahir wajib diisi.";
  if (new Date(val("tl")) > new Date()) return "Tanggal lahir tidak boleh di masa depan.";
  if (val("hp") && !/^\d{9,14}$/.test(val("hp"))) return "No. HP harus 9 sampai 14 digit angka.";
  return "";
}
const dataPasien = () => ({ nik: val("nik"), nama: val("nm"), tl: val("tl"), gol: val("gol"), hp: val("hp"), alergi: val("alg"), al: val("al") });
