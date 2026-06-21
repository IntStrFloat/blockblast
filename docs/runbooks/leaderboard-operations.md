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

> The server verifies every ranked run by **replaying its moves through
> `backend/runtime/`**, which is compiled from `src/core/engine`. The runtime is a
> gitignored build artifact, so it MUST be rebuilt and re-uploaded whenever the
> game engine changes — otherwise the deployed verifier drifts from the client
> engine and silently rejects every honest run (see "Engine drift" below).

1. **Rebuild the runtime from the current engine:** `npm run backend:build`.
   (Skipping this is the #1 cause of leaderboard breakage — do it every deploy.)
2. Verify locally: `npm run backend:test` (rebuilds + replays runs through the engine).
3. Upload `backend/*.cjs` and `backend/runtime/` to `/opt/bloxx/backend`, e.g.:
   ```bash
   rsync -av --delete backend/runtime/ <user>@193.160.208.95:/opt/bloxx/backend/runtime/
   rsync -av backend/*.cjs            <user>@193.160.208.95:/opt/bloxx/backend/
   ```
4. Upload `backend/deploy/bloxx-backend.service` to `/etc/systemd/system/` (if changed).
5. Upload `backend/deploy/nginx-bloxx.conf` to `/etc/nginx/sites-available/bloxx` (if changed).
6. Run `systemctl daemon-reload && systemctl restart bloxx-backend`.
7. Run `nginx -t && systemctl reload nginx` (only if nginx config changed).
8. **Verify the engine is in sync (fast drift check).** `/api/health` returns the
   deployed engine's behavioral fingerprint. Compare it to the locally built runtime —
   no run submission needed:
   ```bash
   LOCAL=$(node -e 'console.log(require("./backend/runtime/index.js").engineFingerprint())')
   LIVE=$(curl -s https://bloxx.193.160.208.95.nip.io/api/health \
     | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log((JSON.parse(d).engine)||"none"))')
   [ "$LOCAL" = "$LIVE" ] && echo "OK: engine in sync ($LOCAL)" || echo "DRIFT: local=$LOCAL live=$LIVE"
   ```
   `OK` means the deployed verifier matches the shipped engine. `DRIFT` (or `engine:none`,
   an old build) → the runtime is stale; repeat from step 1. The expected value is also
   pinned in `src/core/engine/__tests__/fingerprint.test.ts`.
9. Also verify profile bootstrap, ticket issue and leaderboard read still work.
10. **(Optional, deeper)** Confirm a real run is ACCEPTED end-to-end by submitting a
    generated run — useful when changing the run/ticket path, not just the engine:
   ```bash
   API="https://bloxx.193.160.208.95.nip.io" KEY="$(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
   node -e '
   const e=require("./backend/runtime/index.js");
   const A=process.env.API,K=process.env.KEY;
   const f=(p,o={})=>fetch(A+p,{method:o.m||"GET",headers:{Accept:"application/json","Content-Type":"application/json","X-API-Key":K,...(o.t?{Authorization:"Bearer "+o.t}:{})},body:o.b?JSON.stringify(o.b):undefined}).then(r=>r.json().then(j=>({s:r.status,j})));
   (async()=>{
     const b=await f("/api/profile/bootstrap",{m:"POST",b:{nickname:"deploycheck"+Math.floor(Math.random()*1e5)}});
     const t=b.j.authToken; const tk=(await f("/api/tickets",{m:"POST",t})).j.tickets[0];
     let st=e.createGame(tk.seed),mv=[];
     while(st.status==="playing"){let p=false;for(let i=0;i<st.tray.length;i++){const pc=st.tray[i];if(!pc)continue;const s=e.findPlacements(st.board,pc.shape);if(!s.length)continue;mv.push({trayIndex:i,row:s[0][0],col:s[0][1]});st=e.place(st,i,s[0][0],s[0][1]).state;p=true;break;}if(!p)break;}
     const r=await f("/api/runs",{m:"POST",t,b:{ticketId:tk.ticketId,seed:tk.seed,score:st.score,moves:mv,durationMs:60000}});
     console.log(r.s===200?"OK: run accepted, score "+st.score:"DRIFT: "+r.s+" "+JSON.stringify(r.j));
   })();'
   ```
   Expect `OK: run accepted`. `DRIFT: 422 {"error":"invalid_move"|"score_mismatch"}`
   means the deployed runtime ≠ current engine → repeat from step 1.

## Engine drift (ranked runs silently rejected)

**Symptom:** players see their weekly record on the Home card / leaderboard hero, but
have no rank ("Без ранга") and are missing from the list. The leaderboard shows other
players, so the server is reachable — only run submission fails.

**Cause:** the deployed `backend/runtime/` (the verifier) was built from an older
`src/core/engine` than the client app ships. `POST /api/runs` replays the client's
moves through the stale engine, which deals different shapes, so a move becomes illegal
(`422 invalid_move`) or the score differs (`422 score_mismatch`). `store.ts`
`flushPending` treats 422 as permanent and drops the run, so it never reaches
`data.runs`. The record card still shows a number because it falls back to the local
weekly best (`selectEffectiveWeeklyBest` / `resolveWeeklyView`).

**Detect:** the fast fingerprint check in Deploy step 8 (`DRIFT: local=… live=…`), or the
deeper run-acceptance check in step 10 (`DRIFT: 422 …`).

**Fix:** redeploy with a freshly built runtime — Deploy steps 1→9.

**Note on past data:** runs rejected during the drift window are gone; affected players
re-rank automatically on their next ranked run after the fix. Do not mass-migrate.
One-off injections (e.g. `migrations/2026-06-20-pixelpulse-638-weekly-best.cjs`) write a
`movesCount:0` synthetic run and are a band-aid for a single VIP, not a general fix.

## Incident controls

- Disable competition in a client release by omitting `EXPO_PUBLIC_API_URL`.
- Stop writes immediately with `systemctl stop bloxx-backend`; offline gameplay remains available.
- Back up `/var/lib/bloxx/store.json` before manual moderation.
- To hide an abusive nickname, edit the matching user under a maintenance stop and restart the service.
- Never publish `backend.env`, Bearer tokens or the raw data file.

## Weekly reset

No cron job is required. Week boundaries are calculated in UTC for every query,
and historical runs remain in the data file for investigation.
