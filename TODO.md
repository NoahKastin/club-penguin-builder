# Club Penguin Builder — Roadmap

## Done
- [x] Core engine: rooms, multiplayer presence, click-to-move, speech bubbles, room transitions
- [x] Two test rooms (Patio, Veranda) with exits between them
- [x] Name entry on join
- [x] Node.js + Express + Socket.io backend
- [x] React + Phaser 3 frontend
- [x] Chat log (scrollable history with join/leave notifications)
- [x] Mobile-friendly responsive layout

## Next Up

### Room Editor
- [ ] Dev UI to create/edit rooms (name, background color/image, dimensions)
- [ ] Place exits visually (drag to position, set target room)
- [ ] Toggle: hidden room (penguins can't randomly spawn there)
- [ ] Toggle: party planning enabled (decoration by devs with uploaded items)

### Item System & Catalog
- [ ] Central item marketplace ("Catalog") for uploading/downloading items
- [ ] Item upload flow (image + metadata)
- [ ] AI guardrail for uploaded items (copyright check against Club Penguin Archive, block porn/living people/etc.)
- [ ] Items can be free or paywalled
- [ ] Uploaders can always use their own items
- [ ] Bundle items into "games"

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
- [ ] Penguin accounts (persistent identity across Club Penguins)
- [ ] Dev accounts (create/manage Club Penguins)
- [ ] Upload/publish Club Penguins to the platform
- [ ] Club Penguin updates ("parties") from devs
- [ ] Funding model: devs/penguins fund traffic costs
- [ ] Monetization: devs can paywall moderation features (party planning, external items, clothes memory, enforcement actions)

## Deployment
- [ ] Deploy to a hosting provider that supports Node.js + WebSockets (Railway, Render, Fly.io, or existing hosting)
- [ ] Production build script (Vite builds frontend, Express serves it + runs Socket.io)
- [ ] Environment-based config (port, CORS origin)
- [ ] Consider a process manager (PM2) or container for reliability

## Refinement Ideas (Current PoC)
- [ ] Penguin sprites instead of emoji (customizable colors)
- [ ] Room backgrounds (images instead of solid colors)
- [ ] Penguin list / "who's here" sidebar
- [ ] Sound effects
- [ ] Mobile-friendly layout
- [ ] Server-side validation (name length, chat rate limiting)
- [ ] Reconnection handling (rejoin room on socket reconnect)
