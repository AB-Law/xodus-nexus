# Shared Nexus backend

## Structured downloads

`streaming --progress-json --control-stdin` enables Nexus progress protocol v1.
The CLI emits `NEXUS_PROGRESS ` followed by one JSON object per line. Records
carry `schema`, monotonically increasing `sequence`, `event: "progress"`, `phase`,
`completedBytes`, nullable `totalBytes`, `bytesPerSecond`, `paused` and `canPause`.
Progress updates are throttled; phase/control/terminal transitions are immediate.
Logs remain separate from these prefixed records. A successful process exit AND
a `complete` record are required before the launcher marks installation complete.

Stdin accepts `{"schema":1,"command":"pause"}` and `resume` commands, one per
line. Pause is available during game-file transfer, not metadata/finalization.
It cooperatively closes HTTP streams and checkpoints flushed output; resume opens
validated Range requests without stopping the process or discarding files.

`.nexus-streaming-v1.jsonl` in the destination is an append-only checkpoint
journal, compacted atomically on reopen. Identity includes signed XVD/header data
and the exact file layout. Checkpoints record completed byte offsets and a
SHA-256 boundary digest; they are synced after file data, on pause/completion and
at most every 32 MiB while transferring. After interruption the last unchecked
tail may be downloaded again; this is not a full-file integrity verification.
A changed package, missing/truncated file or mismatched boundary is not resumed
from an unverified offset. An exclusive folder lock prevents concurrent writers.
CDN URLs/credentials are never stored in the journal. Restart refreshes normal
package authentication/URLs, then restores matching checkpoints.

The launcher probes `streaming --help` before enabling these optional features.
Older backends can still download without numeric progress or pause controls.

`assets/backend-source.lock.json` pins the upstream Git commit, Cargo.lock hash,
Rust toolchain, backend package version and ordered SHA-256 patch set. Launcher
and CI use the same recipe. Updating upstream is an explicit reviewed change;
the normal install path never clones moving `main` or silently compiles.

The backend workflow builds CLI + service on Ubuntu 22.04, runs the account-free
launch-chain tests and CLI capability checks, then packages:

- `xodus-nexus-backend-<version>-linux-x86_64.tar.xz` and SHA-512
- matching `.manifest.json` (recipe/source identity and per-file hashes)
- matching `-source.tar.xz` and SHA-512 (patched upstream, vendored dependencies,
  offline Cargo configuration, recipe, build instructions and retained licenses)
- `candidate.json` binding all five assets to the Nexus commit and workflow run

Native build dependencies: Git, Rust from the lock, Node 22, Cargo, pkg-config,
C/C++ toolchain, OpenSSL, protoc, CMake, D-Bus development headers,
tar/xz. For a clean build:

```sh
node scripts/build-backend.mjs --work ./backend-build --output ./backend-release
```

Directories must not already exist. The source archive can also be built
offline with the locked Rust toolchain: from `source/`, run
`cargo build --locked --offline --release --no-default-features -p xodus-cli -p xodus-service`.

Promotion is manual: select `backend` in the existing release workflow after
recording exact-candidate approval. It verifies provenance/checksums and creates
`backend-v<version>` without rebuilding, and does not replace the latest launcher
release. Never overwrite a version's published assets; bump backend version and
ship a matching launcher recipe for a changed backend. Versions are independent
of launcher and Wine runtime versions.

Launcher uses only stable releases from this repository, the exact pinned
recipe, matching source assets, checksum verification, a strict regular-file
archive layout, ELF architecture and CLI feature validation. Installation swaps
the active pointer atomically only while idle; older builds remain available.
An unavailable/private release, incompatible system libraries or failed checksum
never causes automatic compilation or a production backend replacement.

Default install needs no Git/Cargo/protoc/GitHub authentication. Linux x86_64,
glibc compatible with Ubuntu 22.04, OpenSSL 3, D-Bus, tar/xz and the desktop's
secret service are needed. Other architectures/musl and other distributions
have not been validated. Missing-library failures are shown in Settings.

Advanced / Diagnostics retains an explicit local build from the same source
and patches, for developers only. It does not build the Wine runtime. No probe
runs `xodus-service --help`: that upstream binary starts device authentication
instead of parsing a help option. Service identity is checked by its ELF/header
and hashes; account/cloud/game functionality requires separate manual testing.

The Electron launcher is MIT-licensed. The separately distributed Xodus backend
retains its upstream GPLv3 license; dependency licenses and corresponding source
are included with every candidate. No proprietary game files, credentials or
saves are packaged.

## Electron sign-in host (backend 0.2.3, launcher 0.3.2)

`assets/xodus-external-auth.patch` is part of the locked backend patch series.
The packaged recipe uses `--no-default-features` to build
a CLI without Tao/Wry, GTK or WebKit linkage. All authentication, token exchange
and keychain storage remain in the backend.

The launcher detects the CLI's `--external-webview-stdio` capability before
starting sign-in. It
hosts the Microsoft page in a separate sandboxed, context-isolated Electron
window with no Node or launcher API. Private stdio carries versioned, bounded
UI messages, never a listening port. Initial headers and navigation destinations
are restricted, cookies live only for one attempt, and cancellation cleans up
the window and child process. Protocol messages are not added to UI logs.

Backend 0.2.3 requires launcher 0.3.2 or newer. The source keeps upstream's native
WebKit feature for developers, but public packages use one Electron-hosted path.
Use separate profiles for development and never replace a validated release
artifact. Game compatibility is listed in the compatibility guide.

The separate `xodus-keyring-activation.patch` handles KDE systems
that advertise their installed Secret Service under `org.kde.secretservicecompat`
only. It activates that existing user service if the standard Secret Service
name has neither an owner nor an activation provider. Existing/default providers
are left alone. No packages, keyring configuration or plaintext fallback are
introduced, and keyring failures remain errors.
