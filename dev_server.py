"""dev_server.py - jalankan proyek di komputer sendiri tanpa Vercel dan tanpa Postgres.
Pemakaian:  python dev_server.py        lalu buka http://localhost:8000
Data disimpan di file klinik-dev.db (SQLite). Jika DATABASE_URL diisi, yang dipakai adalah PostgreSQL."""
import mimetypes, os, sys
from wsgiref.simple_server import make_server

ROOT = os.path.dirname(os.path.abspath(__file__))

def muat_env():                      # baca file .env (jika ada) agar bisa menjalankan lokal dengan database Postgres sungguhan
    f = os.path.join(ROOT, ".env")
    if not os.path.isfile(f): return
    for baris in open(f, encoding="utf-8"):
        baris = baris.strip()
        if not baris or baris.startswith("#") or "=" not in baris: continue
        k, v = baris.split("=", 1); v = v.strip().strip('"').strip("'")
        if v: os.environ.setdefault(k.strip(), v)
muat_env()

os.environ.setdefault("SQLITE_PATH", os.path.join(ROOT, "klinik-dev.db"))
os.environ.setdefault("SECRET_KEY", "kunci-pengembangan-lokal-ganti-di-produksi")
os.environ.setdefault("SETUP_KEY", "setup-lokal-123")
sys.path.insert(0, os.path.join(ROOT, "api"))
from index import app as api_app

PUBLIC = os.path.join(ROOT, "public")

def app(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    if path.startswith("/api/"): return api_app(environ, start_response)
    if path == "/": path = "/index.html"
    f = os.path.realpath(os.path.join(PUBLIC, path.lstrip("/")))
    if not f.startswith(PUBLIC) or not os.path.isfile(f):
        start_response("404 Not Found", [("Content-Type", "text/plain")]); return [b"Tidak ditemukan"]
    tipe = mimetypes.guess_type(f)[0] or "application/octet-stream"
    with open(f, "rb") as fh: data = fh.read()
    start_response("200 OK", [("Content-Type", tipe), ("Content-Length", str(len(data)))])
    return [data]

if __name__ == "__main__":
    print("Klinik Sehat berjalan di http://localhost:8000")
    print("Database: " + ("PostgreSQL (dari .env)" if os.environ.get("DATABASE_URL") else "SQLite lokal (klinik-dev.db)"))
    print("Kode setup admin (untuk membuat password admin pertama kali): %s" % os.environ["SETUP_KEY"])
    make_server("", 8000, app).serve_forever()
