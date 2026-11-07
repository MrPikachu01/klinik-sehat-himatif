"""buat_vapid.py - membuat pasangan kunci VAPID untuk notifikasi push.
Jalankan sekali:  python tools/buat_vapid.py
Salin tiga nilai yang tercetak ke Environment Variables Vercel. Jangan bagikan VAPID_PRIVATE_KEY."""
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

k = ec.generate_private_key(ec.SECP256R1())
privat = b64(k.private_numbers().private_value.to_bytes(32, "big"))
publik = b64(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
print("VAPID_PUBLIC_KEY=" + publik)
print("VAPID_PRIVATE_KEY=" + privat)
print("VAPID_SUBJECT=mailto:admin@klinik-anda.example   (ganti dengan email Anda)")
