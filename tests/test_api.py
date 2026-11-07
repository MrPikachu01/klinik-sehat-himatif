"""Uji alur backend dengan SQLite sementara:  python tests/test_api.py"""
import io, json, os, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ["SQLITE_PATH"] = os.path.join(tempfile.mkdtemp(), "uji.db")
os.environ["SECRET_KEY"] = "kunci-uji-" * 4
os.environ["SETUP_KEY"] = "setup-uji-123"
sys.path.insert(0, os.path.join(ROOT, "api"))
from index import app


class Klien:
    def __init__(self, ip="1.1.1.1"): self.cookie, self.csrf, self.ip = "", "", ip
    def req(self, metode, path, body=None, csrf=True):
        q = path.split("?", 1)
        data = json.dumps(body or {}).encode()
        env = {"REQUEST_METHOD": metode, "PATH_INFO": q[0], "QUERY_STRING": q[1] if len(q) > 1 else "", "wsgi.input": io.BytesIO(data), "CONTENT_LENGTH": str(len(data)),
               "HTTP_COOKIE": self.cookie, "HTTP_X_CSRF": self.csrf if csrf else "", "HTTP_X_FORWARDED_FOR": self.ip, "wsgi.url_scheme": "http"}
        got = {}
        def sr(status, headers): got["s"] = int(status.split()[0]); got["h"] = headers
        out = b"".join(app(env, sr))
        for k, v in got["h"]:
            if k == "Set-Cookie": self.cookie = v.split(";")[0]
        j = json.loads(out)
        if j.get("csrf"): self.csrf = j["csrf"]
        return got["s"], j
    def get(self, p): return self.req("GET", p)
    def post(self, p, b=None, **kw): return self.req("POST", p, b, **kw)

def ok(r, apa):
    assert r[1].get("ok"), (apa, r)
    return r[1]
def tolak(r, apa, http=None):
    assert not r[1].get("ok"), (apa, "seharusnya ditolak", r)
    if http: assert r[0] == http, (apa, r)

adm, dok, pas, pas2, tamu = Klien("10.0.0.1"), Klien("10.0.0.2"), Klien("10.0.0.3"), Klien("10.0.0.4"), Klien("10.0.0.5")
for k in (adm, dok, pas, pas2, tamu): ok(k.get("/api/me"), "me")

# keamanan dasar
tolak(tamu.post("/api/action?do=stok_masuk", {"id": 1}), "tanpa login", 401)
tolak(tamu.req("POST", "/api/action?do=stok_masuk", {"id": 1}, csrf=False), "tanpa csrf", 403)
tolak(tamu.get("/api/state"), "state tanpa login", 401)
tolak(tamu.get("/api/tidak-ada"), "rute asing", 404)

# admin: setup password
r = adm.post("/api/auth?do=login", {"role": "Admin", "password": "x"}); tolak(r, "admin belum setup", 409); assert r[1]["kode"] == "SETUP"
tolak(adm.post("/api/auth?do=setup_admin", {"kode": "salah", "password": "adminrahasia"}), "kode setup salah", 403)
ok(adm.post("/api/auth?do=setup_admin", {"kode": "setup-uji-123", "password": "adminrahasia"}), "setup admin")
tolak(Klien("10.0.0.9").post("/api/auth?do=setup_admin", {"kode": "setup-uji-123", "password": "lain12345"}), "setup dua kali")
s = ok(adm.get("/api/state"), "state admin")["state"]; assert len(s["d"]) == 3 and s["d"][0]["pass"] is False

# admin set password dokter, pasien daftar
ok(adm.post("/api/action?do=dokter_simpan", {"id": 1, "nama": "dr. Ahmad Marsehan", "sp": "Umum", "tarif": 50000, "password": "dokter99"}), "set pass dokter")
tolak(dok.post("/api/auth?do=login", {"role": "Dokter", "id": 2, "password": "x"}), "dokter tanpa password", 403)
tolak(dok.post("/api/auth?do=login", {"role": "Dokter", "id": 1, "password": "salah"}), "dokter salah", 401)
ok(dok.post("/api/auth?do=login", {"role": "Dokter", "id": 1, "password": "dokter99"}), "login dokter")
reg = {"nik": "1671010101900001", "nama": "Siti Aminah", "tl": "1990-01-01", "gol": "O", "hp": "081234567890", "al": "Jl. A", "alergi": "Penisilin", "password": "rahasia1", "setuju": True}
rr = ok(pas.post("/api/auth?do=register", reg), "daftar pasien"); kode_siti = rr["kode_pulih"]
assert len(kode_siti) == 11 and kode_siti[5] == "-", kode_siti
tolak(pas2.post("/api/auth?do=register", reg), "NIK ganda")
tolak(pas2.post("/api/auth?do=register", dict(reg, nik="123")), "NIK pendek")
tolak(pas2.post("/api/auth?do=register", dict(reg, nik="1671010101900002", tl="2999-01-01")), "lahir masa depan")
ok(pas2.post("/api/auth?do=register", dict(reg, nik="1671010101900002", nama="Budi", password="rahasia2")), "pasien kedua")

# pasien daftar antrian
dokter3 = "dr. Rani Okta Felani"
r = ok(pas.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "demam", "pri": "Normal"}), "daftar antrian"); assert r["no"] == "A-001", r
tolak(pas.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "lagi", "pri": "Normal"}), "antrian ganda")
r = ok(pas2.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "batuk", "pri": "Darurat"}), "antrian 2"); assert r["no"] == "A-002"
# pasien hanya melihat data sendiri
sp = ok(pas.get("/api/state"), "state pasien")["state"]
assert len(sp["p"]) == 1 and sp["p"][0]["nik"] == reg["nik"] and all("password" not in str(x) for x in sp["p"])
assert any(a["pas"] == 0 for a in sp["a"]) and not any(a["kel"] == "batuk" for a in sp["a"]), "data orang lain bocor"
tolak(pas.post("/api/action?do=pasien_hapus", {"id": 2}), "pasien akses admin", 403)
tolak(pas.post("/api/action?do=rekam_simpan", {"aid": 1}), "pasien akses dokter", 403)

# dokter 3 butuh password; admin set lalu dokter periksa
ok(adm.post("/api/action?do=dokter_simpan", {"id": 3, "nama": dokter3, "sp": "Anak", "tarif": 60000, "password": "dokter33"}), "pass dokter 3")
d3 = Klien("10.0.0.6"); d3.get("/api/me"); ok(d3.post("/api/auth?do=login", {"role": "Dokter", "id": 3, "password": "dokter33"}), "login dokter 3")
sd = ok(d3.get("/api/state"), "state dokter")["state"]; assert len(sd["a"]) == 2 and len(sd["p"]) == 2 and sd["b"] == []
r = ok(d3.post("/api/action?do=antrian_next"), "panggil berikutnya"); assert r["no"] == "A-002", "darurat harus didahulukan"
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": 1, "dx": "ISPA", "res": [{"id": 4, "jml": 99}]}), "stok tidak cukup")
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": 1, "dx": "ISPA", "suhu": "50"}), "suhu tidak valid")
ok(d3.post("/api/action?do=rekam_simpan", {"aid": 1, "td": "120/80", "suhu": "37.5", "dx": "ISPA", "tin": "-", "res": [{"id": 1, "jml": 2}, {"id": 1, "jml": 1}, {"id": 3, "jml": 1}]}), "simpan rekam")
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": 1, "dx": "lagi"}), "rekam ganda")
sd = d3.get("/api/state")[1]["state"]
assert [o["stok"] for o in sd["o"]][:3] == [117, 15, 59], sd["o"]
# kasir
sa = adm.get("/api/state")[1]["state"]; b = sa["b"][0]; assert b["tarif"] == 60000 and b["obat"] == 11000 and not b["lunas"], b
tolak(d3.post("/api/action?do=bayar", {"id": b["id"], "metode": "Tunai"}), "dokter akses kasir", 403)
ok(adm.post("/api/action?do=bayar", {"id": b["id"], "metode": "BPJS"}), "bayar")
b = adm.get("/api/state")[1]["state"]["b"][0]; assert b["lunas"] and b["total"] == 11000 and b["metode"] == "BPJS", b
tolak(adm.post("/api/action?do=bayar", {"id": b["id"], "metode": "Tunai"}), "bayar ulang", 404)
# pasien melihat riwayat dan tagihan sendiri
sp = pas.get("/api/state")[1]["state"]; assert sp["r"][0]["dx"] == "ISPA" and sp["b"][0]["lunas"] and sp["r"][0]["res"][0]["jml"] == 3
# admin: pasien beriwayat tidak bisa dihapus, jadwal, password
tolak(adm.post("/api/action?do=pasien_hapus", {"id": sa["p"][0]["id"]}), "hapus pasien beriwayat")
ok(adm.post("/api/action?do=dokter_hari", {"id": 2, "h": 2}), "toggle hari"); assert 2 in adm.get("/api/state")[1]["state"]["d"][1]["hari"]
r = ok(adm.post("/api/action?do=pasien_simpan", {"nik": "1671010101900003", "nama": "Baru", "tl": "2000-02-02", "gol": "B"}), "admin tambah pasien"); assert len(r["temp"]) == 8
ok(pas.post("/api/action?do=ubah_password", {"lama": "rahasia1", "baru": "baru1234"}), "ubah password")
tolak(pas.post("/api/action?do=ubah_password", {"lama": "rahasia1", "baru": "xxxxxx"}), "password lama salah")
k = Klien("10.0.0.7"); k.get("/api/me"); ok(k.post("/api/auth?do=login", {"role": "Pasien", "nik": reg["nik"], "password": "baru1234"}), "login password baru")
# pembatasan percobaan login
bf = Klien("10.0.0.8"); bf.get("/api/me")
for _ in range(8): tolak(bf.post("/api/auth?do=login", {"role": "Admin", "password": "salah"}), "brute force")
tolak(bf.post("/api/auth?do=login", {"role": "Admin", "password": "adminrahasia"}), "terblokir", 429)

# ===== fitur v2 =====
import datetime
hariini = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
def tgl(n): return (hariini + datetime.timedelta(days=n)).isoformat()
def wd(n): return ((hariini + datetime.timedelta(days=n)).weekday() + 1) % 7

# janji temu hari lain
r = ok(pas.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "kontrol", "pri": "Normal", "tgl": tgl(3)}), "janji temu"); assert r["no"] == "A-001" and r["tgl"] == tgl(3), r
tolak(pas.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "dobel", "tgl": tgl(3)}), "janji ganda")
tolak(pas.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "x", "tgl": tgl(20)}), "terlalu jauh")
tolak(pas.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "x", "tgl": tgl(-1)}), "tanggal lalu")
bad = next(n for n in range(1, 8) if wd(n) not in (1, 3, 5))
tolak(pas.post("/api/action?do=antrian_daftar", {"dok": 2, "kel": "x", "tgl": tgl(bad)}), "dokter tidak praktik")
fut = [a for a in pas.get("/api/state")[1]["state"]["a"] if a["tgl"] == tgl(3)][0]
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": fut["id"], "dx": "x"}), "periksa sebelum hari H")
ok(pas.post("/api/action?do=antrian_batal", {"id": fut["id"]}), "batal janji")

# obat: kedaluwarsa, batas minimum
ok(adm.post("/api/action?do=obat_simpan", {"nama": "Obat Kadaluarsa", "stok": 10, "harga": 1000, "smin": 5, "exp": tgl(-1)}), "obat exp")
oid_exp = [o for o in adm.get("/api/state")[1]["state"]["o"] if o["nama"] == "Obat Kadaluarsa"][0]["id"]
tolak(adm.post("/api/action?do=obat_simpan", {"nama": "Salah", "stok": 1, "harga": 10, "exp": "bukan-tanggal"}), "format exp")

# rekam medis lengkap
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": 2, "dx": "x", "res": [{"id": oid_exp, "jml": 1}]}), "obat kedaluwarsa")
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": 2, "dx": "x", "icd": "BUKAN"}), "icd salah")
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": 2, "dx": "x", "bb": "9999"}), "bb di luar batas")
tolak(d3.post("/api/action?do=rekam_simpan", {"aid": 2, "dx": "x", "sakit": 99}), "sakit di luar batas")
ok(d3.post("/api/action?do=rekam_simpan", {"aid": 2, "dx": "Infeksi saluran napas atas akut", "icd": "j06.9", "bb": "65.5", "tb": "170", "sakit": 2, "ruj": "RS Umum - Poli Paru", "res": [{"id": 3, "jml": 1}]}), "rekam lengkap")
r2 = [r for r in d3.get("/api/state")[1]["state"]["r"] if r["aid"] == 2][0]
assert r2["icd"] == "J06.9" and r2["bb"] == "65.5" and r2["tb"] == "170.0" and r2["sakit"] == 2 and r2["ruj"].startswith("RS") and r2["rs"] == "Menunggu", r2

# layar TV publik: tanpa login, tanpa cookie, hanya nomor
ok(pas2.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "kontrol lagi", "pri": "Normal"}), "antrian tv 1")
p3 = Klien("10.0.0.20"); p3.get("/api/me"); ok(p3.post("/api/auth?do=register", dict(reg, nik="1671010101900009", nama="Citra", password="rahasia3")), "pasien ketiga")
ok(p3.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "pusing", "pri": "Normal"}), "antrian tv 2")
ok(d3.post("/api/action?do=antrian_next"), "panggil tv")
tvk = Klien("10.0.2.1"); tvr = ok(tvk.get("/api/tv"), "tv"); assert tvk.cookie == "", "tv tidak boleh membuat sesi"
dk3 = [d for d in tvr["d"] if d["id"] == 3][0]; assert dk3["now"]["no"] == "A-003" and dk3["next"] == ["A-004"] and dk3["menunggu"] == 1, dk3
assert "Siti" not in json.dumps(tvr) and "Budi" not in json.dumps(tvr), "nama pasien bocor di TV"
ok(d3.post("/api/action?do=antrian_ulang", {"id": [a for a in d3.get("/api/state")[1]["state"]["a"] if a["no"] == "A-003"][0]["id"]}), "panggil ulang")

# role Kasir dan Apoteker
ok(adm.post("/api/action?do=staf_simpan", {"nama": "Rina Kasir", "role": "Kasir", "password": "kasir123"}), "tambah kasir")
ok(adm.post("/api/action?do=staf_simpan", {"nama": "Budi Apoteker", "role": "Apoteker", "password": "apt12345"}), "tambah apoteker")
tolak(adm.post("/api/action?do=staf_simpan", {"nama": "x", "role": "Admin", "password": "123456"}), "peran salah")
tolak(adm.post("/api/action?do=staf_simpan", {"nama": "tanpa pass", "role": "Kasir"}), "staf tanpa password")
staf = tamu.get("/api/me")[1]["pub"]["staf"]; kid = [s for s in staf if s["role"] == "Kasir"][0]["id"]; apid = [s for s in staf if s["role"] == "Apoteker"][0]["id"]
ks = Klien("10.0.1.1"); ks.get("/api/me")
tolak(ks.post("/api/auth?do=login", {"role": "Kasir", "id": apid, "password": "apt12345"}), "kasir pakai akun apoteker", 404)
tolak(ks.post("/api/auth?do=login", {"role": "Kasir", "id": kid, "password": "salah"}), "kasir salah", 401)
ok(ks.post("/api/auth?do=login", {"role": "Kasir", "id": kid, "password": "kasir123"}), "login kasir")
sk = ks.get("/api/state")[1]["state"]
assert sk["r"] == [] and sk["o"] == [] and all(a["kel"] == "" for a in sk["a"]) and all(p["nik"] == "" for p in sk["p"]), "data kasir terlalu banyak"
tolak(ks.post("/api/action?do=stok_masuk", {"id": 1, "jumlah": 5}), "kasir akses gudang", 403)
tolak(ks.post("/api/action?do=rekam_simpan", {"aid": 1}), "kasir akses rekam", 403)
bayar_id = [x for x in sk["b"] if not x["lunas"]][0]["id"]
ok(ks.post("/api/action?do=bayar", {"id": bayar_id, "metode": "QRIS"}), "kasir membayar")
ap = Klien("10.0.1.2"); ap.get("/api/me"); ok(ap.post("/api/auth?do=login", {"role": "Apoteker", "id": apid, "password": "apt12345"}), "login apoteker")
sap = ap.get("/api/state")[1]["state"]
assert sap["b"] == [] and sap["r"] and all(x["dx"] == "" for x in sap["r"]) and any(x["rs"] == "Menunggu" for x in sap["r"]), "data apoteker"
tolak(ap.post("/api/action?do=bayar", {"id": 1, "metode": "Tunai"}), "apoteker akses kasir", 403)
ok(ap.post("/api/action?do=stok_masuk", {"id": 2, "jumlah": 50, "catatan": "pembelian", "exp": tgl(200)}), "stok masuk")
sap = ap.get("/api/state")[1]["state"]; am = [o for o in sap["o"] if o["id"] == 2][0]
assert am["stok"] == 65 and am["exp"] == tgl(200) and sap["sm"][0]["jumlah"] == 50 and sap["sm"][0]["oleh"] == "Budi Apoteker", (am, sap["sm"])
rid = [x for x in sap["r"] if x["rs"] == "Menunggu"][0]["id"]
ok(ap.post("/api/action?do=resep_serah", {"id": rid}), "serahkan resep")
assert [x for x in ap.get("/api/state")[1]["state"]["r"] if x["id"] == rid][0]["rs"] == "Diserahkan"
ok(ap.post("/api/action?do=obat_simpan", {"id": 4, "nama": "Antasida", "stok": 8, "harga": 2500, "smin": 10}), "apoteker ubah obat")
ok(ap.post("/api/action?do=ubah_password", {"lama": "apt12345", "baru": "apt99999"}), "apoteker ganti password")

# ===== fitur v3: privasi, profil, pemulihan, koreksi, audit, push =====
import _push
tolak(Klien("10.0.3.1").post("/api/auth?do=register", dict(reg, nik="1671010101900077", setuju=False)), "daftar tanpa persetujuan")
nk = Klien("10.0.3.2"); nk.get("/api/me"); tolak(nk.post("/api/auth?do=register", {k: v for k, v in dict(reg, nik="1671010101900078").items() if k != "setuju"}), "daftar tanpa kolom setuju")
spx = pas.get("/api/state")[1]["state"]; assert spx["p"][0]["privasi"], "persetujuan pendaftaran tercatat"

# admin menambah pasien: belum setuju, harus menyetujui sendiri saat masuk
tmp = ok(adm.post("/api/action?do=pasien_simpan", {"nik": "1671010101900079", "nama": "Dibuat Admin", "tl": "1999-09-09", "gol": "O"}), "pasien buatan admin")["temp"]
pa = Klien("10.0.3.3"); pa.get("/api/me"); ok(pa.post("/api/auth?do=login", {"role": "Pasien", "nik": "1671010101900079", "password": tmp}), "login pasien buatan admin")
assert pa.get("/api/state")[1]["state"]["p"][0]["privasi"] == "", "belum setuju"
ok(pa.post("/api/action?do=privasi_setuju"), "setuju privasi"); assert pa.get("/api/state")[1]["state"]["p"][0]["privasi"] != ""

# profil saya
tolak(pas.post("/api/action?do=profil_simpan", {"hp": "abc", "al": "x"}), "hp salah")
ok(pas.post("/api/action?do=profil_simpan", {"hp": "081299998888", "al": "Jl. Baru 7", "alergi": "Penisilin, Sulfa", "gol": "A"}), "profil")
pp = pas.get("/api/state")[1]["state"]["p"][0]; assert pp["hp"] == "081299998888" and pp["alergi"] == "Penisilin, Sulfa" and pp["gol"] == "A" and pp["nik"] == reg["nik"] and pp["nama"] == "Siti Aminah", pp
tolak(dok.post("/api/action?do=profil_simpan", {"hp": "081"}), "dokter akses profil pasien", 403)

# lupa password dengan kode pemulihan
lp = Klien("10.0.3.4"); lp.get("/api/me")
tolak(lp.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-02", "kode": kode_siti, "baru": "passbaru1"}), "tanggal lahir salah", 401)
tolak(lp.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-01", "kode": "AAAAA-BBBBB", "baru": "passbaru1"}), "kode salah", 401)
tolak(lp.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-01", "kode": kode_siti, "baru": "123"}), "password pendek")
kode2 = ok(lp.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-01", "kode": kode_siti.lower().replace("-", " "), "baru": "passbaru1"}), "pulihkan password")["kode_pulih"]
assert kode2 != kode_siti
tolak(lp.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-01", "kode": kode_siti, "baru": "passlain12"}), "kode lama sekali pakai", 401)
lg = Klien("10.0.3.5"); lg.get("/api/me"); tolak(lg.post("/api/auth?do=login", {"role": "Pasien", "nik": reg["nik"], "password": "baru1234"}), "password lama tak berlaku", 401); ok(lg.post("/api/auth?do=login", {"role": "Pasien", "nik": reg["nik"], "password": "passbaru1"}), "login password pulihan")
tolak(Klien("10.0.3.6").post("/api/auth?do=lupa_password", {"nik": "1671010101900079", "tl": "1999-09-09", "kode": "AAAAA-BBBBB", "baru": "passbaru1"}), "pasien tanpa kode pemulihan")
bad = Klien("10.0.3.7"); bad.get("/api/me")
for _ in range(8): tolak(bad.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-01", "kode": "XXXXX-YYYYY", "baru": "passbaru1"}), "tebak kode")
tolak(bad.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-01", "kode": kode2, "baru": "passbaru1"}), "terblokir setelah banyak tebakan", 429)
tolak(lg.post("/api/action?do=pulih_kode_baru", {"password": "salah"}), "kode baru butuh password")
kode3 = ok(lg.post("/api/action?do=pulih_kode_baru", {"password": "passbaru1"}), "kode pemulihan baru")["kode_pulih"]; assert kode3 not in (kode2, kode_siti)
fresh = Klien("10.0.3.8"); fresh.get("/api/me"); tolak(fresh.post("/api/auth?do=lupa_password", {"nik": reg["nik"], "tl": "1990-01-01", "kode": kode2, "baru": "passbaru2"}), "kode dibuat ulang membatalkan yang lama", 401)

# koreksi rekam medis dengan jejak audit
rk = [r for r in d3.get("/api/state")[1]["state"]["r"] if r["aid"] == 2][0]
tolak(d3.post("/api/action?do=rekam_koreksi", {"id": rk["id"], "dx": "Salah ketik", "alasan": "x"}), "alasan terlalu pendek")
tolak(d3.post("/api/action?do=rekam_koreksi", {"id": rk["id"], "dx": rk["dx"], "icd": rk["icd"], "td": rk["td"], "suhu": rk["suhu"], "bb": rk["bb"], "tb": rk["tb"], "tin": rk["tin"], "sakit": rk["sakit"], "ruj": rk["ruj"], "alasan": "tidak ada perubahan"}), "tanpa perubahan")
tolak(dok.post("/api/action?do=rekam_koreksi", {"id": rk["id"], "dx": "X", "alasan": "dokter lain"}), "dokter lain tidak boleh koreksi", 404)
tolak(pas.post("/api/action?do=rekam_koreksi", {"id": rk["id"], "dx": "X", "alasan": "pasien"}), "pasien tidak boleh koreksi", 403)
tolak(d3.post("/api/action?do=rekam_koreksi", {"id": rk["id"], "dx": rk["dx"], "icd": "SALAH", "alasan": "uji validasi"}), "icd salah saat koreksi")
ok(d3.post("/api/action?do=rekam_koreksi", {"id": rk["id"], "dx": "Faringitis akut", "icd": "J02.9", "td": rk["td"], "suhu": "38.1", "bb": rk["bb"], "tb": rk["tb"], "tin": rk["tin"], "sakit": 3, "ruj": rk["ruj"], "alasan": "Salah pilih diagnosis saat input"}), "koreksi rekam")
r_after = [r for r in d3.get("/api/state")[1]["state"]["r"] if r["id"] == rk["id"]][0]
assert r_after["dx"] == "Faringitis akut" and r_after["icd"] == "J02.9" and r_after["sakit"] == 3 and r_after["kor"] == 1, r_after
jj = ok(d3.post("/api/action?do=rekam_jejak", {"id": rk["id"]}), "jejak dokter")["jejak"]
assert len(jj) == 1 and jj[0]["rincian"]["alasan"].startswith("Salah pilih") and jj[0]["rincian"]["perubahan"]["dx"] == [rk["dx"], "Faringitis akut"] and jj[0]["oleh"] == dokter3, jj
tolak(dok.post("/api/action?do=rekam_jejak", {"id": rk["id"]}), "dokter lain tak boleh lihat jejak", 404)
assert len(ok(adm.post("/api/action?do=rekam_jejak", {"id": rk["id"]}), "jejak admin")["jejak"]) == 1
au = adm.get("/api/state")[1]["state"]["audit"]; aksi = [a["aksi"] for a in au]
assert "rekam_koreksi" in aksi and "profil_ubah" in aksi and "privasi_setuju" in aksi and "reset_password_mandiri" in aksi and "kode_pulih_baru" in aksi, aksi
assert not any(reg["nik"] in a["rincian"] for a in au), "NIK tidak boleh masuk jejak audit"
assert "audit" in adm.get("/api/state")[1]["state"] and dok.get("/api/state")[1]["state"]["audit"] == [], "audit hanya untuk admin"

# notifikasi push (pengirim ditukar dengan tiruan)
sent = []
tolak(pas.post("/api/action?do=push_daftar", {"endpoint": "https://push.example/x", "p256dh": "k", "auth": "a"}), "push belum aktif")
_push.PUB, _push.PRIV, _push.SUBJ = "pub", "priv", "mailto:uji@klinik.example"
_push.KIRIM = lambda sub, pl: (sent.append((sub["endpoint"], pl["judul"], pl["isi"])), "mati" if "mati" in sub["endpoint"] else "ok")[1]
assert tamu.get("/api/me")[1]["pub"]["vapid"] == "pub"
tolak(pas.post("/api/action?do=push_daftar", {"endpoint": "http://tidak-aman/x", "p256dh": "k", "auth": "a"}), "endpoint tidak aman")
ps = {}
for nm, i in (("p4", 4), ("p5", 5), ("p6", 6)):
    k = Klien("10.0.4.%d" % i); k.get("/api/me"); ok(k.post("/api/auth?do=register", dict(reg, nik="16710101019001%02d" % i, nama="Push " + nm, password="rahasia" + str(i))), "daftar " + nm)
    ok(k.post("/api/action?do=antrian_daftar", {"dok": 3, "kel": "uji push", "pri": "Normal"}), "antri " + nm)
    ok(k.post("/api/action?do=push_daftar", {"endpoint": "https://push.example/" + ("mati-" if nm == "p6" else "") + nm, "p256dh": "kunci", "auth": "rahasia"}), "langganan " + nm); ps[nm] = k
ok(d3.post("/api/action?do=antrian_next"), "panggil 1")   # memanggil Citra (belum berlangganan); p4 menjadi berikutnya, p6 dua di depan
assert ("https://push.example/p4", "Anda berikutnya") in [(e, j) for e, j, _ in sent] and ("https://push.example/mati-p6", "Giliran hampir tiba") in [(e, j) for e, j, _ in sent], sent
n_mati = sum(1 for e, _, _ in sent if "mati-p6" in e)
ok(d3.post("/api/action?do=antrian_next"), "panggil 2")   # memanggil p4
assert ("https://push.example/p4", "Giliran Anda!") in [(e, j) for e, j, _ in sent], sent
assert sum(1 for e, _, _ in sent if "mati-p6" in e) == n_mati, "langganan mati harus terhapus"
ok(ps["p4"].post("/api/action?do=push_hapus", {"endpoint": "https://push.example/p4"}), "hapus langganan"); sent.clear()
ok(d3.post("/api/action?do=antrian_next"), "panggil 3")
assert not any(e.endswith("/p4") for e, _, _ in sent), "p4 sudah berhenti berlangganan"
_push.PUB = _push.PRIV = _push.SUBJ = ""

# kosongkan data pasien lalu logout
ok(adm.post("/api/action?do=pasien_kosongkan"), "kosongkan"); st = adm.get("/api/state")[1]["state"]; assert st["p"] == [] and st["a"] == [] and st["b"] == [] and len(st["d"]) == 3
# logout
ok(adm.post("/api/auth?do=logout"), "logout"); tolak(adm.get("/api/state"), "setelah logout", 401)
print("SEMUA UJI LULUS")
