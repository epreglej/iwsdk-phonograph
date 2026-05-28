import { Entity, World } from "@iwsdk/core";
import { PopIn2D, PopOut2D } from "../components/animation.js";
import { delay } from "../helpers/delay.js";

export const POP_OUT_MS = 560;

export function revealPanel(entity: Entity): void {
  const obj = entity.object3D!;
  if (!obj.visible) obj.visible = true;
  entity.removeComponent(PopOut2D);
  if (!entity.hasComponent(PopIn2D)) {
    entity.addComponent(PopIn2D);
  }
}

export function placeInFrontOfHead(
  panel: Entity,
  world: World,
  options?: { z?: number; yOffset?: number },
): void {
  const { z = -0.65, yOffset = -0.2 } = options ?? {};
  const headY = world.player?.head?.position.y ?? world.camera.position.y;
  const cam = world.camera.position;
  panel.object3D!.position.set(cam.x, headY + yOffset, cam.z + z);
}

export async function hidePanelWithPopOutAsync(entity: Entity): Promise<void> {
  const obj = entity.object3D!;
  if (!obj.visible) return;

  entity.removeComponent(PopIn2D).addComponent(PopOut2D);
  await delay(POP_OUT_MS);
  if (entity.active) {
    obj.visible = false;
    entity.removeComponent(PopOut2D);
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
