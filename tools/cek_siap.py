"""cek_siap.py - memeriksa kesiapan proyek sebelum dijalankan atau di-deploy.
Pemakaian:  python tools/cek_siap.py
Jika DATABASE_URL ada (di lingkungan atau file .env), koneksi dan tabel database ikut diperiksa."""
import json, os, py_compile, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))
gagal = 0

def baris(status, teks, saran=""):
    global gagal
    if status == "GAGAL": gagal += 1
    print(f"[{status:<5}] {teks}" + (f"\n        -> {saran}" if saran and status != "OK" else ""))

def muat_env():
    f = os.path.join(ROOT, ".env")
    if os.path.isfile(f):
        for b in open(f, encoding="utf-8"):
            b = b.strip()
            if b and not b.startswith("#") and "=" in b:
                k, v = b.split("=", 1); v = v.strip().strip('"').strip("'")
                if v: os.environ.setdefault(k.strip(), v)
muat_env()

print("== 1. Berkas proyek ==")
wajib = ["vercel.json", "requirements.txt", "api/index.py", "api/_aksi.py", "api/_lib.py", "api/_push.py", "database/schema.sql", "public/index.html", "public/tv.html", "public/sw.js", "public/assets/himatif.png", "public/assets/logo.svg"]
for f in wajib:
    ada = os.path.isfile(os.path.join(ROOT, f))
    baris("OK" if ada else "GAGAL", f, "" if ada else "Berkas hilang. Pastikan seluruh isi proyek ikut diunggah, dan vercel.json berada di paling luar.")

print("\n== 2. Konfigurasi Vercel ==")
try:
    v = json.load(open(os.path.join(ROOT, "vercel.json"), encoding="utf-8"))
    baris("OK" if v.get("outputDirectory") == "public" else "GAGAL", "vercel.json: outputDirectory = public", "Isi outputDirectory dengan \"public\".")
    baris("OK" if any("/api/" in r.get("source", "") for r in v.get("rewrites", [])) else "GAGAL", "vercel.json: rute /api/* diarahkan ke fungsi Python", "Tambahkan rewrite untuk /api/(.*).")
except Exception as e:
    baris("GAGAL", "vercel.json tidak bisa dibaca: " + str(e))

print("\n== 3. Kode Python dan berkas yang dirujuk halaman ==")
for f in ["api/index.py", "api/_aksi.py", "api/_lib.py", "api/_push.py", "dev_server.py"]:
    try: py_compile.compile(os.path.join(ROOT, f), doraise=True); baris("OK", "sintaks " + f)
    except py_compile.PyCompileError as e: baris("GAGAL", "sintaks " + f, str(e))
html = open(os.path.join(ROOT, "public", "index.html"), encoding="utf-8").read()
for ref in re.findall(r'(?:src|href)="((?:js|css|assets)/[^"]+)"', html):
    ada = os.path.isfile(os.path.join(ROOT, "public", ref)); baris("OK" if ada else "GAGAL", "index.html merujuk " + ref, "" if ada else "Berkas yang dirujuk tidak ada.")

print("\n== 4. Pengaturan lingkungan (Environment Variables) ==")
for nama, minim in (("SECRET_KEY", 32), ("SETUP_KEY", 8)):
    nilai = os.environ.get(nama, "")
    if not nilai: baris("INFO", nama + " belum diatur di lingkungan ini", "Di Vercel wajib diisi (Settings > Environment Variables). Untuk uji lokal, dev_server.py mengisi nilai bawaan.")
    elif len(nilai) < minim: baris("GAGAL", f"{nama} terlalu pendek (minimal {minim} karakter)")
    else: baris("OK", nama + " terisi")
vap = [os.environ.get(k) for k in ("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT")]
baris("OK" if all(vap) else "INFO", "Notifikasi push (VAPID) " + ("lengkap" if all(vap) else "belum diatur (opsional)"), "" if all(vap) else "Jalankan python tools/buat_vapid.py bila ingin notifikasi saat halaman ditutup.")

print("\n== 5. Database ==")
if not os.environ.get("DATABASE_URL") and not os.environ.get("POSTGRES_URL"):
    baris("INFO", "DATABASE_URL belum diatur: pemeriksaan database dilewati", "Uji lokal memakai SQLite otomatis. Untuk Vercel isi DATABASE_URL dengan connection string Neon (pooled).")
else:
    try:
        import _lib
        db = _lib.DB(); baris("OK", "terhubung ke PostgreSQL")
        ada = {r["table_name"] for r in db.rows("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")}
        perlu = ["admin", "dokter", "staf", "pasien", "obat", "stok_masuk", "antrian", "rekam_medis", "resep", "tagihan", "login_gagal", "audit", "push_sub"]
        hilang = [t for t in perlu if t not in ada]
        baris("OK" if not hilang else "GAGAL", "tabel lengkap" if not hilang else "tabel belum ada: " + ", ".join(hilang), "" if not hilang else "Jalankan seluruh isi database/schema.sql di SQL Editor Neon.")
        kol = db.val("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'pasien' AND column_name = 'kode_pulih_hash'")
        baris("OK" if kol else "GAGAL", "skema versi terbaru" if kol else "skema database masih versi lama", "" if kol else "Jalankan ulang database/schema.sql (aman, data tidak dihapus).")
        baris("OK", f"data awal: {db.val('SELECT COUNT(*) FROM dokter')} dokter, {db.val('SELECT COUNT(*) FROM obat')} obat, {db.val('SELECT COUNT(*) FROM pasien')} pasien")
        db.close()
    except ImportError: baris("GAGAL", "psycopg2 belum terpasang", "Jalankan: pip install -r requirements.txt")
    except Exception as e: baris("GAGAL", "tidak bisa terhubung ke database: " + str(e)[:140], "Periksa DATABASE_URL (pakai versi pooled, akhiri dengan ?sslmode=require).")

print("\n" + ("SIAP. Tidak ada masalah yang ditemukan." if not gagal else f"{gagal} masalah perlu diperbaiki sebelum lanjut."))
sys.exit(1 if gagal else 0)
