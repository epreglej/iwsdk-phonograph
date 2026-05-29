import { Entity } from "@iwsdk/core";
import { PopIn } from "../components/animation.js";

export function popInFromZero(entity: Entity): void {
  const obj = entity.object3D;
  if (!obj) return;
  obj.scale.setScalar(0.001);
  obj.visible = true;
  entity.addComponent(PopIn);
}
