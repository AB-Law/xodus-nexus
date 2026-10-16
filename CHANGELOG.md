# Changelog

## Unreleased

- Support Store game-license change subscriptions in the shared runtime.
- Support Google Chrome installed through Discover/Flatpak for browser sign-in. Thanks @quentingeorgel for reporting the issue.
- Fix games remaining active after a normal exit.
- Fix games exiting during speech initialization when using the bundled runtime.
- Support chunk-order requests for verified installed packages in the runtime.

## 0.3.4

- Fix games failing to launch with a WINEPREFIX error when no custom launch options or overlays are enabled.
- Correct the demo's version display and use wide Store artwork for banners and game details.

## 0.3.3

- Offer Continue in browser when Microsoft passkey sign-in is waiting, including during first-time setup. Requires Google Chrome installed on the computer; other browsers are not supported.
- Let users cancel a waiting passkey request without closing Microsoft sign-in.
- Bundle a fallback font to prevent font-related startup crashes on minimal Linux installations.
- Keep My Library filters after restarting Nexus and close search suggestions when leaving the search field or changing pages.
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
