export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.baseZoom = 0.9;
  }

  update(player, dt) {
    const targetX = player.x;
    const targetY = player.y;

    const lerpPos = Math.min(1, dt * 8);
    this.x += (targetX - this.x) * lerpPos;
    this.y += (targetY - this.y) * lerpPos;

    const desiredZoom = this.baseZoom + (player.range || 1) * 0.3;
    const lerpZoom = Math.min(1, dt * 5);
    this.zoom += (desiredZoom - this.zoom) * lerpZoom;

    this.zoom = Math.max(0.4, Math.min(2.5, this.zoom));
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
