"""_aksi.py - logika semua endpoint (me, state, tv, auth, action). Setiap aksi memeriksa role dan memvalidasi input di server."""
import datetime, hmac, json, re, secrets
import _lib, _push
from _lib import Gagal, ang, hari_arr, hari_ini, hash_pw, cek_pw, sekarang, stempel

STAF = ("Kasir", "Apoteker")
SEMUA_ROLE = ("Admin", "Dokter", "Pasien") + STAF


def wajib_login(c, roles=None):
    me_ = c.ses.get("me")
    if not me_: raise Gagal("Silakan login terlebih dahulu.", 401, "LOGIN")
    if roles and me_["role"] not in roles: raise Gagal("Anda tidak berhak melakukan aksi ini.", 403)
    return me_

def teks(d, k, maks=None):
    v = str(d.get(k) if d.get(k) is not None else "").strip()
    return v if maks is None else v[:maks]

def tgl_valid(s):
    try: return datetime.datetime.strptime(s, "%Y-%m-%d").strftime("%Y-%m-%d") == s
    except ValueError: return False

def hari_dari_tanggal(s): return (datetime.datetime.strptime(s, "%Y-%m-%d").weekday() + 1) % 7   # 0 = Minggu

def angka(v, lo, hi, nama):
    """Angka desimal opsional (kosong = None) dengan batas."""
    v = str(v if v is not None else "").strip()
    if v == "": return None
    try: x = round(float(v), 1)
    except ValueError: raise Gagal(f"{nama} harus berupa angka.")
    if not lo <= x <= hi: raise Gagal(f"{nama} harus antara {lo} dan {hi}.")
    return x

def validasi_pasien(c, d, idp=0):
    nik, nama, tl = teks(d, "nik"), teks(d, "nama"), teks(d, "tl")
    gol, hp = teks(d, "gol") or "O", teks(d, "hp")
    if not (len(nik) == 16 and nik.isdigit()): raise Gagal("NIK harus 16 digit angka.")
    if c.db.val("SELECT COUNT(*) FROM pasien WHERE nik = %s AND id <> %s", (nik, idp)) > 0: raise Gagal("NIK sudah terdaftar. Silakan login.")
    if not nama or len(nama) > 100: raise Gagal("Nama wajib diisi (maksimal 100 karakter).")
    if not tgl_valid(tl): raise Gagal("Tanggal lahir tidak valid.")
    if tl > hari_ini(): raise Gagal("Tanggal lahir tidak boleh di masa depan.")
    if gol not in ("A", "B", "AB", "O"): raise Gagal("Golongan darah tidak valid.")
    if hp and not (hp.isdigit() and 9 <= len(hp) <= 14): raise Gagal("No. HP harus 9 sampai 14 digit angka.")
    return nik, nama, tl, gol, hp, teks(d, "al", 200), teks(d, "alergi", 100)


# ---------- bantu: audit, kode pemulihan, notifikasi push, validasi rekam ----------
VERSI_PRIVASI = "1.0"
ALFABET_KODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

def catat_audit(c, aksi, objek, objek_id, rincian, oleh=None, peran=None):
    m = c.ses.get("me") or {}
    c.db.run("INSERT INTO audit (waktu, oleh, peran, aksi, objek, objek_id, rincian) VALUES (%s,%s,%s,%s,%s,%s,%s)",
             (stempel(sekarang()), (oleh or m.get("nama") or "-")[:100], peran or m.get("role") or "-", aksi, objek, objek_id, json.dumps(rincian, ensure_ascii=False)))

def buat_kode(): return "".join(secrets.choice(ALFABET_KODE) for _ in range(10))
def norm_kode(k): return re.sub(r"[^A-Z0-9]", "", str(k or "").upper())
def tampil_kode(k): return k[:5] + "-" + k[5:]

def kabari(c, pasien_id, judul, isi):
    """Antrikan notifikasi push untuk pasien; dikirim setelah transaksi berhasil dan tidak pernah menggagalkan permintaan."""
    if not _push.aktif(): return
    subs = c.db.rows("SELECT endpoint, p256dh, auth FROM push_sub WHERE pasien_id = %s", (pasien_id,))
    if not subs: return
    payload = {"judul": judul, "isi": isi, "url": "./"}
    def kirim(db):
        for s_ in subs:
            if _push.KIRIM(s_, payload) == "mati": db.run("DELETE FROM push_sub WHERE endpoint = %s", (s_["endpoint"],))
    c.setelah.append(kirim)

def kabari_antrian(c, dok_id):
    w = c.db.rows("SELECT id, pasien_id, no_antrian, prioritas FROM antrian WHERE dokter_id = %s AND tanggal = %s AND status = 'Menunggu'", (dok_id, hari_ini()))
    w.sort(key=lambda x: (x["prioritas"] != "Darurat", x["id"]))
    if len(w) > 0: kabari(c, w[0]["pasien_id"], "Anda berikutnya", f"Nomor {w[0]['no_antrian']} berikutnya. Bersiaplah.")
    if len(w) > 2: kabari(c, w[2]["pasien_id"], "Giliran hampir tiba", f"Nomor {w[2]['no_antrian']}: 2 antrian di depan Anda.")

def validasi_rekam(b):
    dx, tin, td, icd = teks(b, "dx"), teks(b, "tin"), teks(b, "td"), teks(b, "icd").upper()
    ruj, sakit = teks(b, "ruj"), ang(b.get("sakit"))
    if not dx or len(dx) > 200: raise Gagal("Diagnosis wajib diisi (maksimal 200 karakter).")
    if len(tin) > 200 or len(td) > 10 or len(ruj) > 200: raise Gagal("Data tindakan, tekanan darah, atau rujukan terlalu panjang.")
    if icd and not re.fullmatch(r"[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?", icd): raise Gagal("Kode ICD-10 tidak valid (contoh J06.9).")
    if not 0 <= sakit <= 30: raise Gagal("Lama istirahat (surat sakit) harus antara 0 dan 30 hari.")
    return {"dx": dx, "tin": tin, "td": td, "icd": icd, "ruj": ruj, "sakit": sakit, "suhu": angka(b.get("suhu"), 34, 43, "Suhu"), "bb": angka(b.get("bb"), 1, 400, "Berat badan"), "tb": angka(b.get("tb"), 30, 250, "Tinggi badan")}


# ---------- me: sesi dan info publik halaman login ----------
def me(c):
    dok = [{"id": r["id"], "nama": r["nama"], "sp": r["spesialis"], "hari": hari_arr(r["hari"])} for r in c.db.rows("SELECT id, nama, spesialis, hari FROM dokter ORDER BY id")]
    staf = [{"id": r["id"], "nama": r["nama"], "role": r["peran"]} for r in c.db.rows("SELECT id, nama, peran FROM staf ORDER BY id")]
    return {"ok": True, "csrf": c.ses["csrf"], "me": c.ses.get("me"), "pub": {
        "d": dok, "staf": staf,
        "aktif": c.db.val("SELECT COUNT(*) FROM antrian WHERE tanggal = %s AND status IN ('Menunggu','Dipanggil')", (hari_ini(),)),
        "pasien": c.db.val("SELECT COUNT(*) FROM pasien"),
        "adm": c.db.val("SELECT password_hash FROM admin WHERE id = 1") is not None,
        "vapid": _push.PUB if _push.aktif() else ""}}


# ---------- tv: papan antrian publik (hanya nomor, tanpa nama pasien) ----------
def tv(db):
    h = hari_ini(); wd = (sekarang().weekday() + 1) % 7
    dok = db.rows("SELECT id, nama, spesialis, hari FROM dokter ORDER BY id")
    ant = db.rows("SELECT id, dokter_id, no_antrian, status, prioritas, dipanggil_pada FROM antrian WHERE tanggal = %s", (h,))
    out = []
    for d in dok:
        a = [x for x in ant if x["dokter_id"] == d["id"]]
        dip = sorted([x for x in a if x["status"] == "Dipanggil"], key=lambda x: (str(x["dipanggil_pada"] or ""), x["id"]))
        tunggu = sorted([x for x in a if x["status"] == "Menunggu"], key=lambda x: (x["prioritas"] != "Darurat", x["id"]))
        out.append({"id": d["id"], "nama": d["nama"], "sp": d["spesialis"], "praktik": wd in hari_arr(d["hari"]),
                    "now": ({"no": dip[-1]["no_antrian"], "pada": str(dip[-1]["dipanggil_pada"] or "")} if dip else None),
                    "next": [x["no_antrian"] for x in tunggu[:5]], "menunggu": len(tunggu)})
    return {"ok": True, "tgl": h, "jam": sekarang().strftime("%H:%M:%S"), "d": out}


# ---------- state: data sesuai hak akses ----------
def _p(r): return {"id": r["id"], "nik": r["nik"], "nama": r["nama"], "tl": r["tgl_lahir"], "gol": r["gol_darah"], "hp": r["hp"], "al": r["alamat"], "alergi": r["alergi"], "privasi": r.get("setuju_privasi_pada") or ""}
def _pmin(r, alergi=False): return {"id": r["id"], "nik": "", "nama": r["nama"], "tl": "", "gol": "", "hp": "", "al": "", "alergi": r.get("alergi", "") if alergi else ""}
def _o(r): return {"id": r["id"], "nama": r["nama"], "stok": r["stok"], "harga": r["harga"], "smin": r["stok_min"], "exp": r["kedaluwarsa"] or ""}
def _a(r, kel=True): return {"id": r["id"], "pas": r["pasien_id"], "dok": r["dokter_id"], "tgl": r["tanggal"], "no": r["no_antrian"], "kel": r["keluhan"] if kel else "", "pri": r["prioritas"], "st": r["status"]}
def _b(r): return {"id": r["id"], "aid": r["antrian_id"], "pas": r["pasien_id"], "tgl": r["tanggal"], "tarif": r["tarif"], "obat": r["obat_total"], "metode": r["metode"] or "", "total": r["total"], "lunas": bool(r["lunas"]), "tglb": r["tgl_bayar"]}
def _s(v): return "" if v is None else str(v)

def _rekam(c, where, p=(), penuh=True):
    rows = c.db.rows("SELECT * FROM rekam_medis WHERE " + where + " ORDER BY id", p)
    res = {}
    if rows:
        ids = ",".join(str(int(r["id"])) for r in rows)
        for x in c.db.rows("SELECT rekam_id, obat_id, jumlah FROM resep WHERE rekam_id IN (" + ids + ")"):
            res.setdefault(x["rekam_id"], []).append({"id": x["obat_id"], "jml": x["jumlah"]})
    kor = {}
    if rows:
        for x in c.db.rows("SELECT objek_id, COUNT(*) AS n FROM audit WHERE objek = 'rekam' AND aksi = 'rekam_koreksi' AND objek_id IN (" + ids + ") GROUP BY objek_id"): kor[x["objek_id"]] = x["n"]
    return [{"id": r["id"], "aid": r["antrian_id"], "pas": r["pasien_id"], "dok": r["dokter_id"], "tgl": r["tanggal"],
             "td": r["tekanan_darah"] if penuh else "", "suhu": _s(r["suhu"]) if penuh else "", "bb": _s(r["bb"]) if penuh else "", "tb": _s(r["tb"]) if penuh else "",
             "icd": r["icd"] if penuh else "", "dx": r["diagnosis"] if penuh else "", "tin": r["tindakan"] if penuh else "",
             "sakit": r["sakit_hari"] if penuh else 0, "ruj": r["rujukan"] if penuh else "", "rs": r["resep_status"], "kor": kor.get(r["id"], 0), "res": res.get(r["id"], [])} for r in rows]

def state(c):
    m = wajib_login(c)
    role, uid, db = m["role"], m["id"], c.db
    S = {"p": [], "d": [], "o": [], "a": [], "r": [], "b": [], "sm": [], "staf": [], "audit": [], "npas": db.val("SELECT COUNT(*) FROM pasien")}
    for d in db.rows("SELECT id, nama, spesialis, tarif, hari, (password_hash IS NOT NULL) AS ada FROM dokter ORDER BY id"):
        S["d"].append({"id": d["id"], "nama": d["nama"], "sp": d["spesialis"], "tarif": d["tarif"], "hari": hari_arr(d["hari"]), "pass": bool(d["ada"]) if role == "Admin" else True})
    obat = lambda: [_o(r) for r in db.rows("SELECT * FROM obat ORDER BY id")]
    sm = lambda: db.rows("SELECT s.id, s.obat_id, s.jumlah, s.tanggal, s.catatan, s.oleh FROM stok_masuk s ORDER BY s.id DESC LIMIT 30")
    if role == "Admin":
        S["p"] = [_p(r) for r in db.rows("SELECT * FROM pasien ORDER BY id")]
        S["o"], S["sm"] = obat(), sm()
        S["a"] = [_a(r) for r in db.rows("SELECT * FROM antrian ORDER BY id")]
        S["r"] = _rekam(c, "1 = 1")
        S["b"] = [_b(r) for r in db.rows("SELECT * FROM tagihan ORDER BY id")]
        S["staf"] = [{"id": r["id"], "nama": r["nama"], "role": r["peran"], "pass": r["ada"] == 1 or r["ada"] is True} for r in db.rows("SELECT id, nama, peran, (password_hash IS NOT NULL) AS ada FROM staf ORDER BY id")]
        S["audit"] = db.rows("SELECT id, waktu, oleh, peran, aksi, objek, objek_id, rincian FROM audit ORDER BY id DESC LIMIT 100")
    elif role == "Dokter":
        S["o"] = obat()
        S["a"] = [_a(r) for r in db.rows("SELECT * FROM antrian WHERE dokter_id = %s ORDER BY id", (uid,))]
        ids = [r["pasien_id"] for r in db.rows("SELECT pasien_id FROM antrian WHERE dokter_id = %s UNION SELECT pasien_id FROM rekam_medis WHERE dokter_id = %s", (uid, uid))]
        if ids:
            lst = ",".join(str(int(i)) for i in ids)
            S["p"] = [_p(r) for r in db.rows("SELECT * FROM pasien WHERE id IN (" + lst + ") ORDER BY id")]
            S["r"] = _rekam(c, "pasien_id IN (" + lst + ")")
    elif role == "Kasir":
        S["p"] = [_pmin(r) for r in db.rows("SELECT id, nama FROM pasien ORDER BY id")]
        S["a"] = [_a(r, kel=False) for r in db.rows("SELECT * FROM antrian ORDER BY id")]
        S["b"] = [_b(r) for r in db.rows("SELECT * FROM tagihan ORDER BY id")]
    elif role == "Apoteker":
        S["o"], S["sm"] = obat(), sm()
        batas = stempel(sekarang() - datetime.timedelta(days=14))[:10]
        S["r"] = [x for x in _rekam(c, "resep_status <> 'Tanpa obat' AND tanggal >= %s", (batas,), penuh=False)]
        ids = sorted({x["pas"] for x in S["r"]})
        if ids: S["p"] = [_pmin(r, True) for r in db.rows("SELECT id, nama, alergi FROM pasien WHERE id IN (" + ",".join(str(int(i)) for i in ids) + ") ORDER BY id")]
    else:
        S["p"] = [_p(r) for r in db.rows("SELECT * FROM pasien WHERE id = %s", (uid,))]
        S["o"] = [{"id": r["id"], "nama": r["nama"], "stok": 0, "harga": 0, "smin": 0, "exp": ""} for r in db.rows("SELECT id, nama FROM obat")]
        S["a"] = [_a(r) for r in db.rows("SELECT * FROM antrian WHERE pasien_id = %s ORDER BY id", (uid,))]
        h = hari_ini()   # antrian orang lain hanya untuk menghitung posisi (tanpa nama dan keluhan)
        for r in db.rows("SELECT id, dokter_id, tanggal, prioritas FROM antrian WHERE tanggal = %s AND status = 'Menunggu' AND pasien_id <> %s AND dokter_id IN (SELECT dokter_id FROM antrian WHERE pasien_id = %s AND tanggal = %s AND status IN ('Menunggu','Dipanggil'))", (h, uid, uid, h)):
            S["a"].append({"id": r["id"], "pas": 0, "dok": r["dokter_id"], "tgl": r["tanggal"], "no": "", "kel": "", "pri": r["prioritas"], "st": "Menunggu"})
        S["r"] = _rekam(c, "pasien_id = %s", (uid,))
        S["b"] = [_b(r) for r in db.rows("SELECT * FROM tagihan WHERE pasien_id = %s ORDER BY id", (uid,))]
    return {"ok": True, "state": S, "csrf": c.ses["csrf"]}


# ---------- auth ----------
def cek_blokir(c):
    batas = stempel(sekarang() - datetime.timedelta(minutes=10))
    if c.db.val("SELECT COUNT(*) FROM login_gagal WHERE ip = %s AND waktu > %s", (c.ip, batas)) >= 8:
        raise Gagal("Terlalu banyak percobaan gagal. Coba lagi 10 menit lagi.", 429)

def catat_gagal(c):
    c.db.run("INSERT INTO login_gagal (ip, waktu) VALUES (%s, %s)", (c.ip, stempel(sekarang())))
    c.db.run("DELETE FROM login_gagal WHERE waktu < %s", (stempel(sekarang() - datetime.timedelta(days=1)),))
    c.db.commit()          # dicatat walau permintaan ini ditolak

def mulai_sesi(c, me_):
    c.ses.clear(); c.ses["me"] = me_; c.ses["csrf"] = secrets.token_hex(16)
    return {"ok": True, "csrf": c.ses["csrf"], "me": me_}

def auth(c, do):
    b = c.body
    if do == "login":
        cek_blokir(c)
        role, pw = teks(b, "role"), str(b.get("password") or "")
        if role == "Admin":
            h = c.db.val("SELECT password_hash FROM admin WHERE id = 1")
            if h is None: raise Gagal("Password admin belum dibuat.", 409, "SETUP")
            if not cek_pw(pw, h): catat_gagal(c); raise Gagal("Password salah.", 401)
            return mulai_sesi(c, {"role": "Admin", "id": 0, "nama": "Administrator"})
        if role == "Dokter" or role in STAF:
            if role == "Dokter": d = c.db.one("SELECT id, nama, password_hash FROM dokter WHERE id = %s", (ang(b.get("id")),))
            else: d = c.db.one("SELECT id, nama, password_hash FROM staf WHERE id = %s AND peran = %s", (ang(b.get("id")), role))
            if not d: raise Gagal("Akun tidak ditemukan.", 404)
            if d["password_hash"] is None: raise Gagal("Password belum diatur. Hubungi admin.", 403)
            if not cek_pw(pw, d["password_hash"]): catat_gagal(c); raise Gagal("Password salah.", 401)
            return mulai_sesi(c, {"role": role, "id": d["id"], "nama": d["nama"]})
        if role == "Pasien":
            p = c.db.one("SELECT id, nama, password_hash FROM pasien WHERE nik = %s", (teks(b, "nik"),))
            if not p or not cek_pw(pw, p["password_hash"]): catat_gagal(c); raise Gagal("NIK atau password salah. Belum punya akun? Daftar dulu.", 401)
            return mulai_sesi(c, {"role": "Pasien", "id": p["id"], "nama": p["nama"]})
        raise Gagal("Role tidak dikenal.")
    if do == "setup_admin":
        cek_blokir(c)
        if len(_lib.SETUP_KEY) < 8: raise Gagal("SETUP_KEY belum diatur (minimal 8 karakter) di Environment Variables.", 403)
        if c.db.val("SELECT password_hash FROM admin WHERE id = 1") is not None: raise Gagal("Password admin sudah dibuat.", 409)
        if not hmac.compare_digest(_lib.SETUP_KEY, str(b.get("kode") or "")): catat_gagal(c); raise Gagal("Kode setup salah.", 403)
        pw = str(b.get("password") or "")
        if len(pw) < 6: raise Gagal("Password minimal 6 karakter.")
        c.db.run("UPDATE admin SET password_hash = %s WHERE id = 1", (hash_pw(pw),))
        return mulai_sesi(c, {"role": "Admin", "id": 0, "nama": "Administrator"})
    if do == "register":
        pw = str(b.get("password") or "")
        nik, nama, tl, gol, hp, al, alergi = validasi_pasien(c, b, 0)
        if len(pw) < 6: raise Gagal("Password minimal 6 karakter.")
        if b.get("setuju") is not True: raise Gagal("Anda harus menyetujui kebijakan privasi untuk membuat akun.")
        kode = buat_kode()
        pid = c.db.ins("INSERT INTO pasien (nik, nama, tgl_lahir, gol_darah, hp, alamat, alergi, password_hash, setuju_privasi_pada, versi_privasi, kode_pulih_hash) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                       (nik, nama, tl, gol, hp, al, alergi, hash_pw(pw), stempel(sekarang()), VERSI_PRIVASI, hash_pw(kode)))
        catat_audit(c, "privasi_setuju", "pasien", pid, {"versi": VERSI_PRIVASI, "saat": "pendaftaran"}, oleh=nama, peran="Pasien")
        return dict(mulai_sesi(c, {"role": "Pasien", "id": pid, "nama": nama}), kode_pulih=tampil_kode(kode))
    if do == "lupa_password":        # pemulihan mandiri: NIK + tanggal lahir + kode pemulihan
        cek_blokir(c)
        nik, tl, kode, baru = teks(b, "nik"), teks(b, "tl"), norm_kode(b.get("kode")), str(b.get("baru") or "")
        if len(baru) < 6: raise Gagal("Password baru minimal 6 karakter.")
        p = c.db.one("SELECT id, nama, kode_pulih_hash FROM pasien WHERE nik = %s AND tgl_lahir = %s", (nik, tl))
        if not p or not p["kode_pulih_hash"] or not cek_pw(kode, p["kode_pulih_hash"]):
            catat_gagal(c); raise Gagal("Data tidak cocok. Periksa NIK, tanggal lahir, dan kode pemulihan. Jika kode hilang, hubungi admin.", 401)
        kode_baru = buat_kode()          # kode sekali pakai: setelah dipakai diganti dengan yang baru
        c.db.run("UPDATE pasien SET password_hash = %s, kode_pulih_hash = %s WHERE id = %s", (hash_pw(baru), hash_pw(kode_baru), p["id"]))
        catat_audit(c, "reset_password_mandiri", "pasien", p["id"], {}, oleh=p["nama"], peran="Pasien")
        return {"ok": True, "kode_pulih": tampil_kode(kode_baru)}
    if do == "logout":
        c.ses.clear(); c.ses["csrf"] = secrets.token_hex(16)
        return {"ok": True}
    raise Gagal("Aksi tidak dikenal.", 404)


# ---------- action: semua aksi tulis ----------
def _admin(c): return wajib_login(c, ["Admin"])

def pasien_simpan(c, b):
    _admin(c); i = ang(b.get("id"))
    nik, nama, tl, gol, hp, al, alergi = validasi_pasien(c, b, i)
    if i:
        lama = c.db.one("SELECT * FROM pasien WHERE id = %s", (i,)) or {}
        beda = [k for k, a_, b_ in (("nik", lama.get("nik"), nik), ("nama", lama.get("nama"), nama), ("tgl_lahir", lama.get("tgl_lahir"), tl), ("gol_darah", lama.get("gol_darah"), gol), ("hp", lama.get("hp"), hp), ("alamat", lama.get("alamat"), al), ("alergi", lama.get("alergi"), alergi)) if str(a_) != str(b_)]
        c.db.run("UPDATE pasien SET nik = %s, nama = %s, tgl_lahir = %s, gol_darah = %s, hp = %s, alamat = %s, alergi = %s WHERE id = %s", (nik, nama, tl, gol, hp, al, alergi, i))
        if beda: catat_audit(c, "pasien_ubah_admin", "pasien", i, {"bidang": beda})
        return {"ok": True}
    temp = secrets.token_hex(4)
    c.db.run("INSERT INTO pasien (nik, nama, tgl_lahir, gol_darah, hp, alamat, alergi, password_hash) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", (nik, nama, tl, gol, hp, al, alergi, hash_pw(temp)))
    return {"ok": True, "temp": temp}

def pasien_reset_pass(c, b):
    _admin(c); temp = secrets.token_hex(4)
    c.db.run("UPDATE pasien SET password_hash = %s WHERE id = %s", (hash_pw(temp), ang(b.get("id"))))
    catat_audit(c, "reset_password_admin", "pasien", ang(b.get("id")), {})
    return {"ok": True, "temp": temp}

def pasien_hapus(c, b):
    _admin(c); i = ang(b.get("id"))
    if c.db.val("SELECT (SELECT COUNT(*) FROM antrian WHERE pasien_id = %s) + (SELECT COUNT(*) FROM rekam_medis WHERE pasien_id = %s)", (i, i)) > 0: raise Gagal("Pasien punya riwayat, tidak bisa dihapus.")
    c.db.run("DELETE FROM pasien WHERE id = %s", (i,)); return {"ok": True}

def pasien_kosongkan(c, b):
    _admin(c)
    for t in ("push_sub", "audit", "resep", "tagihan", "rekam_medis", "antrian", "pasien"): c.db.run("DELETE FROM " + t)
    return {"ok": True}

def dokter_simpan(c, b):
    _admin(c); i = ang(b.get("id")); nama, sp, tarif, pw = teks(b, "nama"), teks(b, "sp"), ang(b.get("tarif")), str(b.get("password") or "")
    if not nama or not sp or tarif < 1 or len(nama) > 100 or len(sp) > 60: raise Gagal("Nama, spesialis, dan tarif wajib diisi.")
    if pw and len(pw) < 6: raise Gagal("Password minimal 6 karakter.")
    if i:
        c.db.run("UPDATE dokter SET nama = %s, spesialis = %s, tarif = %s WHERE id = %s", (nama, sp, tarif, i))
        if pw: c.db.run("UPDATE dokter SET password_hash = %s WHERE id = %s", (hash_pw(pw), i))
    else:
        c.db.run("INSERT INTO dokter (nama, spesialis, tarif, hari, password_hash) VALUES (%s,%s,%s,%s,%s)", (nama, sp, tarif, "1,2,3,4,5", hash_pw(pw) if pw else None))
    return {"ok": True}

def dokter_hari(c, b):
    _admin(c); i, h = ang(b.get("id")), ang(b.get("h"), -1)
    if not 0 <= h <= 6: raise Gagal("Hari tidak valid.")
    s = c.db.val("SELECT hari FROM dokter WHERE id = %s", (i,))
    if s is None: raise Gagal("Dokter tidak ditemukan.", 404)
    arr = set(hari_arr(s)); arr.symmetric_difference_update({h})
    c.db.run("UPDATE dokter SET hari = %s WHERE id = %s", (",".join(str(x) for x in sorted(arr)), i)); return {"ok": True}

def dokter_hapus(c, b):
    _admin(c); i = ang(b.get("id"))
    if c.db.val("SELECT (SELECT COUNT(*) FROM antrian WHERE dokter_id = %s) + (SELECT COUNT(*) FROM rekam_medis WHERE dokter_id = %s)", (i, i)) > 0: raise Gagal("Dokter punya riwayat, tidak bisa dihapus.")
    c.db.run("DELETE FROM dokter WHERE id = %s", (i,)); return {"ok": True}

# --- akun staf (Kasir dan Apoteker) ---
def staf_simpan(c, b):
    _admin(c); i, nama, peran, pw = ang(b.get("id")), teks(b, "nama"), teks(b, "role"), str(b.get("password") or "")
    if not nama or len(nama) > 100: raise Gagal("Nama wajib diisi.")
    if peran not in STAF: raise Gagal("Peran harus Kasir atau Apoteker.")
    if pw and len(pw) < 6: raise Gagal("Password minimal 6 karakter.")
    if i:
        c.db.run("UPDATE staf SET nama = %s, peran = %s WHERE id = %s", (nama, peran, i))
        if pw: c.db.run("UPDATE staf SET password_hash = %s WHERE id = %s", (hash_pw(pw), i))
    else:
        if not pw: raise Gagal("Password awal wajib diisi (minimal 6 karakter).")
        c.db.run("INSERT INTO staf (nama, peran, password_hash) VALUES (%s,%s,%s)", (nama, peran, hash_pw(pw)))
    return {"ok": True}

def staf_hapus(c, b):
    _admin(c); c.db.run("DELETE FROM staf WHERE id = %s", (ang(b.get("id")),)); return {"ok": True}

# --- obat (Admin dan Apoteker) ---
def _gudang(c): return wajib_login(c, ["Admin", "Apoteker"])

def obat_simpan(c, b):
    _gudang(c); i, nama, stok, harga, smin = ang(b.get("id")), teks(b, "nama"), ang(b.get("stok"), -1), ang(b.get("harga")), ang(b.get("smin"), 20)
    exp = teks(b, "exp")
    if not nama or len(nama) > 100 or stok < 0 or harga < 1 or smin < 0: raise Gagal("Nama, stok (0 atau lebih), harga, dan batas minimum wajib diisi dengan benar.")
    if exp and not tgl_valid(exp): raise Gagal("Tanggal kedaluwarsa tidak valid.")
    exp = exp or None
    if i: c.db.run("UPDATE obat SET nama = %s, stok = %s, harga = %s, stok_min = %s, kedaluwarsa = %s WHERE id = %s", (nama, stok, harga, smin, exp, i))
    else: c.db.run("INSERT INTO obat (nama, stok, harga, stok_min, kedaluwarsa) VALUES (%s,%s,%s,%s,%s)", (nama, stok, harga, smin, exp))
    return {"ok": True}

def stok_masuk(c, b):
    m = _gudang(c); i, j, cat, exp = ang(b.get("id")), ang(b.get("jumlah")), teks(b, "catatan", 200), teks(b, "exp")
    if not 1 <= j <= 100000: raise Gagal("Jumlah stok masuk harus antara 1 dan 100000.")
    if exp and not tgl_valid(exp): raise Gagal("Tanggal kedaluwarsa tidak valid.")
    if c.db.val("SELECT COUNT(*) FROM obat WHERE id = %s", (i,)) == 0: raise Gagal("Obat tidak ditemukan.", 404)
    c.db.run("UPDATE obat SET stok = stok + %s WHERE id = %s", (j, i))
    if exp: c.db.run("UPDATE obat SET kedaluwarsa = %s WHERE id = %s", (exp, i))
    c.db.run("INSERT INTO stok_masuk (obat_id, jumlah, tanggal, catatan, oleh) VALUES (%s,%s,%s,%s,%s)", (i, j, hari_ini(), cat, m["nama"]))
    return {"ok": True}

def obat_hapus(c, b):
    _gudang(c); i = ang(b.get("id"))
    if c.db.val("SELECT COUNT(*) FROM resep WHERE obat_id = %s", (i,)) > 0: raise Gagal("Obat sudah dipakai di resep, tidak bisa dihapus.")
    c.db.run("DELETE FROM obat WHERE id = %s", (i,)); return {"ok": True}

def resep_serah(c, b):
    wajib_login(c, ["Admin", "Apoteker"])
    c.db.run("UPDATE rekam_medis SET resep_status = 'Diserahkan' WHERE id = %s AND resep_status = 'Menunggu'", (ang(b.get("id")),)); return {"ok": True}

# --- antrian dan janji temu ---
def antrian_daftar(c, b):
    m = wajib_login(c, ["Pasien"]); uid = m["id"]
    did, kel, pri = ang(b.get("dok")), teks(b, "kel"), teks(b, "pri") or "Normal"
    h = hari_ini(); tgl = teks(b, "tgl") or h
    if not kel or len(kel) > 300: raise Gagal("Keluhan wajib diisi (maksimal 300 karakter).")
    if pri not in ("Normal", "Darurat"): raise Gagal("Prioritas tidak valid.")
    if not tgl_valid(tgl): raise Gagal("Tanggal tidak valid.")
    if not h <= tgl <= (datetime.datetime.strptime(h, "%Y-%m-%d") + datetime.timedelta(days=14)).strftime("%Y-%m-%d"): raise Gagal("Janji temu hanya bisa untuk hari ini sampai 14 hari ke depan.")
    d = c.db.one("SELECT * FROM dokter WHERE id = %s", (did,))
    if not d: raise Gagal("Dokter tidak ditemukan.", 404)
    if hari_dari_tanggal(tgl) not in hari_arr(d["hari"]): raise Gagal("Dokter ini tidak praktik pada tanggal tersebut.")
    c.db.run("SELECT id FROM dokter WHERE id = %s FOR UPDATE", (did,))        # kunci agar nomor antrian tidak ganda
    if c.db.val("SELECT COUNT(*) FROM antrian WHERE pasien_id = %s AND tanggal = %s AND status IN ('Menunggu','Dipanggil')", (uid, tgl)) > 0: raise Gagal("Anda sudah punya antrian aktif pada tanggal tersebut.")
    n = c.db.val("SELECT COUNT(*) FROM antrian WHERE dokter_id = %s AND tanggal = %s", (did, tgl)) + 1
    no = d["spesialis"][0].upper() + "-" + str(n).zfill(3)
    tunggu = c.db.val("SELECT COUNT(*) FROM antrian WHERE dokter_id = %s AND tanggal = %s AND status = 'Menunggu'", (did, tgl)) * 10
    c.db.run("INSERT INTO antrian (pasien_id, dokter_id, tanggal, no_antrian, keluhan, prioritas, status) VALUES (%s,%s,%s,%s,%s,%s,'Menunggu')", (uid, did, tgl, no, kel, pri))
    return {"ok": True, "no": no, "tunggu": tunggu, "dokter": d["nama"], "tgl": tgl}

def antrian_batal(c, b):
    m = wajib_login(c, ["Admin", "Pasien"]); i = ang(b.get("id"))
    if m["role"] == "Pasien": c.db.run("UPDATE antrian SET status = 'Batal' WHERE id = %s AND pasien_id = %s AND status IN ('Menunggu','Dipanggil')", (i, m["id"]))
    else: c.db.run("UPDATE antrian SET status = 'Batal' WHERE id = %s AND status = 'Menunggu'", (i,))
    return {"ok": True}

def _panggil(c, a):
    c.db.run("UPDATE antrian SET status = 'Dipanggil', dipanggil_pada = %s WHERE id = %s", (stempel(sekarang()), a["id"]))
    kabari(c, a["pasien_id"], "Giliran Anda!", f"Nomor {a['no_antrian']} dipanggil. Silakan masuk ke ruang dokter.")
    kabari_antrian(c, a["dokter_id"])

def antrian_panggil(c, b):
    m = wajib_login(c, ["Dokter"])
    a = c.db.one("SELECT id, pasien_id, dokter_id, no_antrian FROM antrian WHERE id = %s AND dokter_id = %s AND tanggal = %s AND status = 'Menunggu'", (ang(b.get("id")), m["id"], hari_ini()))
    if a: _panggil(c, a)
    return {"ok": True}

def antrian_ulang(c, b):          # panggil ulang: memicu pengumuman suara di layar TV dan notifikasi
    m = wajib_login(c, ["Dokter"])
    a = c.db.one("SELECT id, pasien_id, no_antrian FROM antrian WHERE id = %s AND dokter_id = %s AND tanggal = %s AND status = 'Dipanggil'", (ang(b.get("id")), m["id"], hari_ini()))
    if a:
        c.db.run("UPDATE antrian SET dipanggil_pada = %s WHERE id = %s", (stempel(sekarang()), a["id"]))
        kabari(c, a["pasien_id"], "Dipanggil ulang", f"Nomor {a['no_antrian']} dipanggil lagi. Silakan masuk ke ruang dokter.")
    return {"ok": True}

def antrian_next(c, b):
    m = wajib_login(c, ["Dokter"])
    a = c.db.one("SELECT id, pasien_id, dokter_id, no_antrian FROM antrian WHERE dokter_id = %s AND tanggal = %s AND status = 'Menunggu' ORDER BY (prioritas = 'Darurat') DESC, id ASC LIMIT 1", (m["id"], hari_ini()))
    if not a: raise Gagal("Tidak ada antrian yang menunggu.")
    _panggil(c, a); return {"ok": True, "no": a["no_antrian"]}

# --- rekam medis dan resep (dokter) ---
def rekam_simpan(c, b):
    m = wajib_login(c, ["Dokter"]); uid, aid = m["id"], ang(b.get("aid"))
    v = validasi_rekam(b); items = {}
    for x in (b.get("res") or []):
        oid, j = ang(x.get("id")), ang(x.get("jml"))
        if oid < 1 or j < 1: raise Gagal("Resep tidak valid.")
        items[oid] = items.get(oid, 0) + j
    h = hari_ini()
    a = c.db.one("SELECT * FROM antrian WHERE id = %s AND dokter_id = %s FOR UPDATE", (aid, uid))
    if not a: raise Gagal("Antrian tidak ditemukan.", 404)
    if a["status"] not in ("Menunggu", "Dipanggil"): raise Gagal("Antrian ini sudah selesai atau dibatalkan.")
    if a["tanggal"] != h: raise Gagal("Antrian ini untuk tanggal " + a["tanggal"] + ". Pemeriksaan hanya bisa pada hari H.")
    tarif = c.db.val("SELECT tarif FROM dokter WHERE id = %s", (uid,)); obat_total = 0
    for oid in sorted(items):                                                  # urut agar tidak saling mengunci
        o = c.db.one("SELECT nama, stok, harga, kedaluwarsa FROM obat WHERE id = %s FOR UPDATE", (oid,))
        if not o: raise Gagal("Obat tidak ditemukan.")
        if o["kedaluwarsa"] and o["kedaluwarsa"] < h: raise Gagal(f"{o['nama']} sudah kedaluwarsa dan tidak boleh diresepkan.")
        if o["stok"] < items[oid]: raise Gagal(f"Stok {o['nama']} tidak cukup (sisa {o['stok']}).")
        obat_total += o["harga"] * items[oid]
    rid = c.db.ins("INSERT INTO rekam_medis (antrian_id, pasien_id, dokter_id, tanggal, tekanan_darah, suhu, bb, tb, icd, diagnosis, tindakan, sakit_hari, rujukan, resep_status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                   (aid, a["pasien_id"], uid, h, v["td"], v["suhu"], v["bb"], v["tb"], v["icd"], v["dx"], v["tin"], v["sakit"], v["ruj"], "Menunggu" if items else "Tanpa obat"))
    for oid in sorted(items):
        c.db.run("INSERT INTO resep (rekam_id, obat_id, jumlah) VALUES (%s,%s,%s)", (rid, oid, items[oid]))
        c.db.run("UPDATE obat SET stok = stok - %s WHERE id = %s", (items[oid], oid))
    c.db.run("INSERT INTO tagihan (antrian_id, pasien_id, tanggal, tarif, obat_total) VALUES (%s,%s,%s,%s,%s)", (aid, a["pasien_id"], h, tarif, obat_total))
    c.db.run("UPDATE antrian SET status = 'Selesai' WHERE id = %s", (aid,))
    return {"ok": True}

def rekam_koreksi(c, b):          # koreksi hasil pemeriksaan: wajib beralasan dan selalu tercatat (data lama tidak hilang)
    m = wajib_login(c, ["Dokter"]); rid, alasan = ang(b.get("id")), teks(b, "alasan", 200)
    if len(alasan) < 5: raise Gagal("Alasan koreksi wajib diisi (minimal 5 karakter).")
    r = c.db.one("SELECT * FROM rekam_medis WHERE id = %s AND dokter_id = %s FOR UPDATE", (rid, m["id"]))
    if not r: raise Gagal("Rekam medis tidak ditemukan.", 404)
    v = validasi_rekam(b)
    lama = {"td": r["tekanan_darah"], "suhu": _s(r["suhu"]), "bb": _s(r["bb"]), "tb": _s(r["tb"]), "icd": r["icd"], "dx": r["diagnosis"], "tin": r["tindakan"], "sakit": r["sakit_hari"], "ruj": r["rujukan"]}
    baru = {"td": v["td"], "suhu": _s(v["suhu"]), "bb": _s(v["bb"]), "tb": _s(v["tb"]), "icd": v["icd"], "dx": v["dx"], "tin": v["tin"], "sakit": v["sakit"], "ruj": v["ruj"]}
    beda = {k: [lama[k], baru[k]] for k in lama if str(lama[k]) != str(baru[k])}
    if not beda: raise Gagal("Tidak ada perubahan untuk disimpan.")
    c.db.run("UPDATE rekam_medis SET tekanan_darah = %s, suhu = %s, bb = %s, tb = %s, icd = %s, diagnosis = %s, tindakan = %s, sakit_hari = %s, rujukan = %s WHERE id = %s",
             (v["td"], v["suhu"], v["bb"], v["tb"], v["icd"], v["dx"], v["tin"], v["sakit"], v["ruj"], rid))
    catat_audit(c, "rekam_koreksi", "rekam", rid, {"alasan": alasan, "perubahan": beda})
    return {"ok": True}

def rekam_jejak(c, b):
    m = wajib_login(c, ["Dokter", "Admin"]); rid = ang(b.get("id"))
    if m["role"] == "Dokter" and c.db.val("SELECT COUNT(*) FROM rekam_medis WHERE id = %s AND dokter_id = %s", (rid, m["id"])) == 0: raise Gagal("Rekam medis tidak ditemukan.", 404)
    out = []
    for x in c.db.rows("SELECT waktu, oleh, aksi, rincian FROM audit WHERE objek = 'rekam' AND objek_id = %s ORDER BY id", (rid,)):
        try: rin = json.loads(x["rincian"])
        except ValueError: rin = {}
        out.append({"waktu": x["waktu"], "oleh": x["oleh"], "aksi": x["aksi"], "rincian": rin})
    return {"ok": True, "jejak": out}

# --- profil, privasi, pemulihan akun, dan notifikasi push (Pasien) ---
def profil_simpan(c, b):
    m = wajib_login(c, ["Pasien"]); hp, al, alergi, gol = teks(b, "hp"), teks(b, "al", 200), teks(b, "alergi", 100), teks(b, "gol") or "O"
    if hp and not (hp.isdigit() and 9 <= len(hp) <= 14): raise Gagal("No. HP harus 9 sampai 14 digit angka.")
    if gol not in ("A", "B", "AB", "O"): raise Gagal("Golongan darah tidak valid.")
    lama = c.db.one("SELECT hp, alamat, alergi, gol_darah FROM pasien WHERE id = %s", (m["id"],))
    c.db.run("UPDATE pasien SET hp = %s, alamat = %s, alergi = %s, gol_darah = %s WHERE id = %s", (hp, al, alergi, gol, m["id"]))
    beda = {k: [lama[k2], v_] for k, k2, v_ in (("hp", "hp", hp), ("alamat", "alamat", al), ("alergi", "alergi", alergi), ("gol", "gol_darah", gol)) if str(lama[k2]) != str(v_)}
    if beda.get("alergi") or beda.get("gol"): catat_audit(c, "profil_ubah", "pasien", m["id"], {k: v_ for k, v_ in beda.items() if k in ("alergi", "gol")})   # data klinis penting dicatat
    return {"ok": True}

def privasi_setuju(c, b):
    m = wajib_login(c, ["Pasien"])
    c.db.run("UPDATE pasien SET setuju_privasi_pada = %s, versi_privasi = %s WHERE id = %s", (stempel(sekarang()), VERSI_PRIVASI, m["id"]))
    catat_audit(c, "privasi_setuju", "pasien", m["id"], {"versi": VERSI_PRIVASI, "saat": "login"}); return {"ok": True}

def pulih_kode_baru(c, b):        # membuat kode pemulihan baru (yang lama tidak berlaku lagi); perlu password
    m = wajib_login(c, ["Pasien"]); h = c.db.val("SELECT password_hash FROM pasien WHERE id = %s", (m["id"],))
    if not h or not cek_pw(str(b.get("password") or ""), h): raise Gagal("Password salah.")
    kode = buat_kode()
    c.db.run("UPDATE pasien SET kode_pulih_hash = %s WHERE id = %s", (hash_pw(kode), m["id"]))
    catat_audit(c, "kode_pulih_baru", "pasien", m["id"], {}); return {"ok": True, "kode_pulih": tampil_kode(kode)}

def push_daftar(c, b):
    m = wajib_login(c, ["Pasien"]); ep, k1, k2 = teks(b, "endpoint"), teks(b, "p256dh"), teks(b, "auth")
    if not _push.aktif(): raise Gagal("Notifikasi push belum diaktifkan di server.")
    if not (ep.startswith("https://") and len(ep) <= 600 and k1 and k2 and len(k1) < 200 and len(k2) < 100): raise Gagal("Data langganan notifikasi tidak valid.")
    if c.db.val("SELECT COUNT(*) FROM push_sub WHERE endpoint = %s", (ep,)): c.db.run("UPDATE push_sub SET pasien_id = %s, p256dh = %s, auth = %s WHERE endpoint = %s", (m["id"], k1, k2, ep))
    else: c.db.run("INSERT INTO push_sub (pasien_id, endpoint, p256dh, auth, dibuat) VALUES (%s,%s,%s,%s,%s)", (m["id"], ep, k1, k2, stempel(sekarang())))
    return {"ok": True}

def push_hapus(c, b):
    m = wajib_login(c, ["Pasien"]); c.db.run("DELETE FROM push_sub WHERE endpoint = %s AND pasien_id = %s", (teks(b, "endpoint"), m["id"])); return {"ok": True}

# --- kasir (Admin dan Kasir) ---
def bayar(c, b):
    wajib_login(c, ["Admin", "Kasir"]); i, metode = ang(b.get("id")), teks(b, "metode")
    if metode not in ("Tunai", "QRIS", "BPJS"): raise Gagal("Metode pembayaran tidak valid.")
    t = c.db.one("SELECT * FROM tagihan WHERE id = %s AND lunas = 0 FOR UPDATE", (i,))
    if not t: raise Gagal("Tagihan tidak ditemukan atau sudah lunas.", 404)
    total = t["obat_total"] if metode == "BPJS" else t["tarif"] + t["obat_total"]
    c.db.run("UPDATE tagihan SET metode = %s, total = %s, lunas = 1, tgl_bayar = %s WHERE id = %s", (metode, total, hari_ini(), i)); return {"ok": True}

def ubah_password(c, b):
    m = wajib_login(c); lama, baru = str(b.get("lama") or ""), str(b.get("baru") or "")
    if len(baru) < 6: raise Gagal("Password baru minimal 6 karakter.")
    tb, uid = {"Admin": ("admin", 1), "Dokter": ("dokter", m["id"]), "Pasien": ("pasien", m["id"]), "Kasir": ("staf", m["id"]), "Apoteker": ("staf", m["id"])}[m["role"]]
    h = c.db.val("SELECT password_hash FROM " + tb + " WHERE id = %s", (uid,))
    if not h or not cek_pw(lama, h): raise Gagal("Password lama salah.")
    c.db.run("UPDATE " + tb + " SET password_hash = %s WHERE id = %s", (hash_pw(baru), uid)); return {"ok": True}

AKSI = {f.__name__: f for f in (pasien_simpan, pasien_reset_pass, pasien_hapus, pasien_kosongkan, dokter_simpan, dokter_hari, dokter_hapus, staf_simpan, staf_hapus,
                                obat_simpan, stok_masuk, obat_hapus, resep_serah, antrian_daftar, antrian_batal, antrian_panggil, antrian_ulang, antrian_next, rekam_simpan, rekam_koreksi, rekam_jejak,
                                profil_simpan, privasi_setuju, pulih_kode_baru, push_daftar, push_hapus, bayar, ubah_password)}

def action(c, do):
    f = AKSI.get(do)
    if not f: raise Gagal("Aksi tidak dikenal.", 404)
    return f(c, c.body)
