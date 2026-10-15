# Nexus backend 0.2.2

- Report download progress directly to the launcher without terminal utilities.
- Add Pause / Resume, including recovery from saved checkpoints after restarting the launcher.
- Validate resumed byte ranges and preserve checkpoints after interrupted transfers.
- Report installation failures correctly instead of returning success.
- Resolve Windows executable paths with different letter casing on Linux.
