-- Klinik Sehat - skema PostgreSQL (Neon, Supabase, atau Postgres lain)
-- Jalankan seluruh file ini di SQL Editor. Aman dijalankan ulang (tabel dan data awal tidak diduplikasi).

CREATE TABLE IF NOT EXISTS admin (
  id SMALLINT PRIMARY KEY,
  password_hash TEXT                                  -- NULL = belum dibuat (dibuat saat login admin pertama)
);
INSERT INTO admin (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS dokter (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  spesialis VARCHAR(60) NOT NULL,
  tarif INTEGER NOT NULL CHECK (tarif > 0),
  hari VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5',      -- 0=Min ... 6=Sab
  password_hash TEXT                                  -- diatur oleh admin
);

CREATE TABLE IF NOT EXISTS pasien (
  id SERIAL PRIMARY KEY,
  nik VARCHAR(16) NOT NULL UNIQUE,
  nama VARCHAR(100) NOT NULL,
  tgl_lahir DATE NOT NULL,
  gol_darah VARCHAR(2) NOT NULL DEFAULT 'O' CHECK (gol_darah IN ('A','B','AB','O')),
  hp VARCHAR(14) NOT NULL DEFAULT '',
  alamat VARCHAR(200) NOT NULL DEFAULT '',
  alergi VARCHAR(100) NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  dibuat TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS obat (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  stok INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  harga INTEGER NOT NULL CHECK (harga > 0)
);

CREATE TABLE IF NOT EXISTS antrian (
  id SERIAL PRIMARY KEY,
  pasien_id INTEGER NOT NULL REFERENCES pasien(id),
  dokter_id INTEGER NOT NULL REFERENCES dokter(id),
  tanggal DATE NOT NULL,
  no_antrian VARCHAR(10) NOT NULL,
  keluhan VARCHAR(300) NOT NULL,
  prioritas VARCHAR(8) NOT NULL DEFAULT 'Normal' CHECK (prioritas IN ('Normal','Darurat')),
  status VARCHAR(10) NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu','Dipanggil','Selesai','Batal'))
);
CREATE INDEX IF NOT EXISTS antrian_dokter_tgl ON antrian (dokter_id, tanggal);
CREATE INDEX IF NOT EXISTS antrian_pasien_tgl ON antrian (pasien_id, tanggal);

CREATE TABLE IF NOT EXISTS rekam_medis (
  id SERIAL PRIMARY KEY,
  antrian_id INTEGER NOT NULL UNIQUE REFERENCES antrian(id),
  pasien_id INTEGER NOT NULL REFERENCES pasien(id),
  dokter_id INTEGER NOT NULL REFERENCES dokter(id),
  tanggal DATE NOT NULL,
  tekanan_darah VARCHAR(10) NOT NULL DEFAULT '',
  suhu NUMERIC(3,1),
  diagnosis VARCHAR(200) NOT NULL,
  tindakan VARCHAR(200) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS rekam_pasien ON rekam_medis (pasien_id);

CREATE TABLE IF NOT EXISTS resep (
  id SERIAL PRIMARY KEY,
  rekam_id INTEGER NOT NULL REFERENCES rekam_medis(id) ON DELETE CASCADE,
  obat_id INTEGER NOT NULL REFERENCES obat(id),
  jumlah INTEGER NOT NULL CHECK (jumlah > 0)
);

CREATE TABLE IF NOT EXISTS tagihan (
  id SERIAL PRIMARY KEY,
  antrian_id INTEGER NOT NULL UNIQUE REFERENCES antrian(id),
  pasien_id INTEGER NOT NULL REFERENCES pasien(id),
  tanggal DATE NOT NULL,
  tarif INTEGER NOT NULL,
  obat_total INTEGER NOT NULL DEFAULT 0,
  metode VARCHAR(5) CHECK (metode IN ('Tunai','QRIS','BPJS')),
  total INTEGER NOT NULL DEFAULT 0,
  lunas SMALLINT NOT NULL DEFAULT 0,
  tgl_bayar DATE
);

CREATE TABLE IF NOT EXISTS login_gagal (
  id SERIAL PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  waktu TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS login_gagal_ip ON login_gagal (ip, waktu);

-- Data awal (hanya jika tabel masih kosong)
INSERT INTO dokter (nama, spesialis, tarif, hari)
SELECT * FROM (VALUES
  ('dr. Ahmad Marsehan', 'Umum', 50000, '1,2,3,4,5,6'),
  ('dr. Nopalia', 'Gigi', 75000, '1,3,5'),
  ('dr. Rani Okta Felani', 'Anak', 60000, '0,1,2,3,4,5,6')
) AS v(nama, spesialis, tarif, hari)
WHERE NOT EXISTS (SELECT 1 FROM dokter);

INSERT INTO obat (nama, stok, harga)
SELECT * FROM (VALUES
  ('Paracetamol 500mg', 120, 3000),
  ('Amoxicillin 500mg', 15, 6000),
  ('Vitamin C', 60, 2000),
  ('Antasida', 8, 2500)
) AS v(nama, stok, harga)
WHERE NOT EXISTS (SELECT 1 FROM obat);

-- ===== Pembaruan v2: fitur baru (aman dijalankan ulang, juga untuk database lama) =====
ALTER TABLE antrian ADD COLUMN IF NOT EXISTS dipanggil_pada TIMESTAMP;
ALTER TABLE obat ADD COLUMN IF NOT EXISTS stok_min INTEGER NOT NULL DEFAULT 20;
ALTER TABLE obat ADD COLUMN IF NOT EXISTS kedaluwarsa DATE;
ALTER TABLE rekam_medis ADD COLUMN IF NOT EXISTS bb NUMERIC(4,1);
ALTER TABLE rekam_medis ADD COLUMN IF NOT EXISTS tb NUMERIC(4,1);
ALTER TABLE rekam_medis ADD COLUMN IF NOT EXISTS icd VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE rekam_medis ADD COLUMN IF NOT EXISTS sakit_hari SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE rekam_medis ADD COLUMN IF NOT EXISTS rujukan VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE rekam_medis ADD COLUMN IF NOT EXISTS resep_status VARCHAR(10) NOT NULL DEFAULT 'Tanpa obat' CHECK (resep_status IN ('Tanpa obat','Menunggu','Diserahkan'));
UPDATE rekam_medis SET resep_status = 'Diserahkan' WHERE resep_status = 'Tanpa obat' AND EXISTS (SELECT 1 FROM resep WHERE resep.rekam_id = rekam_medis.id);

CREATE TABLE IF NOT EXISTS staf (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  peran VARCHAR(10) NOT NULL CHECK (peran IN ('Kasir','Apoteker')),
  password_hash TEXT                                  -- diatur oleh admin
);
CREATE TABLE IF NOT EXISTS stok_masuk (
  id SERIAL PRIMARY KEY,
  obat_id INTEGER NOT NULL REFERENCES obat(id) ON DELETE CASCADE,
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  tanggal DATE NOT NULL,
  catatan VARCHAR(200) NOT NULL DEFAULT '',
  oleh VARCHAR(100) NOT NULL DEFAULT ''
);

-- ===== Pembaruan v3: profil, privasi, pemulihan akun, jejak audit, notifikasi push =====
ALTER TABLE pasien ADD COLUMN IF NOT EXISTS setuju_privasi_pada TIMESTAMP;
ALTER TABLE pasien ADD COLUMN IF NOT EXISTS versi_privasi VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE pasien ADD COLUMN IF NOT EXISTS kode_pulih_hash TEXT;

CREATE TABLE IF NOT EXISTS audit (
  id SERIAL PRIMARY KEY,
  waktu TIMESTAMP NOT NULL,
  oleh VARCHAR(100) NOT NULL,
  peran VARCHAR(10) NOT NULL,
  aksi VARCHAR(30) NOT NULL,
  objek VARCHAR(20) NOT NULL,
  objek_id INTEGER NOT NULL,
  rincian TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS audit_objek ON audit (objek, objek_id);

CREATE TABLE IF NOT EXISTS push_sub (
  id SERIAL PRIMARY KEY,
  pasien_id INTEGER NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  dibuat TIMESTAMP NOT NULL
);
