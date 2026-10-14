# Nexus runtime — sign-in, cloud saves and shutdown fixes

- Fix sign-in freezes in Minecraft Dungeons II and Gears of War: E-Day by uploading cloud saves in the background.
- Fix async cancellation and completion-callback deadlocks that could prevent games, including Palworld, from closing.
- Add cloud-save device handover and local/cloud conflict dialogs, preserving the selected progress for synchronization.
- Improve cloud-save shutdown draining and session finalization.
- Restore Xbox gamer pictures by correcting authenticated profile-image requests.

**We recommend updating Nexus runtime from Settings.** These are shared runtime fixes, not game-specific workarounds, and other games may benefit too.
