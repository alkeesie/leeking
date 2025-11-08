# Wordling dictionaries

The Wordling mini game fetches the official Wordle solution and allowed word lists from GitHub, but you can override them without editing code.

Drop optional text files in this folder before deployment:

- `solutions.txt` — candidate solution words (one uppercase word per line).
- `allowed.txt` — extra valid guesses (also uppercase, one per line). This list is merged with the solutions file and the default GitHub list when available.

If either file is missing the game falls back to the hosted lists and a small built-in set so you can keep testing locally.
