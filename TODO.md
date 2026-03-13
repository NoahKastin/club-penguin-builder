# Club Penguin Builder — Roadmap

The core platform is feature-complete: accounts, rooms, items with composable behaviors (collectible, draggable, physics, gravity, movement blocking), game bundling, Pearl currency, and Stripe payments. The remaining items below are future ideas — no timeline set.

## Roadmap to Launch
1. ~~Penguin count per CP in main menu~~
2. ~~Storage & Persistence~~
3. ~~Accounts (optional, persistent identity)~~
4. ~~Party planner permissions (account holders can create/manage CPs)~~
5. ~~Party log (save/display party launches per server)~~
6. ~~FAQ section in main menu~~
7. ~~Deployment (Fly.io)~~

## Done
- [x] Core engine: rooms, multiplayer presence, click-to-move, speech bubbles, room transitions
- [x] Two test rooms (Patio, Veranda) with exits between them
- [x] Name entry on join
- [x] Node.js + Express + Socket.io backend
- [x] React + Phaser 3 frontend
- [x] Chat log (scrollable history with join/leave notifications)
- [x] Mobile-friendly responsive layout
- [x] Main menu with logo, Club Penguin list, and create/edit forms
- [x] Multi-CP support (anyone can create and join Club Penguins)
- [x] Logo (traffic-light colored "Club Penguin Builder") + favicon
- [x] CC-BY 4.0 license
- [x] Persistent storage (SQLite via better-sqlite3) so Club Penguins survive server restarts
- [x] Accounts (optional), party planner permissions, party log, FAQ (see sections below for details)
- [x] Deployed to Fly.io with Docker, geo-restriction, cache headers, auto-stop (see Deployment section)
- [x] Room editor: form-based UI to create/edit rooms (name, background color, exits), hidden room toggle
- [x] FAQ section: explain what "a Club Penguin" is and why this project is legal; default room dimensions; point to TODO.md for future features and Discord for support
- [x] FAQ entry explaining the Pearl ecosystem (buy via Stripe, spend on catalog items/games, sellers earn Pearls, cash out via Stripe Connect) and games
- [x] Logo: based on the original (no longer trademarked) Club Penguin logo, with "Builder" added below "Penguin" using previously-used letters (or two easily derived from them); three words in traffic-light colors (red/yellow/green)
- [x] Favicon: based on the "CPB" acronym from the logo
- [x] Show penguin count per CP in the main menu's Club Penguin list (alongside room count)
- [x] Club Penguin sort orders remembered per account: ascending or descending by creation date, latest party date, penguin count, room count, or alphabetical
- [x] Penguin sprites instead of emoji (customizable colors) — via collectible catalog items with wear position/size
- [x] Room backgrounds via background-sized or resizable items (no special "room background" concept)
- [x] Penguin list / "who's here" sidebar
- [x] Server-side validation (name length, chat rate limiting)
- [x] Reconnection handling (rejoin room on socket reconnect)

## Item System & Catalog
- [x] Central item marketplace ("Catalog") for uploading/downloading items
- [x] Item upload flow (image + metadata)
- [x] AI guardrail for uploaded items (OpenAI content safety + Claude Haiku copyright check)
- [x] Items can be free or paywalled (Pearl currency, Stripe checkout)
- [x] Free items must still be acquired by an account before being usable in Build
- [x] Uploaders can always use their own items
- [x] Bundle items into "games" (export room items as a game, publish to Catalog with Pearl pricing, place as a single unit in other rooms; only personal uploads for simplicity of proceed-sharing; physics scoped per game instance)

## Item Behaviors (per room)
- [x] Collectible by penguins (clothes: render on penguins — pins, colors/sprites, costumes, hats, etc.)
- [x] Draggable by penguins (resets and persists variants, one-at-a-time locking, black glow)
- [x] Resizable items within rooms (width/height fields in room editor)
- [x] Physics: skid/bounce (penguin-pushed items slide with friction, bounce off walls and blockers)
- [x] Gravity toward a direction (per-room direction: down/up/left/right/center; items settle on load, after skid, after drag release; collide with blocksMovement items)
- [x] Block penguin movement (slide along edge; composable with other behaviors via checkbox)
- [x] Clothes equip without regard for item slots (later-equipped goes on top); puffles are a subset of clothes
- [x] Collectible items display with white glow shadow; draggable items display with black glow shadow
- [x] Behaviors are composable: interaction type (collectible/draggable) via dropdown + modifier flags (blocks movement, etc.) via checkboxes

## Performance
- [x] Cache expanded room items per request (expandRoomItems is called multiple times in the same join/move/drag-end request, re-loading game definitions from DB each time)
- [x] Resolve items once in settleGravityItems and update positions in-place (currently re-resolves ALL items for EACH gravity item — O(n²) with many physics items)
- [x] Early exit in physics simulations when velocity is negligible (simulateGravity and simulateSkid always run up to MAX_STEPS=300 even when the item has effectively stopped)
- [x] Skip postFX glow on game sub-items or replace with a cheaper visual (GPU-intensive glow on 20+ items compounds per frame)

## Moderation
- [ ] Rules stated per Club Penguin
- [ ] Configurable enforcement actions
- [ ] AI automod (toggleable in bits/pieces, varying intensity)
- [ ] Item policy: allow/whitelist/blacklist items from other Club Penguins
- [ ] Party planners can freely elect other accounts as party planners and/or mods

## Central Platform
- [x] Guest access always available (current name-entry flow); no account required to play
- [x] Accounts (optional): persistent identity across Club Penguins
- [x] Party planner permissions: account holders can create/manage Club Penguins (permission layer, not a separate account type)
- [x] Upload/publish Club Penguins to the platform
- [x] Club Penguin updates ("parties") from party planners
- [x] Party log per server: saves when parties were launched with their name (entered via the create/edit CP form); users can view the log by clicking an icon next to each server in the CP list
- [x] Compact serialization: rooms and items stored as ID + coordinates/size (no duplicated asset data)
- [x] Pearl currency: users buy Pearl bundles via Stripe Checkout, spend Pearls on priced catalog items and games; sellers earn Pearls on sale; platform takes 1/6 cut after Stripe fees
- [x] Seller cash-out: Pearl holders can withdraw earnings via Stripe Connect
- [ ] Funding model (deferred — hosting costs too low to justify billing; revisit at scale): supporters pledge one-time, costs divided proportionally by usage-weighted player-hours per CP; subscription revenue from Monetization offsets costs for supporters
- [ ] Separate tiers for paying to support the server vs. paying to support those who are supporting the server; moderation-choice perks can be gated behind either
- [ ] Supporters are not synonymous with party planners (someone can pay to support without having rights to adjust the CP, though party planner access itself could be a perk for supporting)
- [ ] Monetization: party planners can paywall moderation features (external items, clothes memory limit, enforcement actions) via subscription at whatever price the party planner wants
- [x] Update FAQ Pearl ecosystem entry to mention games and seller cash-out

## Deployment
- [x] Deploy to Fly.io
- [x] Production build script (Vite builds frontend, Express serves it + runs Socket.io)
- [x] Environment-based config (port, CORS origin)
- [x] Geo-restrict to regions where the "Club Penguin" trademark is active (Canada, UK) via fast-geoip (lightweight, lazy-loads chunks on demand)
- [x] Containerized via Docker on Fly.io
- [x] Remove the Outdoors test Club Penguin
- [x] Cache headers for static assets (add CDN like Cloudflare later if needed at scale)
- [x] Auto-stop server if all online players are idle (Fly.io auto_stop_machines)
