# Static verification

Verified from repository source before PR:

- Amount clamp is 1–20 and preference is local-only.
- Amount 1 leaves existing initiating clicks untouched.
- Multi-pick Quick Roll routes to Surprise Me's cached mode pool rather than issuing one legacy request per result.
- Advanced filtered and mode rerolls retain their existing ownership paths.
- Batch cards provide individual AniList, Maybe Later, and Not Tonight controls.
- PWA cache includes the new module and versioned v1 CSS/boot files.
- No existing feature module was removed.

Physical-device behavior is not represented as statically verified.
