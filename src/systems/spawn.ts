import { AssetManager, createSystem, Entity, Mesh, Object3D } from "@iwsdk/core";
import { Phonograph, Cylinder, Crank, Brake } from "../components/phonograph.js";
import { BRAKE_HOME } from "./brake.js";
import {
  RecordingDiaphragm,
  PlaybackDiaphragm,
  RecordingTrumpet,
  PlaybackTrumpet,
} from "../components/phonograph-parts.js";
import { Highlight } from "../components/highlight.js";
import { SnapPoint } from "../components/snap.js";

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

/** Permanent highlight; root scale 0.001 so PopIn/PopOut tweens the whole ghost. */
function setupSnapGhost(entity: Entity): void {
  entity.addComponent(Highlight);
  entity.object3D!.scale.setScalar(0.001);
  entity.object3D!.visible = false;
}

export class SpawnSystem extends createSystem({}) {
  init() {
    const { scene: phonographMesh } = AssetManager.getGLTF("phonograph")!;
    const phonographEntity = this.world
      .createTransformEntity(phonographMesh, { parent: this.world.sceneEntity })
      .addComponent(Phonograph);
    phonographMesh.visible = false;

    const cylinderSnap = this.world
      .createTransformEntity(
        cloneMesh(AssetManager.getGLTF("cylinder")!.scene),
        { parent: phonographEntity },
      )
      .addComponent(SnapPoint, { id: "cylinder_snap_point" });
    setupSnapGhost(cylinderSnap);
    cylinderSnap.object3D!.position.set(0.01, 0.23, -0.05);
    cylinderSnap.object3D!.quaternion.set(-0.000111, 0.005654, -0.019514, 1);

    const diaphragmSnap = this.world
      .createTransformEntity(
        cloneMesh(AssetManager.getGLTF("recording_diaphragm")!.scene),
        { parent: phonographEntity },
      )
      .addComponent(SnapPoint, { id: "diaphragm_snap_point" });
    setupSnapGhost(diaphragmSnap);
    diaphragmSnap.object3D!.position.set(0.09, 0.2945, -0.016);
    diaphragmSnap.object3D!.quaternion.set(-0.1, -0.002, -0.02, 0.995);

    const trumpetSnap = this.world
      .createTransformEntity(
        cloneMesh(AssetManager.getGLTF("recording_trumpet")!.scene),
        { parent: phonographEntity },
      )
      .addComponent(SnapPoint, { id: "trumpet_snap_point" });
    setupSnapGhost(trumpetSnap);
    trumpetSnap.object3D!.position.set(0.0903, 0.396, 0.455);
    trumpetSnap.object3D!.quaternion.set(-0.78, 0, 0, 0.625);

    const { scene: cylinderMesh } = AssetManager.getGLTF("cylinder")!;
    const cylinderEntity = this.world
      .createTransformEntity(cylinderMesh, { parent: phonographEntity })
      .addComponent(Cylinder);
    cylinderEntity.object3D!.position.set(0.4, 0.05, 0.1);
    cylinderMesh.visible = false;

    const { scene: recordingDiaphragmMesh } = AssetManager.getGLTF(
      "recording_diaphragm",
    )!;
    this.world
      .createTransformEntity(recordingDiaphragmMesh, {
        parent: phonographEntity,
      })
      .addComponent(RecordingDiaphragm);
    recordingDiaphragmMesh.position.set(-0.4, 0, 0.1);
    recordingDiaphragmMesh.visible = false;

    const { scene: playbackDiaphragmMesh } =
      AssetManager.getGLTF("playback_diaphragm")!;
    this.world
      .createTransformEntity(playbackDiaphragmMesh, {
        parent: phonographEntity,
      })
      .addComponent(PlaybackDiaphragm);
    playbackDiaphragmMesh.position.set(-0.4, 0, 0.1);
    playbackDiaphragmMesh.visible = false;

    const { scene: trumpetMesh } = AssetManager.getGLTF("recording_trumpet")!;
    this.world
      .createTransformEntity(trumpetMesh, { parent: phonographEntity })
      .addComponent(RecordingTrumpet);
    trumpetMesh.position.set(0.4, 0.05, 0.065);
    trumpetMesh.quaternion.set(-0.7071, 0, 0, 0.7071);
    trumpetMesh.visible = false;

    const { scene: playbackTrumpetMesh } =
      AssetManager.getGLTF("playback_trumpet")!;
    this.world
      .createTransformEntity(playbackTrumpetMesh, { parent: phonographEntity })
      .addComponent(PlaybackTrumpet);
    playbackTrumpetMesh.position.set(0.4, 0.05, 0.065);
    playbackTrumpetMesh.quaternion.set(-0.7071, 0, 0, 0.7071);
    playbackTrumpetMesh.visible = false;

    const { scene: crankMesh } = AssetManager.getGLTF("crank")!;
    this.world
      .createTransformEntity(crankMesh, { parent: phonographEntity })
      .addComponent(Crank);
    crankMesh.position.set(0.235, 0.078, -0.0365);
    crankMesh.visible = false;

    const { scene: brakeMesh } = AssetManager.getGLTF("brake")!;
    this.world
      .createTransformEntity(brakeMesh, { parent: phonographEntity })
      .addComponent(Brake);
    brakeMesh.position.set(BRAKE_HOME.x, BRAKE_HOME.y, BRAKE_HOME.z);
  }
}
