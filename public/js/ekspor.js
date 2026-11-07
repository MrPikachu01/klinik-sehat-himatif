/* ekspor.js - berkas Excel (.xlsx), kuitansi PDF, grafik garis, terbilang, dan daftar ICD-10 (tanpa library luar) */

/* ---------- ZIP tanpa kompresi (dasar format .xlsx) ---------- */
const CRC_T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function zipSimpan(files) {
  const enc = new TextEncoder(), loc = [], cen = []; let off = 0;
  files.forEach(f => {
    const nm = enc.encode(f.name), d = enc.encode(f.data), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, 0, true); h.setUint16(12, 33, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    loc.push(new Uint8Array(h.buffer), nm, d); cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + d.length;
  });
  const cl = cen.reduce((s, x) => s + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
  const parts = [...loc, ...cen, new Uint8Array(e.buffer)], out = new Uint8Array(off + cl + 22); let p = 0;
  parts.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}

/* ---------- Excel (.xlsx) dengan banyak lembar ---------- */
const xe = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function kolom(i) { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
function xlsxBuat(lembar) { // lembar: [{ nama, rows: [[...], ...] }]; baris pertama dicetak tebal
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', RN = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const sheets = lembar.map(l => {
    const lebar = []; l.rows.forEach(r => r.forEach((v, i) => { lebar[i] = Math.min(40, Math.max(lebar[i] || 8, String(v).length + 2)); }));
    const cols = lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    const rows = l.rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
      const ref = kolom(ci) + (ri + 1), s = ri == 0 ? ' s="1"' : "";
      return typeof v == "number" && isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join("") + "</row>").join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
  });
  const n = lembar.length, ids = lembar.map((_, i) => i + 1);
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ids.map(i => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${RN}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS} xmlns:r="${RN}"><sheets>${lembar.map((l, i) => `<sheet name="${xe(l.nama.replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ids.map(i => `<Relationship Id="rId${i}" Type="${RN}/worksheet" Target="worksheets/sheet${i}.xml"/>`).join("")}<Relationship Id="rId${n + 1}" Type="${RN}/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x }))
  ];
  return zipSimpan(files);
}
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* ---------- PDF sederhana (teks, garis, kotak) ---------- */
function pdfBuat(halaman, lebar = 420, tinggi = 595) { // halaman: [[{t, x, y, s, b} | {g: [x1,y1,x2,y2]} | {k: [x,y,w,h]}]]
  const lat = s => String(s).replace(/[^\x20-\x7E\xA0-\xFF]/g, "?").replace(/([\\()])/g, "\\$1");
  const obj = [], tambah = s => { obj.push(s); return obj.length; };
  tambah("<< /Type /Catalog /Pages 2 0 R >>");
  const n = halaman.length, kid = halaman.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  tambah(`<< /Type /Pages /Kids [${kid}] /Count ${n} >>`);
  tambah("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  tambah("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  halaman.forEach((hal, i) => {
    const isi = hal.map(e => e.t !== undefined ? `BT /${e.b ? "F2" : "F1"} ${e.s || 11} Tf ${e.x} ${e.y} Td (${lat(e.t)}) Tj ET` : e.g ? `${e.g[0]} ${e.g[1]} m ${e.g[2]} ${e.g[3]} l S` : `${e.k.join(" ")} re S`).join("\n");
    tambah(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${lebar} ${tinggi}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    tambah(`<< /Length ${isi.length} >>\nstream\n0.8 w\n${isi}\nendstream`);
  });
  let out = "%PDF-1.4\n"; const off = [];
  obj.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xr = out.length;
  out += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
  const u = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255;
  return u;
}

/* ---------- Terbilang rupiah (bahasa Indonesia) ---------- */
const SAT = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilang(n) {
  n = Math.floor(n);
  if (n < 12) return SAT[n];
  if (n < 20) return terbilang(n - 10) + " belas";
  if (n < 100) return terbilang(Math.floor(n / 10)) + " puluh" + (n % 10 ? " " + terbilang(n % 10) : "");
  if (n < 200) return "seratus" + (n > 100 ? " " + terbilang(n - 100) : "");
  if (n < 1000) return terbilang(Math.floor(n / 100)) + " ratus" + (n % 100 ? " " + terbilang(n % 100) : "");
  if (n < 2000) return "seribu" + (n > 1000 ? " " + terbilang(n - 1000) : "");
  for (const [b, nama] of [[1e12, "triliun"], [1e9, "miliar"], [1e6, "juta"], [1e3, "ribu"]]) if (n >= b) return terbilang(Math.floor(n / b)) + " " + nama + (n % b ? " " + terbilang(n % b) : "");
}
const rupiahKata = n => (n ? terbilang(n) : "nol") + " rupiah";

/* ---------- Grafik garis SVG ---------- */
function grafikGaris(label, nilai, fmt) {
  fmt = fmt || (v => v);
  const W = 640, H = 200, L = 40, B = 28, T = 14, mx = Math.max(1, ...nilai), n = Math.max(1, nilai.length - 1);
  const x = i => L + (W - L - 10) * i / n, y = v => T + (H - T - B) * (1 - v / mx);
  const garis = [0, .5, 1].map(f => `<line x1="${L}" x2="${W - 10}" y1="${y(mx * f)}" y2="${y(mx * f)}" stroke="currentColor" opacity=".15"/><text x="${L - 6}" y="${y(mx * f) + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${fmt(Math.round(mx * f))}</text>`).join("");
  const pts = nilai.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const step = Math.ceil(label.length / 8);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;color:var(--fg)" role="img" aria-label="Grafik tren">${garis}<polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linejoin="round"/>` +
    nilai.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="var(--teal)"><title>${esc(label[i])}: ${fmt(v)}</title></circle>`).join("") +
    label.map((l, i) => i % step == 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">${esc(l)}</text>` : "").join("") + "</svg>";
}

/* ---------- Daftar ringkas ICD-10 untuk diagnosis umum di layanan primer (bukan seluruh ICD-10) ---------- */
const ICD = [["A01.0", "Demam tifoid"], ["A09", "Diare dan gastroenteritis"], ["A90", "Demam dengue"], ["A91", "Demam berdarah dengue"], ["B01.9", "Varisela (cacar air) tanpa komplikasi"], ["B34.9", "Infeksi virus, tidak spesifik"], ["B35.9", "Dermatofitosis (tinea)"], ["B86", "Skabies"],
  ["D50.9", "Anemia defisiensi besi"], ["E11.9", "Diabetes melitus tipe 2 tanpa komplikasi"], ["E66.9", "Obesitas"], ["E78.5", "Hiperlipidemia"], ["G43.9", "Migrain"], ["H10.9", "Konjungtivitis"], ["H66.9", "Otitis media"], ["I10", "Hipertensi esensial (primer)"],
  ["J00", "Nasofaringitis akut (common cold)"], ["J02.9", "Faringitis akut"], ["J03.9", "Tonsilitis akut"], ["J06.9", "Infeksi saluran napas atas akut (ISPA)"], ["J18.9", "Pneumonia"], ["J20.9", "Bronkitis akut"], ["J30.4", "Rinitis alergi"], ["J45.9", "Asma"],
  ["K02.9", "Karies gigi"], ["K04.0", "Pulpitis"], ["K05.1", "Gingivitis kronis"], ["K21.9", "Penyakit refluks gastroesofagus (GERD)"], ["K29.7", "Gastritis"], ["K30", "Dispepsia"], ["L08.9", "Infeksi kulit lokal"], ["L20.9", "Dermatitis atopik"], ["L30.9", "Dermatitis"],
  ["M10.9", "Gout (asam urat)"], ["M54.5", "Nyeri punggung bawah"], ["M79.1", "Mialgia (nyeri otot)"], ["N39.0", "Infeksi saluran kemih"], ["R05", "Batuk"], ["R10.4", "Nyeri perut"], ["R11", "Mual dan muntah"], ["R50.9", "Demam"], ["R51", "Sakit kepala"], ["Z00.0", "Pemeriksaan kesehatan umum"]];
