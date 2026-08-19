# Tomo v1 Mega Update QA

## Regression gates

- [ ] Home, Randomize, My Anime and Discover bottom tabs still navigate correctly.
- [ ] Hamburger opens/closes; About Tomo remains available.
- [ ] AniList connect, callback restoration and connected profile still work.
- [ ] Browse My Anime still filters/searches/sorts and lazy-renders correctly.
- [ ] Tune My Pick opens above the blurred backdrop on iPhone.
- [ ] Tune My Pick remains stable while scrolling; X/backdrop close work.
- [ ] Existing advanced filters, BL/GL/harem shortcuts, country/source filters remain present.
- [ ] Straight / Heterosexual shortcut is present and filters by AniList's Heterosexual tag.
- [ ] Existing relationship shortcuts still cycle include -> exclude -> clear.
- [ ] Tune My Pick Randomize uses selected filters and shows visible errors.
- [ ] Surprise Me with active Tune My Pick filters still respects the filter bridge.
- [ ] Result card, reroll and AniList link still work.
- [ ] Reset clears both original filters and the expanded filter state without removing shortcut buttons.

## Expanded filter gates

- [ ] Cast/protagonist quick tags appear and cycle include -> exclude -> clear.
- [ ] Theme/setting quick tags appear and cycle include -> exclude -> clear.
- [ ] Avoid Genres excludes selected genres from results.
- [ ] From Year and Through Year constrain the release window.
- [ ] Max Score works together with existing Min Score.
- [ ] Max Popularity works together with existing Min Popularity.
- [ ] Officially Licensed Only returns only media marked licensed by AniList.
- [ ] Expanded filters work with Anywhere.
- [ ] Expanded filters work with Not on my list.
- [ ] Expanded filters work with My AniList status selections.
- [ ] Multiple selected countries remain an OR choice rather than silently disabling country filtering.
- [ ] Planning source never surfaces Completed/Current/Dropped entries after additional filters are applied.

## Randomizer integrity / speed gates

- [ ] First filtered roll loads normally and closes Tune My Pick on success.
- [ ] Filtered Reroll changes the anime immediately from the in-memory candidate pool when candidates remain.
- [ ] Filtered Reroll does not make a new network request for every tap while the candidate pool has entries.
- [ ] Filtered Reroll never repeats the same cached candidate before the pool is exhausted.
- [ ] Changing filters changes the candidate-pool key and cannot reuse stale candidates.
- [ ] Backlog Roulette caches verified PLANNING candidates for instant rerolls.
- [ ] Continue Something caches verified CURRENT candidates for instant rerolls.
- [ ] Rewatch Roulette caches verified COMPLETED candidates for instant rerolls.
- [ ] Dropped Rescue caches verified DROPPED candidates for instant rerolls.
- [ ] Public modes cache the first returned page for instant rerolls.
- [ ] Public-mode background variety fetch never blocks the visible result or reroll interaction.
- [ ] Switching from filtered roll to a mode transfers Reroll ownership to that mode.
- [ ] Switching from a mode to filtered roll transfers Reroll ownership to the filtered candidate pool.

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

- [ ] New feature requests are serialized/spaced where appropriate to avoid burst pressure.
- [ ] AniList candidate pages are reused in memory for rerolls instead of refetched on every tap.
- [ ] My AniList Tune My Pick source uses one fresh status-filtered list fetch then filters locally for candidate reuse.
- [ ] Background prefetch is opportunistic and failure does not break the current roll.
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
