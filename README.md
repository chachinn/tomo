# Tomo

**Tomo — Your Anime Discovery Companion**

Tomo is a mobile-first PWA for anime discovery, random picks, and AniList-connected personal list experiences.

## Current user-facing v1 foundation

- Public AniList-powered trending discovery
- Quick Roll and filtered anime randomizer
- AniList OAuth login using the browser/mobile Implicit Grant flow
- Connected AniList profile
- Read-only import of Watching, Completed, Planning, Paused, and Dropped list data
- Status-count summary sourced from AniList
- Installable PWA shell with a Safari-safe embedded header-icon override and cache-busted install icons
- Offline shell only — AniList API responses are never stored by the service worker
- About Tomo / app-name meaning card

## AniList authentication

The public client ID is stored in `auth/anilist-config.js`.

Tomo does **not** require or store the AniList client secret. OAuth access tokens are returned by AniList to the browser and kept locally on the current device so the PWA can stay connected. Tokens are never committed to this repository.

The registered AniList redirect URI should be:

`https://chachinn.github.io/tomo/`

## Project structure

- `index.html` — app shell
- `styles.css` — core UI
- `app.js` — discovery/randomizer + account UI orchestration
- `auth/anilist-config.js` — public AniList client configuration
- `auth/anilist-auth.js` — OAuth, authenticated requests, profile/list import
- `auth/anilist-auth.css` — account UI styling
- `manifest.json` — PWA metadata
- `service-worker.js` — offline shell
- `icons/header-icon.css` — embedded Safari/iOS-safe header artwork override
- `icons/` — existing Tomo PNG/SVG install assets; legacy files are retained until live iPhone verification is complete

## Data rule

AniList remains the canonical anime list. Tomo adds discovery, randomization, personalization, stats, and challenges around it.

List-write mutations are intentionally not exposed in this login build. A deliberate single-title sync test should be completed before normal watch-status/progress writing is enabled.
