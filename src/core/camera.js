export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;

    // current zoom factor
    this.zoom = 1;

    // smoothing
    this.positionLerp = 8;
    this.zoomLerp = 4;
  }

  update(player, dt) {
    const targetX = player.x;
    const targetY = player.y;

    // smooth follow
    const lp = Math.min(1, dt * this.positionLerp);
    this.x += (targetX - this.x) * lp;
    this.y += (targetY - this.y) * lp;

    const canvas = this.canvas;
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    const aspect = w / h;

    // range in world units, 5% margin
    const range = Math.max(0.0001, (player.range || 1) * 1.05);

    let worldHalfX;
    let worldHalfY;

    if (aspect >= 1) {
      // landscape: guarantee full bullet path horizontally
      worldHalfX = range * 0.5;
      worldHalfY = worldHalfX / aspect;
    } else {
      // portrait: guarantee full bullet path vertically
      worldHalfY = range * 0.5;
      worldHalfX = worldHalfY * aspect;
    }

    const zoomX = w / (worldHalfX * 2);
    const zoomY = h / (worldHalfY * 2);
    let targetZoom = Math.min(zoomX, zoomY);

    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 3.0;
    if (targetZoom < MIN_ZOOM) targetZoom = MIN_ZOOM;
    if (targetZoom > MAX_ZOOM) targetZoom = MAX_ZOOM;

    const lz = Math.min(1, dt * this.zoomLerp);
    this.zoom += (targetZoom - this.zoom) * lz;
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
