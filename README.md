# Klinik Sehat - Versi Python + PostgreSQL (siap Vercel)

Sistem informasi klinik dengan backend Python (WSGI tanpa framework) dan PostgreSQL. Banyak orang bisa memakainya bersamaan
dengan data bersama. Pengembang: Indra Wahyudi dan Tim TI Tahun 2026.

## Kondisi awal: sistem kosong
Setelah dipasang, sistem **belum berisi data pasien, antrian, rekam medis, tagihan, atau stok masuk**, seperti sistem yang baru dipakai. Data awal hanya:
- 3 dokter (dr. Ahmad Marsehan, dr. Nopalia, dr. Rani Okta Felani) tanpa password. Admin yang mengaturnya.
- 4 obat contoh (Paracetamol, Amoxicillin, Vitamin C, Antasida). Ubah atau hapus lewat menu Stok Obat.
- Tidak ada akun Kasir dan Apoteker. Admin membuatnya di menu Akun Staf.
Pasien mendaftar sendiri lewat "Daftar akun pasien baru". Setelah masa uji coba, menu **Pengaturan > Kosongkan data pasien** (Admin) menghapus semua pasien beserta antrian, rekam medis, dan tagihan.

## Mulai cepat

**A. Jalankan di komputer sendiri (VS Code)**
1. Pasang Python 3.10+ (centang "Add to PATH") dan VS Code. Ekstrak zip, lalu **File > Open Folder** pada folder ini.
2. Buka terminal VS Code (Terminal > New Terminal), jalankan `python dev_server.py` (Windows: `py dev_server.py`). Alternatif: klik dua kali `jalankan.bat` (Windows) atau `jalankan.sh` (Mac/Linux), atau tekan F5 lalu pilih "Jalankan Klinik Sehat (lokal)".
3. Buka `http://localhost:8000`. Pilih **Admin**, klik **Masuk**, masukkan kode setup yang tercetak di terminal, lalu buat password admin.
4. Layar TV: `http://localhost:8000/tv.html`. Berhenti dengan Ctrl+C.

Data lokal tersimpan di `klinik-dev.db` (SQLite) dan dimulai kosong. Untuk memakai database Postgres sungguhan saat uji lokal, salin `.env.example` menjadi `.env` dan isi `DATABASE_URL`.

**B. Periksa kesiapan lalu deploy ke Vercel**
1. Jalankan `python tools/cek_siap.py` (atau task "Cek kesiapan deploy"). Semua baris harus [OK] atau [INFO].
2. Ikuti bagian "Memasang di Vercel" di bawah: Neon, `schema.sql`, GitHub, Vercel, tiga Environment Variables.
3. Setelah deploy, jalankan `python tools/cek_siap.py` lagi dengan `DATABASE_URL` Neon di `.env` untuk memastikan tabel lengkap.

## Peran dan menu
| Peran | Menu |
|---|---|
| Admin | Dashboard, Data Pasien, Data Dokter, Akun Staf, Antrian, Resep Obat, Stok Obat, Kasir, Laporan, Jejak Audit, Layar TV, Pengaturan |
| Dokter | Dashboard, Rekam Medis, Pengaturan |
| Pasien | Berobat dan Riwayat (antrian, janji temu, notifikasi, dokumen), Profil Saya, Pengaturan |
| Kasir | Kasir, Antrian, Pengaturan |
| Apoteker | Resep Obat, Stok Obat, Pengaturan |

## Fitur
1. **Layar ruang tunggu (TV)**: buka `https://domain-anda/tv.html` di TV atau monitor. Menampilkan nomor yang dipanggil tiap dokter dan antrian berikutnya, tanpa nama pasien. Ketuk layar sekali untuk mengaktifkan suara, lalu setiap dokter memanggil nomor, layar membunyikan nada dan membacakannya. Tombol "Panggil ulang" di halaman dokter mengumumkan ulang.
2. **Notifikasi pasien**: saat halaman Berobat terbuka, pasien mendapat bunyi, getar (di HP), dan pemberitahuan ketika giliran hampir tiba (2 di depan), saat berikutnya, dan saat dipanggil. Notifikasi browser bisa diaktifkan lewat tombol di halaman.
3. **Janji temu hari lain**: pasien memilih dokter dan tanggal (hari ini sampai 14 hari ke depan, sesuai jadwal praktik). Pemeriksaan hanya bisa dilakukan pada hari H.
4. **Rekam medis lengkap**: berat dan tinggi badan (IMT otomatis), diagnosis dengan daftar ringkas kode ICD-10 (bukan seluruh ICD-10, dokter bebas mengetik diagnosis sendiri), surat sakit, dan surat rujukan yang bisa dicetak.
5. **Obat**: tanggal kedaluwarsa (obat kedaluwarsa tidak bisa diresepkan), batas stok minimum per obat, pencatatan stok masuk beserta riwayatnya.
6. **Kasir dan Apoteker**: akun staf dibuat admin. Kasir menerima pembayaran, apoteker menyiapkan dan menyerahkan resep serta mengelola stok.
7. **Laporan**: grafik tren kunjungan dan pendapatan, unduh Excel (.xlsx, tiga lembar), dan kuitansi PDF dengan terbilang rupiah (dari Kasir, Admin, atau pasien yang sudah lunas).

## Perbaikan fungsi menu (v3)
1. **Profil Saya (pasien)**: pasien mengubah sendiri no. HP, alamat, golongan darah, dan alergi. NIK, nama, dan tanggal lahir hanya bisa diubah admin. Perubahan alergi dan golongan darah masuk jejak audit.
2. **Koreksi rekam medis (dokter)**: di menu Rekam Medis ada daftar "Rekam medis terbaru saya" dengan tombol **Koreksi** (wajib beralasan) dan **Jejak**. Data lama tidak hilang: tiap koreksi mencatat siapa, kapan, alasan, dan nilai sebelum dan sesudah. Resep tidak bisa dikoreksi di sini karena memengaruhi stok dan tagihan. Pasien melihat tanda "dikoreksi" di riwayatnya, admin melihat jejak lengkap di menu **Jejak Audit**.
3. **Lupa password pasien**: saat mendaftar, pasien menerima **kode pemulihan** (sekali tampil). Di halaman login, tombol **Lupa password?** meminta NIK, tanggal lahir, dan kode pemulihan. Kode sekali pakai (diganti baru setelah dipakai) dan percobaan salah dibatasi. Pasien yang dibuat admin bisa membuat kodenya sendiri di Profil Saya. Jika kode hilang, admin tetap bisa mereset password.
4. **Persetujuan privasi**: pendaftaran akun mewajibkan centang persetujuan beserta teks kebijakan. Pasien yang dibuat admin atau akun lama akan diminta menyetujui sebelum memakai layanan. Persetujuan (waktu dan versi) tercatat. **Teks kebijakan adalah contoh di `public/js/profil.js`. Sesuaikan dengan kebijakan resmi klinik dan ketentuan perlindungan data pribadi yang berlaku, sebaiknya dengan masukan pihak yang berwenang.**
5. **Notifikasi saat halaman ditutup (Web Push)**: pasien mengaktifkannya di Profil Saya. Server mengirim pemberitahuan saat nomor dipanggil, saat berikutnya, dan saat 2 antrian di depan. Perlu pengaturan sekali (lihat "Mengaktifkan notifikasi push"). Tanpa pengaturan itu, notifikasi tetap berjalan selama halaman terbuka.

## Halaman Tentang dan profil tim pengelola
Halaman **Tentang** berisi foto tim, profil anggota, keterangan sistem, dan teknologi yang dipakai. Halaman ini tidak masuk menu utama, sehingga tidak mengganggu pekerjaan sehari-hari. Cara membukanya:
- **Pengaturan > Tentang > Buka halaman Tentang (profil tim)**, atau
- tautan **Tentang dan tim pengelola** di bawah form login, atau alamat `link-anda/#tentang`.

Mengatur isinya:
1. **Foto tim**: `public/assets/tim/tim.jpg` sudah terpasang. Ganti dengan nama berkas yang sama untuk memperbarui (lebar sekitar 1280 px, maksimal 300 KB).
2. **Anggota**: buka `public/js/tim.js`, lalu isi nama, peran, dan nama berkas foto tiap anggota (contoh format ada di dalam berkas). Foto anggota persegi sekitar 400 x 400 px, maksimal 150 KB, diletakkan di `public/assets/tim/`. Jika foto anggota belum ada, sistem menampilkan inisial nama.
3. Pastikan setiap orang di foto setuju fotonya dipajang, dan jangan memajang foto pasien.

## Struktur
```
klinik-sehat-python/
  public/            tampilan (index.html, tv.html, css/, js/, assets/) - file statis Vercel
  api/index.py       pintu masuk Vercel (/api/me, /api/state, /api/tv, /api/auth, /api/action)
  api/_aksi.py       logika: login, data per peran, semua aksi tulis
  api/_lib.py        database, sesi bertanda tangan, hash password
  database/schema.sql          skema PostgreSQL (aman dijalankan ulang, juga untuk upgrade)
  database/schema_sqlite.sql   skema SQLite untuk uji dan pengembangan lokal
  tests/test_api.py  uji alur backend
  dev_server.py      jalankan di komputer sendiri tanpa Vercel dan tanpa Postgres
  jalankan.bat / jalankan.sh   pintasan menjalankan dev_server.py
  tools/cek_siap.py  pemeriksa kesiapan proyek, deploy, dan database
  tools/buat_vapid.py          pembuat kunci notifikasi push
  .vscode/           pengaturan VS Code (F5 untuk menjalankan, task uji dan cek)
  vercel.json, requirements.txt, .env.example
```

## Mencoba di komputer sendiri
```
python dev_server.py
```
Buka `http://localhost:8000`. Data di file `klinik-dev.db`. Kode setup admin lokal: `setup-lokal-123`. Layar TV: `http://localhost:8000/tv.html`.
Uji backend: `python tests/test_api.py`.

## Memasang di Vercel
1. **Database**: buat project di neon.tech (region **Singapore**), salin connection string versi **pooled**.
2. **Tabel**: buka SQL Editor Neon, tempel seluruh `database/schema.sql`, lalu Run.
   **Jika database sudah dibuat dari versi sebelumnya, cukup jalankan `schema.sql` ini sekali lagi.** Bagian "Pembaruan v2" menambah kolom dan tabel baru tanpa menghapus data.
3. **GitHub**: unggah seluruh isi folder ini ke repository (`vercel.json` harus berada di paling luar).
4. **Vercel**: Add New > Project, impor repository, **Framework Preset: Other**, Build Command kosong.
5. **Environment Variables**:
   - `DATABASE_URL` = connection string dari langkah 1
   - `SECRET_KEY` = teks acak panjang (`python -c "import secrets; print(secrets.token_hex(32))"`)
   - `SETUP_KEY` = kode rahasia buatan Anda (minimal 8 karakter)
   - (opsional, untuk notifikasi push) `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, lihat bagian di bawah
6. **Deploy**, lalu buka link Vercel. Cek `link-anda/api/me`: harus muncul `"ok": true`.
7. **Admin**: pilih Admin, klik Masuk, masukkan `SETUP_KEY`, buat password.
8. **Akun**: di Data Dokter > Ubah atur password dokter. Di Akun Staf buat akun Kasir dan Apoteker. Pasien mendaftar sendiri.
9. **Layar TV**: buka `link-anda/tv.html` di TV ruang tunggu, ketuk sekali untuk mengaktifkan suara.

Perubahan berikutnya: ubah file di GitHub, Vercel memasang ulang otomatis.

## Mengaktifkan notifikasi push (opsional)
1. Di komputer Anda: `pip install cryptography`, lalu `python tools/buat_vapid.py`. Tiga baris yang tercetak berisi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` (ganti emailnya dengan email Anda).
2. Salin ketiganya ke Environment Variables Vercel, lalu **Redeploy**.
3. Pasien membuka **Profil Saya > Aktifkan notifikasi** dan mengizinkan notifikasi.
Catatan: di iPhone, notifikasi push web hanya bekerja jika situs ditambahkan ke Layar Utama (iOS 16.4 ke atas). Jangan bagikan `VAPID_PRIVATE_KEY`. Jika tahap build `pywebpush` gagal di Vercel, hapus baris `pywebpush` dari `requirements.txt`; sistem tetap berjalan tanpa push.

## Untuk banyak pengguna bersamaan
- Satu permintaan = satu transaksi. Nomor antrian dan stok obat dikunci (`FOR UPDATE`) sehingga tidak ada nomor ganda atau stok minus.
- Sesi login di cookie bertanda tangan (cocok untuk serverless). Gunakan connection string **pooled**.
- Browser mengambil data tiap 8 detik (pasien tiap 5 detik). Layar TV memakai `/api/tv` yang di-cache CDN 3 detik, jadi banyak TV tidak membebani database.
- Database gratis Neon tidur saat sepi dan bangun otomatis (permintaan pertama bisa tertunda beberapa detik).

## Keamanan
- Password disimpan sebagai hash PBKDF2, tidak pernah dikirim ke browser. Query memakai parameter (anti SQL injection).
- Hak akses diperiksa di server per peran: pasien hanya melihat datanya, dokter hanya pasiennya, kasir tidak melihat rekam medis, apoteker tidak melihat diagnosis atau keuangan.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` di HTTPS; aksi tulis memakai token CSRF; login dibatasi 8 kali gagal per IP dalam 10 menit.
- Layar TV publik hanya menampilkan nomor antrian dan nama dokter.
- Jejak audit mencatat koreksi rekam medis, perubahan alergi dan golongan darah, persetujuan privasi, dan reset password. NIK tidak disalin ke jejak audit.
- Tanpa penyimpanan sesi di server, tombol Keluar hanya menghapus cookie di browser. Ganti `SECRET_KEY` untuk memaksa semua orang login ulang.

## Batasan
- Zona waktu tetap WIB (UTC+7).
- Suara pada layar TV memakai Web Speech bawaan browser. Kualitas suara bahasa Indonesia bergantung pada perangkat. Coba di TV atau PC yang akan dipakai.
- Daftar ICD-10 hanya contoh diagnosis umum. Surat sakit dan rujukan adalah format dasar, sesuaikan dengan ketentuan klinik.
- Pengiriman Web Push belum diuji terhadap layanan push sungguhan (logikanya diuji dengan pengirim tiruan). Coba di perangkat Anda setelah mengatur VAPID.
- Data kesehatan sungguhan membutuhkan audit keamanan, backup rutin, dan kepatuhan aturan perlindungan data pribadi.
- Bagian PostgreSQL (`schema.sql` dan koneksi psycopg2) belum bisa saya jalankan; logika yang sama lulus uji memakai SQLite. Jika ada error saat deploy, lihat Vercel > Deployments > Logs.
