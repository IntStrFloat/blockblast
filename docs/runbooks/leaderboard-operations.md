# Leaderboard Operations

## Service

```bash
systemctl status bloxx-backend
journalctl -u bloxx-backend -n 200 --no-pager
systemctl restart bloxx-backend
curl https://bloxx.193.160.208.95.nip.io/api/health
```

Application files live in `/opt/bloxx/backend`. Persistent data lives in
`/var/lib/bloxx/store.json`. Runtime secrets live in `/opt/bloxx/backend.env`.

## Deploy

1. Run `npm run backend:test`.
2. Upload `backend/*.cjs` and `backend/runtime/` to `/opt/bloxx/backend`.
3. Upload `backend/deploy/bloxx-backend.service` to `/etc/systemd/system/`.
4. Upload `backend/deploy/nginx-bloxx.conf` to `/etc/nginx/sites-available/bloxx`.
5. Run `systemctl daemon-reload && systemctl restart bloxx-backend`.
6. Run `nginx -t && systemctl reload nginx`.
7. Verify health, profile bootstrap, ticket issue and leaderboard read.

## Incident controls

- Disable competition in a client release by omitting `EXPO_PUBLIC_API_URL`.
- Stop writes immediately with `systemctl stop bloxx-backend`; offline gameplay remains available.
- Back up `/var/lib/bloxx/store.json` before manual moderation.
- To hide an abusive nickname, edit the matching user under a maintenance stop and restart the service.
- Never publish `backend.env`, Bearer tokens or the raw data file.

## Weekly reset

No cron job is required. Week boundaries are calculated in UTC for every query,
and historical runs remain in the data file for investigation.
