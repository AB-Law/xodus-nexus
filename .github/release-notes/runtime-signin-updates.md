# Nexus runtime — connectivity, sign-in and Store fixes

## Bug fixes

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
