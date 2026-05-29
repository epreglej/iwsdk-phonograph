import { Entity } from "@iwsdk/core";
import { PopIn2D, PopOut2D } from "../components/animation.js";

export function revealPanel(entity: Entity): void {
  const obj = entity.object3D!;
  if (!obj.visible) obj.visible = true;
  entity.removeComponent(PopOut2D);
  if (!entity.hasComponent(PopIn2D)) {
    entity.addComponent(PopIn2D);
  }
}

/**
 * Start the pop-out animation. Teardown (hiding, dropping Follower etc.) happens
 * when AnimationSystem emits PopOut2DDone, so re-showing mid-pop-out (which strips
 * PopOut2D) cancels the hide automatically.
 */
export function hidePanel(entity: Entity): void {
  entity.removeComponent(PopIn2D);
  if (!entity.hasComponent(PopOut2D)) {
    entity.addComponent(PopOut2D);
  }
}
