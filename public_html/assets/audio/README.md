# Arcade audio slots

The games ship without bundled audio so the repository remains binary-free. Add your own sound effects using the filenames below before deploying:

## Fruit Jump (`public_html/assets/audio/fruitjump/`)
- `jump.mp3`
- `game_over.mp3`

## Floppy Blob (`public_html/assets/audio/floppy/`)
- `flap.mp3`
- `pass.mp3`
- `lose.mp3`

## Simon Lights (`public_html/assets/audio/simon/`)
- `pad-1.mp3`
- `pad-2.mp3`
- `pad-3.mp3`
- `pad-4.mp3`
- `ambient.mp3` (background loop when the round begins)
- `lose.mp3`

Upload the clips directly to your host or manage them outside Git. The games will fall back gracefully if a file is missing, so you can play-test without audio while preparing the final assets.
