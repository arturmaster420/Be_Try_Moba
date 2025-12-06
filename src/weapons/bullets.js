export function fireBullets(player, state, dir, params) {
  const { projectiles } = state;
  const angle = Math.atan2(dir.y, dir.x);
  const count = params.count;
  const spreadRad = (params.spread * Math.PI) / 180;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const offset = (t - 0.5) * spreadRad;
    const a = angle + offset;
    const speed = 900;

    projectiles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      speed,
      damage: params.damage,
      range: params.range,
      travel: 0,
      radius: 4,
      type: "bullet",
    });
  }
}
