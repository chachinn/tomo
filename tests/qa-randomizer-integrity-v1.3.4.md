# Tomo Randomizer Integrity QA — v1.3.4

This QA gate exists because Tomo currently has several randomizer entry points (Tune My Pick, Surprise Me, purpose-built modes, and Reroll). The rule is that the most recent roll source owns Reroll, and AniList list-status modes must use live AniList status data rather than a previously loaded library snapshot.

## Status integrity

- [ ] Tune My Pick → My AniList → Planning only returns PLANNING entries.
- [ ] Tune My Pick → Watching only returns CURRENT entries.
- [ ] Tune My Pick → Completed only returns COMPLETED entries.
- [ ] Tune My Pick → Dropped only returns DROPPED entries.
- [ ] Multiple selected statuses return only entries in the selected status set.
- [ ] Backlog Roulette uses a fresh AniList PLANNING query and does not trust a stale My Anime snapshot.
- [ ] Continue Something uses a fresh CURRENT query.
- [ ] Rewatch Roulette uses a fresh COMPLETED query.
- [ ] Dropped Rescue uses a fresh DROPPED query.

## Reroll ownership

- [ ] A filtered Planning result rerolls with the exact same filter options.
- [ ] After a filtered result, choosing Movie Night makes Reroll stay Movie Night and never fall back to the old filtered Planning state.
- [ ] After a purpose-built mode, choosing Surprise Me makes Reroll use the latest Surprise Me result source rather than the previous mode/filter source.
- [ ] Reroll never fires two roll engines for one tap.

## Result metadata and feedback

- [ ] Filtered results populate the current result media id/title/cover metadata.
- [ ] Maybe Later after a filtered result saves the anime currently visible, not a previous result.
- [ ] Not Tonight after a filtered result skips the anime currently visible.
- [ ] Successful filtered rolls close Tune My Pick and reveal the generated result.
- [ ] Filtered result transitions do not alter selected Tune My Pick filters.

## Public-mode constraints

- [ ] Movie Night returns MOVIE.
- [ ] Short & Sweet returns fewer than 13 episodes when episode count is known.
- [ ] Hidden Gem applies lower-popularity and minimum-score constraints.
- [ ] Throwback starts before 2000.
- [ ] Season Roulette uses the current season/year.

## Stability

- [ ] One tap creates one network roll path.
- [ ] Busy states disable the active trigger until the roll completes.
- [ ] AniList failures surface a visible error/toast and leave the previous result intact.
- [ ] No randomizer path depends on stale cached list status for correctness.
- [ ] iPhone installed PWA: run Planning → Reroll ×5 → Movie Night → Reroll ×3 → Surprise Me → Reroll ×3.

Do not mark this gate complete until the physical iPhone sequence passes.
