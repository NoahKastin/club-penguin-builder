# Club Penguin Builder — Roadmap

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

## Next Up

### Room Editor
- [x] Form-based UI to create/edit rooms (name, background color, exits)
- [ ] Place exits visually (drag to position, set target room)
- [ ] Exits hidden by default (uploaded items/backgrounds cover them)
- [ ] Toggle: hidden room (penguins can't randomly spawn there)
- [ ] Toggle: party planning enabled (decoration by devs with uploaded items)

### Item System & Catalog
- [ ] Central item marketplace ("Catalog") for uploading/downloading items
- [ ] Item upload flow (image + metadata)
- [ ] AI guardrail for uploaded items (copyright check against Club Penguin Archive, block porn/living people/etc.)
- [ ] Items can be free or paywalled
- [ ] Uploaders can always use their own items
- [ ] Bundle items into "games" (specific location configurations of items, e.g. beans placed into a Mancala board)

### Item Behaviors (per room)
- [ ] Collectible by penguins (pins, colors/sprites, clothes, puffles, igloo furniture)
- [ ] Draggable by penguins
- [ ] Physics: skid/bounce, gravity toward a location
- [ ] Block penguin movement
- [ ] Clothes equip without regard for item slots (later-equipped goes on top)
- [ ] Configurable memory limit for clothes per penguin

### Moderation
- [ ] Rules stated per Club Penguin
- [ ] Configurable enforcement actions
- [ ] AI automod (toggleable in bits/pieces, varying intensity)
- [ ] Item policy: allow/whitelist/blacklist items from other Club Penguins
- [ ] Toggle: private igloos per penguin
- [ ] Toggle: party planning per penguin

### Central Platform
- [x] Guest access always available (current name-entry flow); no account required to play
- [ ] Accounts (optional): persistent identity across Club Penguins
- [ ] Dev permissions: account holders can create/manage Club Penguins (permission layer, not a separate account type)
- [ ] Upload/publish Club Penguins to the platform
- [ ] Club Penguin updates ("parties") from devs
- [ ] Funding model: devs/penguins fund traffic costs
- [ ] Monetization: devs can paywall moderation features (party planning, external items, clothes memory, enforcement actions)

## Deployment
- [ ] Deploy to a hosting provider that supports Node.js + WebSockets (Railway, Render, Fly.io, or existing hosting)
- [ ] Production build script (Vite builds frontend, Express serves it + runs Socket.io)
- [ ] Environment-based config (port, CORS origin)
- [ ] Geo-restrict to regions where the "Club Penguin" trademark is no longer active
- [ ] Consider a process manager (PM2) or container for reliability

## Main Menu
- [ ] FAQ section: explain what "a Club Penguin" is and why this project is legal

## Branding
- [x] Logo: based on the original (no longer trademarked) Club Penguin logo, with "Builder" added below "Penguin" using previously-used letters (or two easily derived from them); three words in traffic-light colors (red/yellow/green)
- [x] Favicon: based on the "CPB" acronym from the logo

## Refinement Ideas (Current PoC)
- [ ] Penguin sprites instead of emoji (customizable colors)
- [ ] Room backgrounds via background-sized or resizable items (no special "room background" concept)
- [ ] Penguin list / "who's here" sidebar
- [ ] Sound effects
- [ ] Server-side validation (name length, chat rate limiting)
- [ ] Reconnection handling (rejoin room on socket reconnect)
