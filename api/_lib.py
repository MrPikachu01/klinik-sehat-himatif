"""_lib.py - koneksi database, sesi bertanda tangan, dan keamanan (tanpa framework, hanya library standar + psycopg2)."""
import base64, datetime, decimal, hashlib, hmac, json, os, secrets, sqlite3, time
from http.cookies import SimpleCookie

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or ""
SQLITE_PATH = os.environ.get("SQLITE_PATH", "")          # hanya untuk pengembangan lokal dan uji
SECRET_KEY = os.environ.get("SECRET_KEY", "")
SETUP_KEY = os.environ.get("SETUP_KEY", "")
WIB = datetime.timezone(datetime.timedelta(hours=7))      # Waktu Indonesia Barat
SESI_DETIK = 8 * 3600
MAX_BODY = 200_000


class Gagal(Exception):
    """Kesalahan yang aman ditampilkan ke pengguna."""
    def __init__(self, pesan, http=400, kode=""):
        super().__init__(pesan)
        self.pesan, self.http, self.kode = pesan, http, kode


# ---------- Waktu ----------
def sekarang(): return datetime.datetime.now(WIB)
def hari_ini(): return sekarang().strftime("%Y-%m-%d")
def hari_minggu(): return (sekarang().weekday() + 1) % 7          # 0 = Minggu ... 6 = Sabtu
def stempel(dt): return dt.strftime("%Y-%m-%d %H:%M:%S")


# ---------- Password ----------
def hash_pw(pw):
    salt = secrets.token_hex(8)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 150_000).hex()
    return f"pbkdf2$150000${salt}${h}"

def cek_pw(pw, tersimpan):
    try:
        _, it, salt, h = tersimpan.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(it)).hex()
        return hmac.compare_digest(calc, h)
    except Exception:
        return False


# ---------- Sesi: cookie bertanda tangan (tanpa penyimpanan di server, cocok untuk serverless) ----------
def _b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def _unb64(s): return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
def _ttd(p): return hmac.new(SECRET_KEY.encode(), p.encode(), hashlib.sha256).hexdigest()

def buat_cookie(data):
    data = dict(data, exp=int(time.time()) + SESI_DETIK)
    p = _b64(json.dumps(data, separators=(",", ":")).encode())
    return p + "." + _ttd(p)

def baca_cookie(environ):
    try:
        c = SimpleCookie(environ.get("HTTP_COOKIE", ""))
        if "ks" not in c: return {}
        p, s = c["ks"].value.rsplit(".", 1)
        if not hmac.compare_digest(s, _ttd(p)): return {}
        d = json.loads(_unb64(p))
        return d if d.get("exp", 0) > time.time() else {}
    except Exception:
        return {}


# ---------- Database: PostgreSQL (produksi) atau SQLite (lokal dan uji), dengan SQL yang sama ----------
def _norm(d):
    for k, v in d.items():
        if isinstance(v, datetime.datetime): d[k] = stempel(v)
        elif isinstance(v, datetime.date): d[k] = v.isoformat()
        elif isinstance(v, decimal.Decimal): d[k] = float(v)
    return d

class DB:
    def __init__(self):
        if DATABASE_URL:
            import psycopg2, psycopg2.extras
            self.pg = True
            self.c = psycopg2.connect(DATABASE_URL, connect_timeout=10)
            self._cur = lambda: self.c.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            self.pg = False
            self.c = sqlite3.connect(SQLITE_PATH or "klinik-dev.db")
            self.c.row_factory = sqlite3.Row
            self._cur = self.c.cursor
            self._init_sqlite()

    def _init_sqlite(self):
        if self.c.execute("SELECT name FROM sqlite_master WHERE name = 'admin'").fetchone(): return
        f = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "database", "schema_sqlite.sql")
        with open(f, encoding="utf-8") as fh: self.c.executescript(fh.read())

    def _run(self, sql, p=()):
        if not self.pg: sql = sql.replace("%s", "?").replace(" FOR UPDATE", "")
        cur = self._cur(); cur.execute(sql, tuple(p)); return cur

    def run(self, sql, p=()): self._run(sql, p).close()
    def rows(self, sql, p=()): return [_norm(dict(r)) for r in self._run(sql, p).fetchall()]
    def one(self, sql, p=()):
        r = self._run(sql, p).fetchone()
        return _norm(dict(r)) if r is not None else None
    def val(self, sql, p=()):
        r = self._run(sql, p).fetchone()
        return None if r is None else list(dict(r).values())[0]
    def ins(self, sql, p=()):                      # INSERT ... RETURNING id
        return self._run(sql, p).fetchone()["id"]
    def commit(self): self.c.commit()
    def rollback(self): self.c.rollback()
    def close(self): self.c.close()


# ---------- Konteks permintaan ----------
class Ctx:
    def __init__(self, db, ses, body, query, ip):
        self.db, self.ses, self.body, self.query, self.ip = db, ses, body, query, ip
        self.setelah = []        # pekerjaan yang dijalankan setelah transaksi berhasil (mis. kirim notifikasi push)

def ang(v, d=0):
    try: return int(v)
    except (TypeError, ValueError): return d

def hari_arr(s): return [int(x) for x in s.split(",") if x != ""]
