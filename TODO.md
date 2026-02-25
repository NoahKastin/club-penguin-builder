# Club Penguin Builder — Roadmap

## Roadmap to Launch
1. ~~Penguin count per CP in main menu~~
2. ~~Storage & Persistence~~
3. ~~Accounts (optional, persistent identity)~~
4. ~~Dev permissions (account holders can create/manage CPs)~~
5. ~~Party log (save/display party launches per server)~~
6. ~~FAQ section in main menu~~
7. Deployment (Fly.io)

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
- [x] Logo (traffic-light colored "Club Penguin Builder")
- [x] CC-BY 4.0 license
- [x] Persistent storage (SQLite via better-sqlite3) so Club Penguins survive server restarts

## Room Editor
- [x] Form-based UI to create/edit rooms (name, background color, exits)
- [ ] Place exits visually (drag to position, set target room)
- [ ] Exits hidden by default (uploaded items/backgrounds cover them)
- [ ] Toggle: hidden room (penguins can't randomly spawn there)
- [ ] Toggle: party planning enabled (decoration by devs with uploaded items)

## Item System & Catalog
- [ ] Central item marketplace ("Catalog") for uploading/downloading items
- [ ] Item upload flow (image + metadata)
- [ ] AI guardrail for uploaded items (copyright check against Club Penguin Archive, block porn/living people/etc.)
- [ ] Items can be free or paywalled
- [ ] Uploaders can always use their own items
- [ ] Bundle items into "games" (specific location configurations of items, e.g. beans placed into a Mancala board)

## Item Behaviors (per room)
- [ ] Collectible by penguins (pins, colors/sprites, clothes, igloo furniture)
- [ ] Draggable by penguins
- [ ] Physics: skid/bounce, gravity toward a location
- [ ] Block penguin movement
- [ ] Clothes equip without regard for item slots (later-equipped goes on top); puffles are a subset of clothes
- [ ] Configurable memory limit for clothes per penguin

## Moderation
- [ ] Rules stated per Club Penguin
- [ ] Configurable enforcement actions
- [ ] AI automod (toggleable in bits/pieces, varying intensity)
- [ ] Item policy: allow/whitelist/blacklist items from other Club Penguins
- [ ] Toggle: private igloos per penguin
- [ ] Toggle: party planning per penguin
- [ ] Devs can freely elect other accounts as devs and/or mods

## Central Platform
- [x] Guest access always available (current name-entry flow); no account required to play
- [x] Accounts (optional): persistent identity across Club Penguins
- [x] Dev permissions: account holders can create/manage Club Penguins (permission layer, not a separate account type)
- [x] Upload/publish Club Penguins to the platform
- [x] Club Penguin updates ("parties") from devs
- [x] Party log per server: saves when parties were launched with their name (entered via the create/edit CP form); users can view the log by clicking an icon next to each server in the CP list
- [ ] Compact serialization: rooms and items stored as ID + coordinates/size (no duplicated asset data)
- [ ] Funding model: free tier, then beyond that supporters pitch in the maximum they're willing to pay (one-time or monthly); actual costs (Fly.io charges + platform cut) are divided evenly across the total money offered
- [ ] Separate tiers for paying to support the server vs. paying to support those who are supporting the server; moderation-choice perks can be gated behind either
- [ ] Supporters are not synonymous with devs (someone can pay to support without having rights to adjust the CP, though dev access itself could be a perk for supporting)
- [ ] Monetization: devs can paywall moderation features (party planning, external items, clothes memory, enforcement actions) — either one-off or subscription, at whatever price the dev wants

## Main Menu
- [x] FAQ section: explain what "a Club Penguin" is and why this project is legal; default room dimensions; point to TODO.md for future features and Discord for support
- [x] Logo: based on the original (no longer trademarked) Club Penguin logo, with "Builder" added below "Penguin" using previously-used letters (or two easily derived from them); three words in traffic-light colors (red/yellow/green)
- [x] Favicon: based on the "CPB" acronym from the logo
- [x] Show penguin count per CP in the main menu's Club Penguin list (alongside room count)

## Deployment
- [ ] Deploy to Fly.io
- [x] Production build script (Vite builds frontend, Express serves it + runs Socket.io)
- [ ] Environment-based config (port, CORS origin)
- [ ] Geo-restrict to regions where the "Club Penguin" trademark is not active
- [ ] Consider a process manager (PM2) or container for reliability
- [x] Remove the Outdoors test Club Penguin
- [ ] Caching + CDN for static assets to reduce bandwidth costs
- [ ] Auto-stop server if all online players are idle

## Refinement Ideas (Current PoC)
- [ ] Penguin sprites instead of emoji (customizable colors)
- [ ] Room backgrounds via background-sized or resizable items (no special "room background" concept)
- [ ] Penguin list / "who's here" sidebar
- [ ] Server-side validation (name length, chat rate limiting)
- [ ] Reconnection handling (rejoin room on socket reconnect)
