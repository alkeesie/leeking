# leek.ing bandit demo

This repository contains the leek.ing promotional arcade site used to demonstrate multi-armed bandit strategies for rotating banner advertisements.

## Project structure

The deployable web root lives in `public_html/` and includes:

- `index.html` — landing page with the rotating banner slot and quick links to games.
- `games/` — lightweight arcade: Floppy Blob, Fruit Jump, GoogolMe, 2048 Remix, Simon Lights, Wordling, and Hangman Redux.
- `bandit/` — front-end algorithm implementation and the PHP logger that appends events to `bandit/logs/bandit_log.csv`.
- `dashboard.php` — CSV-backed analytics dashboard summarising performance and regret.
- `control.html` — password-gated control panel for switching algorithms and managing banner arms (password: `S3minar$r`).
- `assets/` — banner creative slots (bring your own MP4/PNG files), optional audio folders, and the leek.ing logo.

The repository ships **without** the MP4/PNG banner creatives and audio clips so you can collaborate without committing large binaries. Drop your production-ready 728x90 assets into `public_html/assets/banners/` before deploying (the filenames referenced by default are `control_static`, `games_rock`, `pac_click`, and `pink_replay`). Game-specific sounds belong in `public_html/assets/audio/`—see that folder's README for the expected filenames. If you want to override the Wordling dictionary, supply optional `solutions.txt` and `allowed.txt` files under `public_html/games/wordling/` (one uppercase word per line); the game will merge them with the default lists.

## Deploying to WebHostMost (or similar shared hosts)

1. Zip or upload the contents of the `public_html/` directory directly into the `public_html` folder that WebHostMost exposes over FTP or its file manager.
2. Ensure the `/bandit/logs/` directory is writable by the web server user. On WebHostMost you can accomplish this from the file manager by selecting the folder and setting permissions to `0755` (or `chmod 755 bandit/logs` over SSH).
3. Visit your domain to confirm the landing page loads and that clicking the rotating banner reaches `/click.html`.
4. Load `/dashboard.php` after a few impressions to verify the CSV logger is appending rows and that the charts render. If the charts are empty, double-check that `bandit/logs/bandit_log.csv` exists and is writable.
5. Access `/control.html` and enter the password `S3minar$r` to confirm the control panel loads. The lock is a light deterrent so the password is stored in session storage during your visit.

## Working locally and committing changes

The project is a regular Git repository, so the typical add/commit workflow applies. A quick refresher if you're new to Git:

1. Run `git status` to review what has changed since the last commit. Files listed under "Changes not staged for commit" still need to be added.
2. Stage the files you want to keep using `git add <path>`. You can stage everything in one go with `git add -A`, but reviewing file-by-file is safer.
3. Verify the staging area again with `git status`; the files you added should now appear under "Changes to be committed".
4. Commit the staged changes with a message describing the work, for example `git commit -m "Update hero copy"`.
5. Push the commit to your remote (e.g., `git push origin work`) when you are ready to share it.

### "binary files not supported" when committing

If you attempt to add large MP4 creatives directly, some Git hosting services may block the push with a "binary files not supported" (or similar) message. To keep the repo lightweight, add the banner videos outside of Git (for example upload them directly to your web host) or configure [Git LFS](https://git-lfs.com/) locally (`git lfs install`, then `git lfs track "*.mp4"`) before committing them. Either approach lets you commit the rest of the project normally while avoiding binary size restrictions.
