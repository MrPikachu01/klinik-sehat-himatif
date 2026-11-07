#!/bin/sh
cd "$(dirname "$0")"
echo "Menjalankan Klinik Sehat di http://localhost:8000 (tekan Ctrl+C untuk berhenti)"
python3 dev_server.py
