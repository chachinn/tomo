# Tomo v1 Mega Update QA

## Regression gates

- [ ] Home, Randomize, My Anime and Discover bottom tabs still navigate correctly.
- [ ] Hamburger opens/closes; About Tomo remains available.
- [ ] AniList connect, callback restoration and connected profile still work.
- [ ] Browse My Anime still filters/searches/sorts and lazy-renders correctly.
- [ ] Tune My Pick opens above the blurred backdrop on iPhone.
- [ ] Tune My Pick remains stable while scrolling; X/backdrop close work.
- [ ] Existing advanced filters, BL/GL/harem shortcuts, country/source filters remain present.
- [ ] Tune My Pick Randomize uses selected filters and shows visible errors.
- [ ] Surprise Me with active Tune My Pick filters still respects the filter bridge.
- [ ] Result card, reroll and AniList link still work.

## New feature gates

- [ ] Home fourth card is Roll History, not duplicate Quick Roll.
- [ ] Randomizer shows all 10 mode cards.
- [ ] Backlog Roulette only picks PLANNING.
- [ ] Continue Something only picks CURRENT.
- [ ] Rewatch Roulette only picks COMPLETED.
- [ ] Dropped Rescue only picks DROPPED.
- [ ] Movie Night returns MOVIE.
- [ ] Short & Sweet returns fewer than 13 episodes when episode count is known.
- [ ] Hidden Gem uses lower-popularity + minimum-score constraints.
- [ ] Throwback returns titles starting before 2000.
- [ ] Season Roulette uses the current AniList season/year.
- [ ] Recent Roll History persists locally and caps entries.
- [ ] Maybe Later persists locally and appears in My Anime insights.
- [ ] Not Tonight prevents immediate repeats for 12 hours.
- [ ] Discover shows This Season, Coming Soon, Popular Right Now and Hidden Gems.
- [ ] My Anime insights render read-only AniList statistics or a safe fallback.
- [ ] Watching users with future episodes see Next Episodes on Home.

## Performance / resilience

- [ ] New feature requests are serialized and spaced to avoid burst pressure.
- [ ] Duplicate feature requests use in-memory cache where applicable.
- [ ] Images use lazy loading outside the primary result.
- [ ] Horizontal shelves do not cause body horizontal overflow.
- [ ] No long-running animation or sticky panel follows the user's finger.
- [ ] Reduced-motion preference remains respected.
- [ ] Offline shell still opens after one successful online load.
- [ ] AniList failures show a usable fallback instead of blocking other screens.

## Device matrix

- [ ] iPhone installed PWA — portrait.
- [ ] iPhone Safari — portrait.
- [ ] Desktop narrow viewport.
- [ ] Desktop standard viewport.

Do not mark this update fully Done until the physical iPhone gates pass.
