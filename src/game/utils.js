export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(a, b) {
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function choose(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
