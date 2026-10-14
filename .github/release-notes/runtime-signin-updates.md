# Nexus runtime — bootstrap and PlayFab game-save fixes

## Bug fixes

- Supply the package-local save directory when the native PlayFab Game Saves
  SDK omits it; preserve the game's original SDK, arguments and genuine results.
- Correct inline XML and default game-config discovery during GDK initialization.
- Allow valid initialization to retry after a malformed config instead of
  incorrectly reporting success with uninitialized package identity.
- Handle the backend's owner-only-write temporary launch folders safely by
  sealing them before staging SDK compatibility files.
- Enable the temporary Gaming Services compatibility version **38.117.27001.0**
  by default, with correctly encoded CurrentVersion and AvailableVersion values.

The owner confirmed that the local diagnostic Forza Horizon 6 build passes the
Gaming Services gate and its account-enabled test looks good. No Man's Sky
remains nonworking in the same shared runtime. These are shared runtime changes;
launcher and backend code are unchanged. The exact published CI artifact was
checksum/provenance-verified and passed automated native/media/network checks,
but was not subjected to another real-game test, by explicit owner approval.

The hardcoded version is a temporary compatibility workaround, not installation
of Microsoft Gaming Services or proof that all its APIs are implemented.
`NEXUS_GAMING_SERVICES_VERSION_OVERRIDE=0` disables further version writes;
values already stored in an existing prefix are not automatically reverted.
There is no new full cloud-save roundtrip or multiplayer-match claim.

## Retained fixes from earlier releases

- Bundle pinned H.264/AAC decoders so intro videos play instead of color bars.
- Accept the GDK WinHTTP IPv6 fallback and websocket timeout options.
- Deliver the initial connectivity notification required by network clients.
- Support secure websocket (WSS) security queries with actual TLS verification.
- Correct async queue retention, user initialization and token-result encoding.
- Read installed package identity and version from the game manifest.
- Implement asynchronous Store package-update queries and their result methods.
- Execute token/signature network work outside the game task dispatcher and
  retain the user and request context until the worker completes.

Minecraft Dungeons II sign-in and entry into Online mode were manually verified
on the local candidate. These changes are shared runtime fixes, not title-specific
launcher switches. This runtime also retains the bundled H.264/AAC intro-video
decoders from the earlier media fix.

Requires Nexus backend **0.2.1 or newer**. Update the backend before the runtime.
Package-update support currently covers verified current-game no-update queries;
DLC, mandatory-update policy and update installation remain unsupported.
