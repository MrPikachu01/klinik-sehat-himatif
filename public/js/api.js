/* api.js - komunikasi dengan backend PHP (sesi cookie + token CSRF) */
let CSRF = "", PUB = { d: [], aktif: 0, pasien: 0, adm: false };

async function api(path, body) {
  const r = await fetch("api/" + path, { method: body ? "POST" : "GET", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF": CSRF }, body: body ? JSON.stringify(body) : undefined });
  let j; try { j = await r.json(); } catch (e) { throw new Error("Server tidak merespons dengan benar. Periksa koneksi internet lalu coba lagi."); }
  if (!j.ok) { const e = new Error(j.error || "Terjadi kesalahan"); e.kode = j.kode; throw e; }
  return j;
}
async function muat() { const j = await api("state"); D = j.state; if (j.csrf) CSRF = j.csrf; }
async function act(nama, data) { // kirim aksi ke server, lalu muat ulang data
  try { const j = await api("action?do=" + nama, data || {}); await muat(); return j; }
  catch (e) {
    if (e.kode == "LOGIN") { U = null; render(); toast("Sesi berakhir, silakan login lagi"); return null; }
    if ($("err") || document.querySelector("#m #err")) fail(e.message); else toast(e.message);
    return null;
  }
}
async function mulai() { // dipanggil saat halaman dibuka
  try { const j = await api("me"); CSRF = j.csrf; PUB = j.pub; if (j.me) { await muat(); U = j.me; P = MENU[U.role][0][0]; } }
  catch (e) { toast(e.message); }
}
