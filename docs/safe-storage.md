# Safe local storage and backup import (0.33)

All application writes now go through SafeStore. Web Locks serialize writers on this origin; a complete snapshot comparison rejects stale writes, including concurrent requests from the same page. A conflict leaves the form open and offers reload instead of automatically discarding an unfinished draft. Different devices still use the existing server revision check.

Before a multi-key write, a localStorage undo journal is persisted. A failure rolls back changed keys; if rollback fails, the journal is retained and further writes are blocked. Bootstrap recovers the journal under the same lock before executing any application scripts. Memory is updated only after successful storage. The journal is not a long-term backup.

BackupSchema is shared by file import, local startup/commits, and the server PUT endpoint. It validates known storage keys, collection/object/field types, safe identifiers, every apartment workspace and active address consistency. It rejects executable icon markup and prototype keys. Rendering derives account icons from the app's fixed icon set. Existing version-1 exports are supported; a file must contain the original core keys, optional newer fields may be absent. Validation rejects an invalid file as a whole, without partial salvage or replacement.

File and server restore retain the preceding snapshot atomically. The backup panel can restore this preceding snapshot; that action in turn retains the current snapshot. Only one preceding restore snapshot is kept. Invalid startup data is left intact, with raw recovery download and validated backup import available outside the main app.

Limits:
- This does not protect against clearing browser/site data, device loss, or disk failure. Export copies separately. Backups still contain unencrypted personal information.
- All tabs must run this release to participate in the lock protocol. Close/reopen older app tabs after deployment; older code cannot be retroactively made lock-aware.
- Browsers without Web Locks stop at the recovery screen rather than performing unsafe writes. Test actual iPhone/Safari camera, print and downloads before a public release.
- Temporary space is needed for the undo journal and preceding restore snapshot. Insufficient quota cancels the operation.
- Protection against malformed imports is not a claim that the whole app has undergone a comprehensive security audit.

Validation: schema/API unit tests; safe-storage browser tests covering malicious and nested malformed imports, simultaneous/stale tabs, single/multi-key quota failures, failed rollback, restart recovery, import undo and recovery from invalid startup data. Existing apartment, home, meter, complaint and cloud browser suites also exercised; their synthetic fixtures/waits were adjusted for explicit schema validation and asynchronous commits.
