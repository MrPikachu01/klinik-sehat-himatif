"""_push.py - Web Push (notifikasi saat tab/aplikasi ditutup). Opsional: jika VAPID belum diatur atau pywebpush belum terpasang, semua diam saja."""
import json, os

PUB = os.environ.get("VAPID_PUBLIC_KEY", "")
PRIV = os.environ.get("VAPID_PRIVATE_KEY", "")
SUBJ = os.environ.get("VAPID_SUBJECT", "")          # mis. mailto:admin@klinik.example


def aktif(): return bool(PUB and PRIV and SUBJ)


def kirim_satu(sub, payload):
    """Mengembalikan "ok", "mati" (langganan sudah tidak berlaku, hapus) atau "gagal"."""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        return "gagal"
    try:
        webpush(subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                data=json.dumps(payload), vapid_private_key=PRIV, vapid_claims={"sub": SUBJ}, ttl=300, timeout=4)
        return "ok"
    except WebPushException as e:
        kode = getattr(getattr(e, "response", None), "status_code", 0)
        return "mati" if kode in (404, 410) else "gagal"
    except Exception:
        return "gagal"


KIRIM = kirim_satu        # dapat diganti saat uji
