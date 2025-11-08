# Banner creative placeholders

The rotating ad slot expects 728x90 banner creatives for each arm listed in `public_html/bandit/bandit.js`.

Add matching `.mp4` (optional, for motion) and `.png` poster files for every arm before deploying. To keep this repository text-only, the repo only includes empty slots; upload or sync the real files directly to your host:

- `control_static` → provide `control_static.mp4` and `control_static.png`
- `games_rock` → provide `games_rock.mp4` and `games_rock.png`
- `pac_click` → provide `pac_click.mp4` and `pac_click.png`
- `pink_replay` → provide `pink_replay.mp4` and `pink_replay.png`

If the assets are missing at runtime the banner script renders a generated placeholder so pages still paint cleanly during development.
