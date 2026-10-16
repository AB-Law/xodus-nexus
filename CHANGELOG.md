# Changelog

## Unreleased

- Fix desktop game shortcuts reporting an invalid profile path when Nexus is already running.
- Show an installation package picker for Store offers with multiple downloads instead of waiting for terminal input. Requires the updated Nexus backend.
- Name game shortcut files after the game, with safe handling of duplicate titles.
- Add per-game MangoHud, gamescope and custom command-prefix settings.
- Align the game details with the library grid and give installed and installable cards matching heights.
- Use Store covers and wide detail artwork instead of small package icons, with a local-image fallback.
- Use wide Store artwork for the Home banner instead of stretching package icons.
- Make the library refresh control compact and aligned with the filters.

## 0.3.2

- Fix Microsoft sign-in on SteamOS without installing WebKitGTK or changing the system partition. Start the built-in KDE keyring automatically when needed.
- Keep My Library's Access, Play state and search filters when switching between tabs.

The updated sign-in backend requires launcher 0.3.2 or newer. Update both the launcher and Nexus backend.
