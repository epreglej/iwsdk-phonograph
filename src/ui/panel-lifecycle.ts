import { Entity } from "@iwsdk/core";
import { PopIn2D, PopOut2D } from "../components/animation.js";

export const POP_OUT_MS = 560;

export function revealPanel(entity: Entity): void {
  const obj = entity.object3D!;
  if (!obj.visible) obj.visible = true;
  entity.removeComponent(PopOut2D);
  if (!entity.hasComponent(PopIn2D)) {
    entity.addComponent(PopIn2D);
  }
}

export function hidePanelWithPopOut(
  entity: Entity,
  onHidden: () => void,
): ReturnType<typeof setTimeout> | null {
  const obj = entity.object3D!;
  if (!obj.visible) {
    onHidden();
    return null;
  }

  entity.removeComponent(PopIn2D).addComponent(PopOut2D);
  return setTimeout(() => {
    if (entity.active) {
      obj.visible = false;
      entity.removeComponent(PopOut2D);
    }
    onHidden();
  }, POP_OUT_MS);
}
