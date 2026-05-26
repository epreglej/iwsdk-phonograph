import { AssetManager, createSystem, Mesh, Object3D } from "@iwsdk/core";
import { Phonograph } from "./phonograph/phonograph.js";
import { Cylinder } from "./phonograph/cylinder.js";
import {
  RecordingDiaphragm,
  PlaybackDiaphragm,
} from "./phonograph/diaphragm.js";
import { RecordingTrumpet, PlaybackTrumpet } from "./phonograph/trumpet.js";
import { Crank } from "./phonograph/crank.js";
import { SnapPoint } from "./utils/snap.js";

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
    cylinderSnap.object3D!.position.set(0.01, 0.23, -0.05);
    cylinderSnap.object3D!.quaternion.set(-0.000111, 0.005654, -0.019514, 1);
    cylinderSnap.object3D!.visible = false;

    const diaphragmSnap = this.world
      .createTransformEntity(
        cloneMesh(AssetManager.getGLTF("recording_diaphragm")!.scene),
        { parent: phonographEntity },
      )
      .addComponent(SnapPoint, { id: "diaphragm_snap_point" });
    diaphragmSnap.object3D!.position.set(0.09, 0.2945, -0.016);
    diaphragmSnap.object3D!.quaternion.set(-0.1, -0.002, -0.02, 0.995);
    diaphragmSnap.object3D!.visible = false;

    const trumpetSnap = this.world
      .createTransformEntity(
        cloneMesh(AssetManager.getGLTF("recording_trumpet")!.scene),
        { parent: phonographEntity },
      )
      .addComponent(SnapPoint, { id: "trumpet_snap_point" });
    trumpetSnap.object3D!.position.set(0.0903, 0.396, 0.455);
    trumpetSnap.object3D!.quaternion.set(-0.78, 0, 0, 0.625);
    trumpetSnap.object3D!.visible = false;

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
  }
}
