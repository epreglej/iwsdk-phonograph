import { Entity, PanelUI, World } from "@iwsdk/core";

export type SpatialPanelOptions = {
  config: string;
  maxWidth?: number;
};

export function createSpatialPanel(
  world: World,
  { config, maxWidth = 0.35 }: SpatialPanelOptions,
): Entity {
  const panel = world
    .createTransformEntity(undefined, { parent: world.sceneEntity })
    .addComponent(PanelUI, { config, maxWidth });
  const obj = panel.object3D!;
  obj.scale.set(0.001, 0.001, 0.001);
  obj.visible = false;
  return panel;
}
