# Club Penguin Builder — Roadmap

## Roadmap to Launch
1. ~~Penguin count per CP in main menu~~
2. ~~Storage & Persistence~~
3. ~~Accounts (optional, persistent identity)~~
4. ~~Dev permissions (account holders can create/manage CPs)~~
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
- [x] Accounts (optional), dev permissions, party log, FAQ (see sections below for details)
- [x] Deployed to Fly.io with Docker, geo-restriction, cache headers, auto-stop (see Deployment section)

## Room Editor
- [x] Form-based UI to create/edit rooms (name, background color, exits)
- [ ] Place exits visually (drag to position, set target room)
- [ ] Exits hidden by default (uploaded items/backgrounds cover them)
- [x] Toggle: hidden room (penguins can't randomly spawn there)
- [ ] Toggle: party planning enabled (decoration by non-devs with uploaded items)

## Item System & Catalog
- [x] Central item marketplace ("Catalog") for uploading/downloading items
- [x] Item upload flow (image + metadata)
- [x] AI guardrail for uploaded items (OpenAI content safety + Claude Haiku copyright check)
- [x] Items can be free or paywalled (Pearl currency, Stripe checkout)
- [x] Free items must still be acquired by an account before being usable in Build
- [x] Uploaders can always use their own items
- [ ] Bundle items into "games" (specific location configurations of items, e.g. beans placed into a Mancala board)

## Item Behaviors (per room)
- [x] Collectible by penguins (clothes: render on penguins — pins, colors/sprites, costumes, hats, etc.)
- [ ] Draggable by penguins
- [ ] Resizable items within rooms
- [ ] Physics: skid/bounce, gravity toward a location
- [ ] Block penguin movement
- [x] Clothes equip without regard for item slots (later-equipped goes on top); puffles are a subset of clothes
- [ ] Configurable memory limit for clothes per penguin
- [x] Collectible items display with white glow shadow; draggable items (future) will display with black glow shadow; behaviors are mutually exclusive

## Moderation
- [ ] Rules stated per Club Penguin
- [ ] Configurable enforcement actions
- [ ] AI automod (toggleable in bits/pieces, varying intensity)
- [ ] Item policy: allow/whitelist/blacklist items from other Club Penguins
- [ ] Toggle: party planning per penguin
- [ ] Devs can freely elect other accounts as devs and/or mods

## Central Platform
- [x] Guest access always available (current name-entry flow); no account required to play
- [x] Accounts (optional): persistent identity across Club Penguins
- [x] Dev permissions: account holders can create/manage Club Penguins (permission layer, not a separate account type)
- [x] Upload/publish Club Penguins to the platform
- [x] Club Penguin updates ("parties") from devs
- [x] Party log per server: saves when parties were launched with their name (entered via the create/edit CP form); users can view the log by clicking an icon next to each server in the CP list
- [x] Compact serialization: rooms and items stored as ID + coordinates/size (no duplicated asset data)
- [x] Pearl currency: users buy Pearl bundles via Stripe Checkout, spend Pearls on priced catalog items; sellers earn Pearls on sale; platform takes 1/6 cut after Stripe fees
- [x] Seller cash-out: Pearl holders can withdraw earnings via Stripe Connect
- [ ] Funding model: free tier, then beyond that supporters pitch in the maximum they're willing to pay (one-time or monthly); actual costs (Fly.io charges + platform cut) are divided evenly across the total money offered
- [ ] Separate tiers for paying to support the server vs. paying to support those who are supporting the server; moderation-choice perks can be gated behind either
- [ ] Supporters are not synonymous with devs (someone can pay to support without having rights to adjust the CP, though dev access itself could be a perk for supporting)
- [ ] Monetization: devs can paywall moderation features (party planning, external items, clothes memory, enforcement actions) via subscription at whatever price the dev wants
- [ ] Update FAQ Pearl ecosystem entry once seller cash-out and additional Pearl-gated features are in

## Main Menu
- [x] FAQ section: explain what "a Club Penguin" is and why this project is legal; default room dimensions; point to TODO.md for future features and Discord for support
- [ ] FAQ entry explaining the Pearl ecosystem (buy via Stripe, spend on catalog items, sellers earn Pearls) — add once seller cash-out is in
- [x] Logo: based on the original (no longer trademarked) Club Penguin logo, with "Builder" added below "Penguin" using previously-used letters (or two easily derived from them); three words in traffic-light colors (red/yellow/green)
- [x] Favicon: based on the "CPB" acronym from the logo
- [x] Show penguin count per CP in the main menu's Club Penguin list (alongside room count)
- [x] Club Penguin sort orders remembered per account: ascending or descending by creation date, latest party date, penguin count, room count, or alphabetical

## Deployment
- [x] Deploy to Fly.io
- [x] Production build script (Vite builds frontend, Express serves it + runs Socket.io)
- [x] Environment-based config (port, CORS origin)
- [x] Geo-restrict to regions where the "Club Penguin" trademark is active (Canada, UK) via fast-geoip (lightweight, lazy-loads chunks on demand)
- [x] Containerized via Docker on Fly.io
- [x] Remove the Outdoors test Club Penguin
- [x] Cache headers for static assets (add CDN like Cloudflare later if needed at scale)
- [x] Auto-stop server if all online players are idle (Fly.io auto_stop_machines)

## Refinement Ideas (Current PoC)
- [x] Penguin sprites instead of emoji (customizable colors) — via collectible catalog items with wear position/size
- [x] Room backgrounds via background-sized or resizable items (no special "room background" concept)
- [x] Penguin list / "who's here" sidebar
- [x] Server-side validation (name length, chat rate limiting)
- [x] Reconnection handling (rejoin room on socket reconnect)
