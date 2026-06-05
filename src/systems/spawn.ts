import { AssetManager, createSystem, Entity, Mesh, Object3D } from "@iwsdk/core";
import { Phonograph, Cylinder, Crank, Brake, Carriage, CarriageMesh } from "../components/phonograph.js";
import { PhonographPart } from "../components/phonograph-part.js";
import { Highlight } from "../components/highlight.js";
import { SnapPoint } from "../components/snap.js";
import {
  CARRIAGE_LAYOUT,
  CARRIAGE_SNAP_POINT_IDS,
  PART_LAYOUT,
  SNAP_POINT_LAYOUT,
} from "../config/phonograph-layout.js";
import { snapPointLocalOnCarriage } from "../helpers/carriage-attach.js";

const BEHAVIOR_TAGS = { cylinder: Cylinder, crank: Crank, brake: Brake } as const;
const CARRIAGE_SNAP_IDS = new Set<string>(CARRIAGE_SNAP_POINT_IDS);

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
    const carriage = this.spawnCarriage(phonograph);
    this.spawnSnapPoints(phonograph, carriage);
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

  private spawnSnapPoints(phonograph: Entity, carriage: Entity): void {
    for (const layout of SNAP_POINT_LAYOUT) {
      const onCarriage = CARRIAGE_SNAP_IDS.has(layout.id);
      const parent = onCarriage ? carriage : phonograph;
      const ghost = cloneMesh(AssetManager.getGLTF(layout.ghostAssetKey)!.scene);
      const entity = this.world
        .createTransformEntity(ghost, { parent })
        .addComponent(SnapPoint, { id: layout.id })
        .addComponent(Highlight);

      const obj = entity.object3D!;
      if (onCarriage) {
        obj.position.set(...snapPointLocalOnCarriage(layout.position));
      } else {
        obj.position.set(...layout.position);
      }
      obj.quaternion.set(...layout.quaternion);
      obj.scale.setScalar(0.001);
      obj.visible = false;
    }
  }

  private spawnCarriage(parent: Entity): Entity {
    const rig = this.world
      .createTransformEntity(undefined, { parent })
      .addComponent(Carriage)
      .addComponent(PhonographPart, { id: "carriage" });

    const rigObj = rig.object3D!;
    rigObj.position.set(...CARRIAGE_LAYOUT.position);
    rigObj.quaternion.set(...CARRIAGE_LAYOUT.quaternion);

    const { scene: mesh } = AssetManager.getGLTF(CARRIAGE_LAYOUT.assetKey)!;
    this.world
      .createTransformEntity(mesh, { parent: rig })
      .addComponent(CarriageMesh);
    mesh.visible = true;

    return rig;
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
