export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;

    this.zoom = 1;

    this.positionLerp = 8;
    this.zoomLerp = 4;
  }

  update(player, dt) {
    const targetX = player.x;
    const targetY = player.y;

    const lerpPos = Math.min(1, dt * this.positionLerp);
    this.x += (targetX - this.x) * lerpPos;
    this.y += (targetY - this.y) * lerpPos;

    const canvas = this.canvas;
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    const aspect = w / h;
    const maxDim = Math.max(w, h);
    const minDim = Math.min(w, h);

    const rangeRaw = player.range || 1;
    const baseRange = Math.max(0.0001, rangeRaw);
    const paddedRange = baseRange * 1.05;

    let targetZoom;

    if (maxDim < 1000) {
      // Mobile / small canvas: ensure full bullet path + 5% fits
      // in all directions, based on the shorter screen side.
      const shortest = minDim;
      let safeShortest = shortest;

      // In landscape on mobile, browser UI (URL bar, nav bar)
      // eats a noticeable chunk of the shorter side, so we
      // compensate a bit by using ~75% of it for camera math.
      if (aspect >= 1) {
        safeShortest = shortest * 0.75;
      }

      targetZoom = safeShortest / (paddedRange * 2);
    } else {
      // Desktop / large canvas: keep previous behaviour (bind to aspect),
      // but use paddedRange for a small safety margin.
      let worldHalfX;
      let worldHalfY;

      if (aspect >= 1) {
        worldHalfX = paddedRange * 0.5;
        worldHalfY = worldHalfX / aspect;
      } else {
        worldHalfY = paddedRange * 0.5;
        worldHalfX = worldHalfY * aspect;
      }

      const zoomX = w / (worldHalfX * 2);
      const zoomY = h / (worldHalfY * 2);
      targetZoom = Math.min(zoomX, zoomY);
    }

    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 3.0;
    if (targetZoom < MIN_ZOOM) targetZoom = MIN_ZOOM;
    if (targetZoom > MAX_ZOOM) targetZoom = MAX_ZOOM;

    const lerpZoom = Math.min(1, dt * this.zoomLerp);
    this.zoom += (targetZoom - this.zoom) * lerpZoom;
  }

  applyTransform(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  resetTransform(ctx) {
    ctx.restore();
  }
}
