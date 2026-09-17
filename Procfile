# One process: pins.json is guarded by an in-process lock.
web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120
