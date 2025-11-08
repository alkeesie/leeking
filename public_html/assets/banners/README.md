# Banner creative placeholders

The rotating ad slot expects 728x90 banner creatives for each arm listed in `public_html/bandit/bandit.js`.

Add matching `.mp4` and `.png` files for every arm before deploying:

- `control_static` → `control_static.mp4` and `control_static.png`
- `games_rock` → `games_rock.mp4` and `games_rock.png`
- `pac_click` → `pac_click.mp4` and `pac_click.png`
- `pink_replay` → `pink_replay.mp4` and `pink_replay.png`

Store the production assets outside Git (for example upload directly to your web host or track them with Git LFS) to avoid binary file restrictions. The application will fall back to static imagery if the `.mp4` is missing, so at minimum provide the PNG poster.
