import { AssetManager, createSystem, Entity, Mesh, Object3D } from "@iwsdk/core";
import { Phonograph, Cylinder, Crank, Brake } from "../components/phonograph.js";
import { PhonographPart } from "../components/phonograph-part.js";
import { Highlight } from "../components/highlight.js";
import { SnapPoint } from "../components/snap.js";
import { PART_LAYOUT, SNAP_POINT_LAYOUT } from "../config/phonograph-layout.js";

const BEHAVIOR_TAGS = { cylinder: Cylinder, crank: Crank, brake: Brake } as const;

function cloneMesh(source: Object3D): Object3D {
  const cloned = source.clone(true);
  cloned.traverse((child) => {
    if ((child as Mesh).isMesh && (child as Mesh).geometry) {
      (child as Mesh).geometry = (child as Mesh).geometry.clone();
    }
  });
  cloned.position.set(0, 0, 0);
  cloned.quaternion.set(0, 0, 0, 1);
  return cloned;
}

export class SpawnSystem extends createSystem({}) {
  init() {
    const phonograph = this.spawnPhonographRoot();
    this.spawnSnapPoints(phonograph);
    this.spawnParts(phonograph);
  }

  private spawnPhonographRoot(): Entity {
    const { scene: mesh } = AssetManager.getGLTF("phonograph")!;
    mesh.visible = false;
    return this.world
      .createTransformEntity(mesh, { parent: this.world.sceneEntity })
      .addComponent(Phonograph)
      .addComponent(PhonographPart, { id: "phonograph" });
  }

  private spawnSnapPoints(parent: Entity): void {
    for (const layout of SNAP_POINT_LAYOUT) {
      const ghost = cloneMesh(AssetManager.getGLTF(layout.ghostAssetKey)!.scene);
      const entity = this.world
        .createTransformEntity(ghost, { parent })
        .addComponent(SnapPoint, { id: layout.id })
        .addComponent(Highlight);
      const obj = entity.object3D!;
      obj.position.set(...layout.position);
      obj.quaternion.set(...layout.quaternion);
      obj.scale.setScalar(0.001);
      obj.visible = false;
    }
  }

  private spawnParts(parent: Entity): void {
    for (const layout of PART_LAYOUT) {
      const { scene: mesh } = AssetManager.getGLTF(layout.assetKey)!;
      const entity = this.world
        .createTransformEntity(mesh, { parent })
        .addComponent(PhonographPart, { id: layout.id });

      const tag = layout.behaviorTag && BEHAVIOR_TAGS[layout.behaviorTag];
      if (tag) entity.addComponent(tag);

      const obj = entity.object3D!;
      obj.position.set(...layout.position);
      obj.quaternion.set(...layout.quaternion);
      obj.visible = layout.visible;
    }
  }
}
