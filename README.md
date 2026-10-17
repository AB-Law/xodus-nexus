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

*Preview with sample account data.*

## Install

Download the latest x86_64 Linux AppImage from [Releases](https://github.com/domsvoboda/xodus-nexus/releases), make it executable and open it.

For an application-menu installation on supported distributions:

```sh
curl -fsSL https://raw.githubusercontent.com/domsvoboda/xodus-nexus/main/scripts/install.sh | bash
```

In **Settings**, install the **Nexus backend** and **Nexus runtime**, then sign in
with your Microsoft account. A valid game purchase or subscription is required.

If passkey sign-in gets stuck, choose **Continue in browser** in the sign-in
window. This option requires Google Chrome, either a native installation or the
Flatpak version available through Discover. Other browsers are not supported.

[Setup guide and SteamOS requirements](https://github.com/domsvoboda/xodus-nexus/wiki/Getting-started)

## Use

- **My Library** combines owned, Game Pass and installed games, with Access, Play state and title filters.
- **Store** lets you browse and install supported PC games.
- **Manage content** installs licensed add-ons and campaign packages.
- **Install Queue** downloads games one at a time and lets you add more while downloading or playing another game. Pause and resume are supported, including manual resume after restarting the launcher.
- Right-click an installed game for settings, VC++ prerequisites, shortcuts or removal.
- Game settings offer an optional **DualSense compatibility mode** if a standard DualSense is not detected. It applies only to that game and may disable advanced haptics and adaptive triggers.
- Choose **Add to Steam** in the game menu, or **Add Nexus to Steam** in Settings, to create a Non-Steam shortcut with available artwork. Steam can stay running, including in Game Mode. Requires native Linux Steam; Flatpak Steam is not yet supported.
- Update the launcher, backend and runtime in **Settings**.

[Documentation](https://github.com/domsvoboda/xodus-nexus/wiki) ·
[Report an issue](https://github.com/domsvoboda/xodus-nexus/issues)

## How it works

| Component | Role |
| --- | --- |
| Xodus Nexus | Store browsing, library, installation queue and launch controls. |
| Nexus backend | Patched build of [Xodus](https://github.com/xodus-gaming/xodus) for account sign-in, license checks, package downloads and launch preparation. |
| Nexus runtime | Built on [Xodus Proton](https://github.com/xodus-gaming/Proton) and [Xodus XGameRuntime](https://github.com/xodus-gaming/xgameruntime), with additional Nexus compatibility patches. |

Every game uses the same launch path and shared runtime.

## Compatible games

These results come from manual testing and user reports. Other games may work,
but have not been verified and may encounter compatibility issues.

| Game | Playable | Status |
| --- | --- | --- |
| Gears of War: E-Day | Yes | Playable online. |
| Deep Rock Galactic | Yes | Playable online. |
| Minecraft Dungeons | Yes | Playable online with launcher 0.3.5; [ownership failures](https://github.com/domsvoboda/xodus-nexus/issues/80) also reported on other setups. |
| Minecraft Dungeons II | Yes | Playable online. |
| Minecraft for Windows | Yes | Playable online. |
| Minecraft Launcher | Yes | Sign-in and Java download/startup work with launcher 0.3.5; Java online unverified. [Login failure](https://github.com/domsvoboda/xodus-nexus/issues/107) also reported on another setup. |
| No Man's Sky | Yes | Playable online. |
| Valor Mortis | Yes | Fully playable. |
| Forza Horizon 6 | Yes | Playable online; some setups need [VC++ prerequisites](https://github.com/domsvoboda/xodus-nexus/issues/96). [Loading failures](https://github.com/domsvoboda/xodus-nexus/issues/13) also reported. |
| Palworld | Yes | Playable online. |
| DOOM Eternal | Yes | Playable. |
| DOOM: The Dark Ages | Yes | Playable (user report). |
| Fallout 76 | Yes | Playable online; [one reported setup](https://github.com/domsvoboda/xodus-nexus/issues/9#issuecomment-6227548598) requires gamescope to display correctly. |
| The Outer Worlds 2 | Yes | Playable. |
| Wolfenstein: The Old Blood | Yes | Playable. |
| Wasteland Remastered | Yes | Playable. |
| Danganronpa 2 | Yes | Playable. |
| Neon Abyss 2 | Yes | Playable. |
| Hollow Knight: Voidheart Edition | Yes | Playable. |
| Avowed | Yes | Playable. |
| Mortal Shell: Enhanced Edition | Yes | Playable (user report). |
| Sea of Thieves | Yes | Playable online. |
| ARC Raiders | No | Launches but cannot connect to online services. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/100)) |
| Hogwarts Legacy | Yes | Playable. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/110)) |
| Halo: Campaign Evolved | Yes | Playable; may remain running after quitting. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/97)) |
| Resonance: A Plague Tale Legacy | Yes | Playable; black screen reported when ending a game on Steam Deck. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Resident Evil 2 | Yes | Playable; may remain running after quitting. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/110)) |
| Wreckfest | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| TUNIC | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Hades | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Hell Let Loose: Vietnam | No | Crashes after Easy Anti-Cheat initialization on Arch Linux with an Arc A770. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Human: Fall Flat | Partial | Public online game search fails. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Wolfenstein II: The New Colossus | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| The Dungeon of Naheulbeuk: The Amulet of Chaos | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Soul Hackers 2 | No | Reaches the menu, but starting a new game or loading a save fails. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Monster Boy and the Cursed Kingdom | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Hollow Knight: Silksong | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| Teenage Mutant Ninja Turtles: Shredder's Revenge | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| DRAGON QUEST XI S: Echoes of an Elusive Age - Definitive Edition | No | Crashes after the first loading screen. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| ACA NEOGEO METAL SLUG | No | Crashes at launch. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| SIGNALIS | Yes | Playable. ([user report](https://docs.google.com/spreadsheets/d/1HD8fr8XotC2o0seA5TRaiZ3TeltdyUv5aWhxSPeD-6s/edit?usp=sharing)) |
| DREDGE | Yes | Playable. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/106)) |
| Warhammer 40,000: Space Marine 2 | Yes | Playable; online unverified. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/106)) |
| Indiana Jones and the Great Circle | No | Crashes after the publisher logo. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/78)) |
| Microsoft Jewel | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Microsoft Bubble | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| AI: THE SOMNIUM FILES - nirvanA Initiative | Yes | Playable; Store ID detection issue reported. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Minecraft Legends | Yes | Playable; an online session starts, but play with friends is unverified. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| The Elder Scrolls: Arena | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| The Elder Scrolls II: Daggerfall | No | Crashes at launch. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Wolfenstein: Enemy Territory | Partial | Playable, but cannot join PunkBuster-enabled servers. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/107)) |
| Hell Let Loose | No | Crashes at startup. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/105)) |
| Kingdom Come: Deliverance II | No | Crashes at startup. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/112)) |
| PAC-MAN MUSEUM+ | No | Stops after the opening logos. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/61)) |
| Farming Simulator 25 | No | Startup failure reported; updated runtime retest pending. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/62)) |
| PowerWash Simulator 2 | No | Stuck on the initial loading screen. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/69)) |
| Young Souls | Unverified | Launches in Steam Deck Desktop Mode; gameplay unverified. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/8#issuecomment-6225913594)) |
| Remnant II | Unverified | Starts and exits cleanly; gameplay and online were not detailed. ([user report](https://github.com/domsvoboda/xodus-nexus/issues/34#issuecomment-6190973665)) |
| The Witcher 3 | No | Currently crashes on launch. |

[Full compatibility list](https://github.com/domsvoboda/xodus-nexus/wiki/Compatibility)

User reports describe individual setups, not universal compatibility. The wiki
links to report sources and the community spreadsheet. Launch-only reports do
not confirm gameplay or online support.

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
