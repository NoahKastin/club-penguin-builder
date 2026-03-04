// Ray-AABB intersection and movement blocking logic.
// Used by both client (RoomScene) and server (move validation).

// Returns { x, y, edge } or null. edge is 'left'|'right'|'top'|'bottom'.
export function lineRectIntersection(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  let tMin = 0;
  let tMax = 1;
  let hitEdge = null;

  // Check X slab
  if (dx !== 0) {
    const tLeft = (rect.x - x1) / dx;
    const tRight = (rect.x + rect.w - x1) / dx;
    const tEnter = Math.min(tLeft, tRight);
    const tExit = Math.max(tLeft, tRight);

    if (tEnter > tMin) {
      tMin = tEnter;
      hitEdge = (dx > 0) ? 'left' : 'right';
    }
    if (tExit < tMax) tMax = tExit;
    if (tMin > tMax) return null;
  } else {
    if (x1 < rect.x || x1 > rect.x + rect.w) return null;
  }

  // Check Y slab
  if (dy !== 0) {
    const tTop = (rect.y - y1) / dy;
    const tBottom = (rect.y + rect.h - y1) / dy;
    const tEnter = Math.min(tTop, tBottom);
    const tExit = Math.max(tTop, tBottom);

    if (tEnter > tMin) {
      tMin = tEnter;
      hitEdge = (dy > 0) ? 'top' : 'bottom';
    }
    if (tExit < tMax) tMax = tExit;
    if (tMin > tMax) return null;
  } else {
    if (y1 < rect.y || y1 > rect.y + rect.h) return null;
  }

  if (tMin <= 0 || tMin > 1) return null;

  return {
    x: x1 + dx * tMin,
    y: y1 + dy * tMin,
    t: tMin,
    edge: hitEdge,
  };
}

export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w &&
         py >= rect.y && py <= rect.y + rect.h;
}

export function nearestEdgePoint(px, py, rect) {
  const cx = Math.max(rect.x, Math.min(rect.x + rect.w, px));
  const cy = Math.max(rect.y, Math.min(rect.y + rect.h, py));

  // Point is inside — push to nearest edge
  if (cx === px && cy === py) {
    const dLeft = px - rect.x;
    const dRight = rect.x + rect.w - px;
    const dTop = py - rect.y;
    const dBottom = rect.y + rect.h - py;
    const min = Math.min(dLeft, dRight, dTop, dBottom);

    if (min === dLeft) return { x: rect.x - 1, y: py };
    if (min === dRight) return { x: rect.x + rect.w + 1, y: py };
    if (min === dTop) return { x: px, y: rect.y - 1 };
    return { x: px, y: rect.y + rect.h + 1 };
  }

  return { x: cx, y: cy };
}

const BUFFER = 2;
const MAX_DEPTH = 3;

export function adjustMoveTarget(fromX, fromY, toX, toY, blockers, depth = 0) {
  if (blockers.length === 0) return { x: toX, y: toY };

  // Step 1: If target is inside a blocker, push to nearest edge
  for (const b of blockers) {
    if (pointInRect(toX, toY, b)) {
      const edge = nearestEdgePoint(toX, toY, b);
      toX = edge.x;
      toY = edge.y;
    }
  }

  // Step 2: Ray cast — find closest intersection
  let closestHit = null;
  for (const b of blockers) {
    const hit = lineRectIntersection(fromX, fromY, toX, toY, b);
    if (hit && (!closestHit || hit.t < closestHit.t)) {
      closestHit = hit;
    }
  }

  if (!closestHit) return { x: toX, y: toY };

  // Step 3: Stop just before the intersection
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: fromX, y: fromY };

  const stopX = closestHit.x - (dx / len) * BUFFER;
  const stopY = closestHit.y - (dy / len) * BUFFER;

  // Step 4: Slide along the edge
  if (depth >= MAX_DEPTH) return { x: stopX, y: stopY };

  let slideX = stopX;
  let slideY = stopY;
  if (closestHit.edge === 'left' || closestHit.edge === 'right') {
    // Hit vertical edge — slide in Y
    slideY = toY;
  } else {
    // Hit horizontal edge — slide in X
    slideX = toX;
  }

  // Step 5: Recurse to check slide path for additional blockers
  if (Math.abs(slideX - stopX) < 1 && Math.abs(slideY - stopY) < 1) {
    return { x: stopX, y: stopY };
  }

  return adjustMoveTarget(stopX, stopY, slideX, slideY, blockers, depth + 1);
}

// Shared physics constants and helpers.
const MAX_STEPS = 300;

// Skid/bounce physics simulation.
// Returns array of {x, y} keyframes (item top-left positions).
const SKID_FRICTION = 0.96;
const SKID_BOUNCE = 0.3;
const SKID_STOP = 0.5;

export function simulateSkid(startX, startY, itemW, itemH, vx, vy, blockers, roomW = 800, roomH = 600, originX = 0, originY = 0) {
  let x = startX;
  let y = startY;
  const frames = [{ x, y }];

  for (let i = 0; i < MAX_STEPS; i++) {
    x += vx;
    y += vy;

    // Wall bounce (item edges) — bounded by origin + dimensions
    if (x < originX) { x = originX; vx = -vx * SKID_BOUNCE; }
    if (x + itemW > originX + roomW) { x = originX + roomW - itemW; vx = -vx * SKID_BOUNCE; }
    if (y < originY) { y = originY; vy = -vy * SKID_BOUNCE; }
    if (y + itemH > originY + roomH) { y = originY + roomH - itemH; vy = -vy * SKID_BOUNCE; }

    // Blocker bounce
    for (const b of blockers) {
      if (x < b.x + b.w && x + itemW > b.x && y < b.y + b.h && y + itemH > b.y) {
        const overlapLeft = (x + itemW) - b.x;
        const overlapRight = (b.x + b.w) - x;
        const overlapTop = (y + itemH) - b.y;
        const overlapBottom = (b.y + b.h) - y;
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapLeft) { x = b.x - itemW; vx = -vx * SKID_BOUNCE; }
        else if (minOverlap === overlapRight) { x = b.x + b.w; vx = -vx * SKID_BOUNCE; }
        else if (minOverlap === overlapTop) { y = b.y - itemH; vy = -vy * SKID_BOUNCE; }
        else { y = b.y + b.h; vy = -vy * SKID_BOUNCE; }
      }
    }

    vx *= SKID_FRICTION;
    vy *= SKID_FRICTION;

    frames.push({ x, y });

    if (Math.abs(vx) < SKID_STOP && Math.abs(vy) < SKID_STOP) break;
  }

  return frames;
}

// Gravity physics simulation.
// Returns array of {x, y} keyframes. Item falls toward gravity direction until resting.
const GRAV_FRICTION = 0.92;
const GRAV_BOUNCE = 0.05;
const GRAV_STOP = 0.3;
const GRAVITY_STRENGTH = 0.3; // pixels/frame²

export function getGravityAccel(direction, itemX, itemY, itemW, itemH, centerX = 400, centerY = 300) {
  switch (direction) {
    case 'up': return { gx: 0, gy: -GRAVITY_STRENGTH };
    case 'left': return { gx: -GRAVITY_STRENGTH, gy: 0 };
    case 'right': return { gx: GRAVITY_STRENGTH, gy: 0 };
    case 'center': {
      const cx = itemX + itemW / 2;
      const cy = itemY + itemH / 2;
      const dx = centerX - cx;
      const dy = centerY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return { gx: 0, gy: 0 };
      return { gx: (dx / dist) * GRAVITY_STRENGTH, gy: (dy / dist) * GRAVITY_STRENGTH };
    }
    default: return { gx: 0, gy: GRAVITY_STRENGTH }; // 'down'
  }
}

export function simulateGravity(startX, startY, itemW, itemH, direction, blockers, roomW = 800, roomH = 600, originX = 0, originY = 0) {
  let x = startX;
  let y = startY;
  let vx = 0;
  let vy = 0;
  const frames = [{ x, y }];
  // Center for 'center' gravity: middle of the bounds area
  const centerX = originX + roomW / 2;
  const centerY = originY + roomH / 2;

  for (let i = 0; i < MAX_STEPS; i++) {
    // Apply gravity acceleration (recalculated each step for 'center' direction)
    const { gx, gy } = getGravityAccel(direction, x, y, itemW, itemH, centerX, centerY);
    vx += gx;
    vy += gy;

    x += vx;
    y += vy;

    // Wall collision — bounded by origin + dimensions
    let hitWall = false;
    if (x < originX) { x = originX; vx = -vx * GRAV_BOUNCE; hitWall = true; }
    if (x + itemW > originX + roomW) { x = originX + roomW - itemW; vx = -vx * GRAV_BOUNCE; hitWall = true; }
    if (y < originY) { y = originY; vy = -vy * GRAV_BOUNCE; hitWall = true; }
    if (y + itemH > originY + roomH) { y = originY + roomH - itemH; vy = -vy * GRAV_BOUNCE; hitWall = true; }

    // Blocker collision
    let hitBlocker = false;
    for (const b of blockers) {
      if (x < b.x + b.w && x + itemW > b.x && y < b.y + b.h && y + itemH > b.y) {
        const overlapLeft = (x + itemW) - b.x;
        const overlapRight = (b.x + b.w) - x;
        const overlapTop = (y + itemH) - b.y;
        const overlapBottom = (b.y + b.h) - y;
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapLeft) { x = b.x - itemW; vx = -vx * GRAV_BOUNCE; }
        else if (minOverlap === overlapRight) { x = b.x + b.w; vx = -vx * GRAV_BOUNCE; }
        else if (minOverlap === overlapTop) { y = b.y - itemH; vy = -vy * GRAV_BOUNCE; }
        else { y = b.y + b.h; vy = -vy * GRAV_BOUNCE; }
        hitBlocker = true;
      }
    }

    vx *= GRAV_FRICTION;
    vy *= GRAV_FRICTION;

    frames.push({ x, y });

    // Stop when velocity is negligible AND resting against a surface
    if (Math.abs(vx) < GRAV_STOP && Math.abs(vy) < GRAV_STOP && (hitWall || hitBlocker)) break;
  }

  return frames;
}
