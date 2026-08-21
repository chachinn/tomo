# Custom Roll Amount (1–20)

Tomo's Randomize screen supports a locally remembered pick count from 1 through 20.

- 1 preserves the existing single-result experience.
- 2–20 collects unique results from the existing randomizer/reroll pools and presents a mobile-friendly batch.
- Quick Roll uses the existing Surprise Me mode pool for multi-pick requests to avoid one network request per result.
- Filtered rolls continue using the advanced randomizer's cached candidate queue.
- Mode rolls continue using each mode's cached pool.
- Each batch card keeps its own AniList link, Maybe Later, and Not Tonight actions.
- Batch reroll repeats the same source/mode and requested amount.
- The amount is clamped to 1–20 and stored as a local Tomo preference.

Physical iPhone/PWA regression QA is still required before this feature should be marked Done in the development tracker.
