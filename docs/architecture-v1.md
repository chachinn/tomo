# Tomo v1 modular architecture

User-facing Tomo remains **v1**. Internal file/cache versions continue independently so Git history and regression tracking are preserved.

## Principles

- AniList remains the source of truth for canonical anime/list data.
- Existing auth, library, navigation, Tune My Pick, iOS sheet fixes and write-back safety are preserved until replacement modules pass device QA.
- New functionality lives under `js/core`, `js/features`, and `css` instead of expanding the legacy root files.
- Public/authenticated feature requests use a small serialized cache client to reduce duplicate calls and respect AniList rate pressure.
- Tomo-only preferences such as Roll History, Maybe Later and Not Tonight stay local-only for now.
- No legacy file is deleted merely because a new modular equivalent exists. Removal requires parity/regression verification first.

## Current v1 feature modules

- `js/core/storage.js` — safe local-only Tomo preference storage.
- `js/core/anilist-client.js` — request de-duplication, memory caching and serialized request spacing for new features.
- `js/features/home-v1.js` — removes the redundant Home Quick Roll shortcut and replaces it with Roll History.
- `js/features/randomizer-modes.js` — Surprise Me, Backlog Roulette, Continue Something, Rewatch Roulette, Dropped Rescue, Movie Night, Short & Sweet, Hidden Gem, Throwback and Season Roulette; also Roll History, Maybe Later and Not Tonight.
- `js/features/discovery-hub.js` — This Season, Coming Soon, Popular Right Now and Hidden Gems.
- `js/features/library-insights.js` — read-only AniList statistics and Maybe Later shelf.
- `js/features/airing-schedule.js` — upcoming episodes for currently Watching titles.
- `css/tomo-v1.css` — styles for the modular v1 features.
- `js/tomo-v1.js` — modular entrypoint.

## Legacy compatibility

The existing `app.js`, `navigation/`, `randomizer/`, `library/`, and `auth/` files remain active. This is deliberate: the mega update adds features around the verified current build instead of rewriting working code in one risky migration. Later cleanup PRs may consolidate duplicated implementations only after physical iPhone QA and regression checks pass.
