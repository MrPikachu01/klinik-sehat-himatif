/* tv.js - layar ruang tunggu: nomor yang dipanggil, antrian berikut, dan suara panggilan (Web Speech) */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ANG = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
  let ac = null, prev = null;

  function baca(no) { const m = String(no).match(/^([A-Z])-(\d+)$/); return m ? m[1] + ", " + m[2].split("").map(d => ANG[+d]).join(" ") : no; }
  function bunyi() {
    if (!ac) return; const t = ac.currentTime;
    [784, 988, 1175].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + i * .18); g.gain.exponentialRampToValueAtTime(.3, t + i * .18 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .18 + .5); o.connect(g); g.connect(ac.destination); o.start(t + i * .18); o.stop(t + i * .18 + .55); });
  }
  function umumkan(d) {
    bunyi();
    if (!window.speechSynthesis || !ac) return;
    const u = new SpeechSynthesisUtterance("Nomor antrian " + baca(d.now.no) + ". Silakan menuju ruang dokter " + d.nama.replace(/^dr\.?\s*/i, "") + ".");
    u.lang = "id-ID"; u.rate = .85; setTimeout(() => speechSynthesis.speak(u), 900);
  }
  window.aktifkanSuara = function () {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) { }
    if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    $("izin").style.display = "none"; bunyi();
  };

  function gambar(data) {
    const baru = {};
    data.d.forEach(d => { const k = d.now ? d.now.no + "|" + d.now.pada : ""; if (prev && prev[d.id] !== undefined && prev[d.id] !== k && d.now) { baru[d.id] = true; umumkan(d); } });
    prev = {}; data.d.forEach(d => { prev[d.id] = d.now ? d.now.no + "|" + d.now.pada : ""; });
    $("isi").innerHTML = data.d.map(d => `<section class="kartu ${d.praktik ? "" : "libur"} ${baru[d.id] ? "baru" : ""}"><h2>${esc(d.nama)}</h2><div class="sp">${esc(d.sp)}${d.praktik ? "" : " - tidak praktik hari ini"}</div>
      <small>Sedang dipanggil</small><div class="no ${d.now ? "" : "kosong"}">${d.now ? esc(d.now.no) : "--"}</div>
      <div class="menunggu">${d.menunggu} menunggu</div><div class="next"><small>Berikutnya</small><br>${d.next.length ? d.next.map(n => `<span>${esc(n)}</span>`).join("") : "<span style='opacity:.5'>-</span>"}</div></section>`).join("") || "<p>Belum ada dokter terdaftar.</p>";
  }
  async function ambil() {
    try { const r = await fetch("api/tv", { cache: "no-store" }); const j = await r.json(); if (j.ok) { gambar(j); $("status").textContent = ""; } }
    catch (e) { $("status").textContent = "Menyambungkan ulang..."; }
  }
  setInterval(() => { const n = new Date(); $("jam").textContent = n.toLocaleTimeString("id-ID"); $("tgl").textContent = n.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }, 1000);
  ambil(); setInterval(ambil, 4000);
})();
