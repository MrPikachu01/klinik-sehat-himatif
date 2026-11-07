"""index.py - pintu masuk Vercel (WSGI). Rute: /api/me, /api/state, /api/auth?do=..., /api/action?do=..."""
import hmac, json, os, secrets, sys, traceback
from urllib.parse import parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib
import _aksi
from _lib import Gagal

RUTE = {"/api/tv": ("GET", None), "/api/me": ("GET", _aksi.me), "/api/state": ("GET", _aksi.state), "/api/auth": ("POST", _aksi.auth), "/api/action": ("POST", _aksi.action)}


def _balas(start_response, data, status=200, cookie=None, cache="no-store"):
    isi = json.dumps(data, ensure_ascii=False).encode()
    h = [("Content-Type", "application/json; charset=utf-8"), ("Cache-Control", cache), ("X-Content-Type-Options", "nosniff"), ("Content-Length", str(len(isi)))]
    if cookie: h.append(("Set-Cookie", cookie))
    start_response(f"{status} {'OK' if status < 400 else 'Error'}", h)
    return [isi]


def app(environ, start_response):
    ses, db = {}, None
    try:
        if not _lib.SECRET_KEY: raise Gagal("SECRET_KEY belum diatur di Environment Variables.", 500)
        path = environ.get("PATH_INFO", "").rstrip("/") or "/"
        rute = RUTE.get(path)
        if not rute: raise Gagal("Endpoint tidak ditemukan.", 404)
        if path == "/api/tv":     # publik, tanpa sesi dan tanpa cookie; di-cache 3 detik oleh CDN agar hemat database
            db = _lib.DB()
            return _balas(start_response, _aksi.tv(db), cache="public, s-maxage=3, stale-while-revalidate=5")
        metode, fn = rute
        if environ.get("REQUEST_METHOD") != metode: raise Gagal("Metode tidak diizinkan.", 405)
        ses = _lib.baca_cookie(environ)
        if not ses.get("csrf"): ses["csrf"] = secrets.token_hex(16)
        body = {}
        if metode == "POST":
            if not hmac.compare_digest(str(ses["csrf"]).encode(), environ.get("HTTP_X_CSRF", "").encode("utf-8", "ignore")): raise Gagal("Token keamanan tidak valid. Muat ulang halaman.", 403)
            n = min(int(environ.get("CONTENT_LENGTH") or 0), _lib.MAX_BODY)
            try: body = json.loads(environ["wsgi.input"].read(n) or b"{}")
            except ValueError: body = {}
            if not isinstance(body, dict): body = {}
        ip = (environ.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or environ.get("REMOTE_ADDR", "0"))[:45]
        query = {k: v[0] for k, v in parse_qs(environ.get("QUERY_STRING", "")).items()}
        db = _lib.DB()
        c = _lib.Ctx(db, ses, body, query, ip)
        hasil = fn(c, query.get("do", "")) if fn in (_aksi.auth, _aksi.action) else fn(c)
        db.commit()
        if c.setelah:                                   # mis. kirim notifikasi push; kegagalannya tidak boleh membatalkan permintaan
            for f in c.setelah:
                try: f(db)
                except Exception: traceback.print_exc()
            db.commit()
        return _balas(start_response, hasil, cookie=_cookie(environ, ses))
    except Gagal as e:
        if db: db.rollback()
        return _balas(start_response, {"ok": False, "error": e.pesan, "kode": e.kode}, e.http, _cookie(environ, ses) if ses else None)
    except Exception:
        traceback.print_exc()
        if db: db.rollback()
        return _balas(start_response, {"ok": False, "error": "Terjadi kesalahan pada server.", "kode": ""}, 500)
    finally:
        if db: db.close()


def _cookie(environ, ses):
    aman = "; Secure" if environ.get("HTTP_X_FORWARDED_PROTO", environ.get("wsgi.url_scheme", "")) == "https" else ""
    return f"ks={_lib.buat_cookie(ses)}; Path=/; HttpOnly; SameSite=Lax; Max-Age={_lib.SESI_DETIK}{aman}"
