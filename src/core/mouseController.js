import { pointerState } from "./pointerState.js";

export function handleMouseMove(x, y) {
  pointerState.mouseX = x;
  pointerState.mouseY = y;
}

export function handleMouseDown(button, x, y) {
  if (button === 0) {
    pointerState.mouseDown = true;
    pointerState.mouseX = x;
    pointerState.mouseY = y;
  }
}

export function handleMouseUp(button) {
  if (button === 0) {
    pointerState.mouseDown = false;
  }
}
