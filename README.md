<div align="center">

<img src="assets/icon.png" width="96" alt="Xodus Nexus" />

# Xodus Nexus

Your Microsoft Store PC games, on Linux.

[![CI](https://github.com/domsvoboda/xodus-nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/domsvoboda/xodus-nexus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

An Xbox-inspired launcher built on [Xodus](https://github.com/xodus-gaming/xodus),
using our patched Nexus backend and Nexus runtime.
Browse the Store, install games you own or can access through a subscription,
and play with one shared runtime. Xbox sign-in and cloud saves are available
for supported games.

![Xodus Nexus demo](docs/screenshots/demo.gif)

*Version 0.3.0 demo with a sample account, owned and Game Pass library, and install queue. Screenshots are not compatibility claims.*

## Install

On x86_64 Linux, the installer sets up system prerequisites, the latest AppImage
and an application-menu entry:

```sh
curl -fsSL https://raw.githubusercontent.com/domsvoboda/xodus-nexus/main/scripts/install.sh | bash
```

<details>
<summary>Manual AppImage installation</summary>

Download the AppImage from [Releases](https://github.com/domsvoboda/xodus-nexus/releases), then:

```sh
chmod +x Xodus-Nexus-0.3.0-x86_64.AppImage
./Xodus-Nexus-0.3.0-x86_64.AppImage
```

No Rust, Cargo or `protoc` is needed for the prebuilt backend. It requires GTK 3,
WebKitGTK 4.1 and a desktop secret service for sign-in.
Distribution-specific runtime prerequisites are listed in the
[setup guide](https://github.com/domsvoboda/xodus-nexus/wiki).

</details>

On first run, install the prebuilt Nexus backend and Nexus runtime in
Settings, and sign in to your Microsoft account. Both components are downloaded
as verified precompiled packages from Nexus Releases. No local compilation is
needed; neither component is bundled with the AppImage.

With a compatible Nexus backend, the account panel shows your Xbox gamertag and
profile picture. Profile details are cached locally; email and a default avatar
remain available when Xbox profile data cannot be loaded.

The account sidebar automatically loads verified Game Pass membership from
Microsoft Store using the existing sign-in, without another login window.
Unavailable or outdated subscription information does not show a badge.

My Library combines installed games with account-licensed PC games, including
Game Pass. **Owned** identifies direct or owned-bundle access, separately from
subscription access. Filter by **Access**, **Play state**, or search by title.
Account listings require an updated backend and a verified supported PC package;
add-ons and unsupported packages are excluded. Installed games remain available
when account information is unavailable. Store remains the full catalog.

For an installed game, **Manage content** lists its declared related packages
separately from the game library. With a compatible Nexus runtime, install or
repair licensed PC content through the normal Install Queue. Content is stored
separately from the base game; restart the game after installation. Unverified
licenses, ambiguous packages and unsupported formats cannot be installed here.

Launcher updates appear in the top-right corner. Install them from Settings and
restart; the previous AppImage is kept for rollback. Backend and runtime updates
are versioned independently. In My Library, **Check game updates** marks installed
games with a newer verified package version without changing their files.

The Install Queue supports **Pause / Resume**, including after restarting the
launcher, with a compatible Nexus backend. Download checkpoints stay in the
installation folder and are checked against the package before continuing.
Progress comes directly from the backend; no `script` or `util-linux` package
is needed for download progress.

Right-click an installed game in My Library to create a desktop shortcut or add
it to the applications menu. Shortcuts start the game through Nexus with the same
runtime, account and cloud-save setup as Play, without opening the main window.
If you move the AppImage manually, open it once from its new location to refresh
existing shortcuts. Game artwork is cached locally for shortcut icons, with the
Nexus icon as a fallback. Your desktop may ask you to allow launching a new shortcut.

[Downloads](https://github.com/domsvoboda/xodus-nexus/releases) ·
[Setup & documentation](https://github.com/domsvoboda/xodus-nexus/wiki) ·
[Report an issue](https://github.com/domsvoboda/xodus-nexus/issues)

## How it works

| Component | Role |
| --- | --- |
| Xodus Nexus | Store browsing, library, installation queue and launch controls. |
| Nexus backend | Patched build of [Xodus](https://github.com/xodus-gaming/xodus) for account sign-in, license checks, package downloads and launch preparation. |
| Nexus runtime | Built on [Xodus Proton](https://github.com/xodus-gaming/Proton) and [Xodus XGameRuntime](https://github.com/xodus-gaming/xgameruntime), with additional Nexus compatibility patches. |

Every game uses the same launch path and shared runtime. Compatibility fixes
belong in the backend/runtime, not in title-specific launcher routes.

## Compatible games

These games have been manually tested. Other games may work, but have not been
verified and may encounter compatibility issues.

| Game | Playable | Status |
| --- | --- | --- |
| Gears of War: E-Day | Yes | Playable online. |
| Deep Rock Galactic | Yes | Playable online. |
| Minecraft Dungeons II | Yes | Playable online. |
| No Man's Sky | Yes | Playable online. |
| Valor Mortis | Yes | Fully playable. |
| Forza Horizon 6 | Yes | Playable online. |
| Palworld | Yes | Playable online. |
| DOOM Eternal | Partial | Campaign works; Horde and BATTLEMODE unlock with an unreleased runtime fix and the campaign package installed. Paid DLC and online play unverified ([#10](https://github.com/domsvoboda/xodus-nexus/issues/10)). |

[Full compatibility list](https://github.com/domsvoboda/xodus-nexus/wiki/Compatibility)

## Screenshots

[Library](docs/screenshots/demo-library.png) ·
[Store](docs/screenshots/demo-store.png) ·
[Install queue](docs/screenshots/demo-downloads.png) ·
[Settings](docs/screenshots/demo-settings.png)

Independent project, not affiliated with Microsoft or Xbox. A valid game license
is required. Launcher: [MIT license](LICENSE). The separate Xodus backend retains
its upstream GPLv3 license and ships with corresponding source.
The Nexus runtime includes [FFmpeg](https://ffmpeg.org/) shared libraries under
LGPL 2.1 or later; its corresponding pinned source and build recipe accompany
each runtime release.
[Contributing](CONTRIBUTING.md)
