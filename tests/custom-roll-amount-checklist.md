# Custom Roll Amount QA

## Static acceptance
- [x] Amount is clamped to 1–20.
- [x] Amount preference uses Tomo local storage.
- [x] Single-roll path is not intercepted when amount is 1.
- [x] Multi-roll Quick Roll routes through cached Surprise Me mode.
- [x] Filtered multi-roll reuses the advanced randomizer reroll path.
- [x] Mode multi-roll reuses the mode reroll path.
- [x] Batch cards expose per-title AniList, Maybe Later, and Not Tonight actions.
- [x] Service-worker cache version bumped and new module included.

## Device regression still required
- [ ] iPhone installed PWA updates to `tomo-shell-v1.3.8-batch-roll-20`.
- [ ] Amount stepper/input works for 1, 2, 5, 10, and 20.
- [ ] Single-result layout remains unchanged at 1.
- [ ] Surprise Me batch returns unique cards and stays smooth at 20.
- [ ] Tune My Pick batch respects active include/exclude filters.
- [ ] Backlog/Continue/Rewatch/Dropped modes retain list ownership.
- [ ] Movie/Short/Hidden/Throwback/Season modes retain mode constraints.
- [ ] Batch Reroll keeps the same amount and source.
- [ ] Maybe Later and Not Tonight affect only the tapped card.
- [ ] No navigation, OAuth, library, or Discover regressions.
