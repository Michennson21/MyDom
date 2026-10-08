# Server storage — pilot, not deployed

The application and API must be served from the **same HTTPS origin**. GitHub Pages alone cannot run this API. Node.js 24 provides HTTP, crypto and SQLite; there are no npm dependencies. One process, one persistent SQLite volume. Do not horizontally scale this configuration.

Features: invite-only registration, password login, HttpOnly/SameSite cookies (Secure on HTTPS), private per-user document with all apartment workspaces, optimistic revision checking, ten earlier document revisions. Passwords use scrypt and random salts; session tokens are hashed in the database. Authentication requests are limited by socket IP (30 per 15 minutes); behind a reverse proxy this is a shared pilot limit. No forwarded IP headers are trusted.

## Local launch

```sh
APP_ORIGIN=http://localhost:8080 DATABASE_PATH=./server/data/mydom.sqlite REGISTRATION_CODE=choose-a-private-invite node server/server.mjs
```

Open http://localhost:8080, then «Ещё» → «Учётная запись и сервер». Registration needs the configured invitation. Do not commit the invitation or database to git.

## Deployment on an existing server

```sh
docker build -f server/Dockerfile -t mydom .
docker run -d --restart unless-stopped --name mydom \
  -p 127.0.0.1:8080:8080 \
  -v mydom-data:/data \
  --env-file /secure/path/mydom.env mydom
```

`mydom.env` (outside the repo; mode 600):

```text
APP_ORIGIN=https://YOUR-APP-DOMAIN
REGISTRATION_CODE=YOUR-LONG-RANDOM-INVITATION
```

Configure the existing HTTPS reverse proxy for that domain to forward to 127.0.0.1:8080; cap request bodies at 2 MB and request timeouts. Do not expose port 8080 or the database publicly. The API rejects cross-origin mutations. Set up persistent-disk monitoring and daily SQLite online backups; preserve WAL consistency, not a live main-file-only copy. Old per-user document revisions are not a replacement for independent backups. Verify restore on a separate volume before inviting residents.

## Data transfer and limitations

Server saving is **explicit**, not automatic: «Сохранить на сервер» uploads all local apartments; «Загрузить с сервера» restores all server apartments. Local data never uploads on login. A revision conflict blocks overwrite. Reload/login fetches the server revision; load the server copy before editing if another device changed it. Before restore, the prior local snapshot is retained at `mydomBeforeCloudRestore` for manual recovery. Logging out invalidates the session but keeps local data; shared devices are not yet supported as private multi-user kiosks.

Data currently on GitHub Pages is on a different browser origin and will not appear automatically on the server domain. Export/import transfer UI must be used for that move (see app buttons). Do not paste personal data into GitHub issues.

Remaining production work: chosen server/domain and actual deployment, operational backups, password recovery, account deletion/export workflow, automatic sync and shared-device cleanup. No real payments or supplier connections are added. Until deployed, Pages continues to work locally and shows that server storage is unavailable.

Tests: `node --test server/server.test.mjs`.

## Consistent SQLite backup

Run `node server/backup.mjs /backup/mydom-YYYY-MM-DD.sqlite` inside the container with a separately mounted backup directory writable by the node user. This uses SQLite's online backup API. Schedule it daily in the host's scheduler and retain encrypted copies outside the application disk. Restore while the application is stopped: replace the database with a verified backup and remove only the old matching WAL/SHM files before restarting. Never overwrite a running database.
