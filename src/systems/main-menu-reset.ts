import {
  createSystem,
  Entity,
  eq,
  Grabbed,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { clearRecordedAudio } from "../audio/recording-store.js";
import {
  Phonograph,
  Cylinder,
  Crank,
  Brake,
  BrakeShifted,
  BrakeReturning,
  CrankHeld,
  CrankingComplete,
} from "../components/phonograph.js";
import {
  PlaybackDiaphragm,
  PlaybackTrumpet,
  RecordingDiaphragm,
  RecordingTrumpet,
} from "../components/phonograph-parts.js";
import { Highlight } from "../components/highlight.js";
import { MountTaskBinding } from "../components/mount-task-binding.js";
import { PopIn, PopOut, SnapAnimation, Spin } from "../components/animation.js";
import { Snappable, Snapped, SnapGhost, SnapPoint, TrackSnapZone, InSnapZone } from "../components/snap.js";
import { Unmounting, UnmountPopping } from "../components/unmounting.js";
import { CrankRotation } from "../components/crank-rotation.js";
import { firstEntity } from "../helpers/entity-query.js";
import { BRAKE_HOME } from "./brake.js";

export class MainMenuResetSystem extends createSystem({
  activeMainMenuTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "main_menu")],
  },
  phonograph: { required: [Phonograph] },
  cylinder: { required: [Cylinder] },
  crank: { required: [Crank] },
  brake: { required: [Brake] },
  recordingDiaphragm: { required: [RecordingDiaphragm] },
  playbackDiaphragm: { required: [PlaybackDiaphragm] },
  recordingTrumpet: { required: [RecordingTrumpet] },
  playbackTrumpet: { required: [PlaybackTrumpet] },
  snapPoints: { required: [SnapPoint] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeMainMenuTask.subscribe("qualify", () => {
        this.resetWorldToInitialState();
      }),
    );
  }

  private resetWorldToInitialState(): void {
    clearRecordedAudio();

    const phonograph = firstEntity(this.queries.phonograph.entities);
    if (phonograph?.object3D) {
      phonograph.object3D.visible = false;
    }

    const cylinder = firstEntity(this.queries.cylinder.entities);
    if (cylinder?.object3D) {
      cylinder.object3D.position.set(0.4, 0.05, 0.1);
      cylinder.object3D.quaternion.set(0, 0, 0, 1);
      cylinder.object3D.scale.setScalar(1);
      cylinder.object3D.visible = false;
      this.resetPartComponents(cylinder);
      cylinder.removeComponent(Spin);
    }

    const recordingDiaphragm = firstEntity(this.queries.recordingDiaphragm.entities);
    if (recordingDiaphragm?.object3D) {
      recordingDiaphragm.object3D.position.set(-0.4, 0, 0.1);
      recordingDiaphragm.object3D.quaternion.set(0, 0, 0, 1);
      recordingDiaphragm.object3D.scale.setScalar(1);
      recordingDiaphragm.object3D.visible = false;
      this.resetPartComponents(recordingDiaphragm);
    }

    const playbackDiaphragm = firstEntity(this.queries.playbackDiaphragm.entities);
    if (playbackDiaphragm?.object3D) {
      playbackDiaphragm.object3D.position.set(-0.4, 0, 0.1);
      playbackDiaphragm.object3D.quaternion.set(0, 0, 0, 1);
      playbackDiaphragm.object3D.scale.setScalar(1);
      playbackDiaphragm.object3D.visible = false;
      this.resetPartComponents(playbackDiaphragm);
    }

    const recordingTrumpet = firstEntity(this.queries.recordingTrumpet.entities);
    if (recordingTrumpet?.object3D) {
      recordingTrumpet.object3D.position.set(0.4, 0.05, 0.065);
      recordingTrumpet.object3D.quaternion.set(-0.7071, 0, 0, 0.7071);
      recordingTrumpet.object3D.scale.setScalar(1);
      recordingTrumpet.object3D.visible = false;
      this.resetPartComponents(recordingTrumpet);
    }

    const playbackTrumpet = firstEntity(this.queries.playbackTrumpet.entities);
    if (playbackTrumpet?.object3D) {
      playbackTrumpet.object3D.position.set(0.4, 0.05, 0.065);
      playbackTrumpet.object3D.quaternion.set(-0.7071, 0, 0, 0.7071);
      playbackTrumpet.object3D.scale.setScalar(1);
      playbackTrumpet.object3D.visible = false;
      this.resetPartComponents(playbackTrumpet);
    }

    const crank = firstEntity(this.queries.crank.entities);
    if (crank?.object3D) {
      crank.object3D.position.set(0.235, 0.078, -0.0365);
      crank.object3D.quaternion.set(0, 0, 0, 1);
      crank.object3D.scale.setScalar(1);
      crank.object3D.visible = false;
      this.resetPartComponents(crank);
      crank.removeComponent(CrankHeld).removeComponent(CrankingComplete).removeComponent(CrankRotation);
    }

    const brake = firstEntity(this.queries.brake.entities);
    if (brake?.object3D) {
      brake.object3D.position.set(BRAKE_HOME.x, BRAKE_HOME.y, BRAKE_HOME.z);
      brake.object3D.quaternion.set(0, 0, 0, 1);
      brake.object3D.scale.setScalar(1);
      brake.object3D.visible = true;
      this.resetPartComponents(brake);
      brake.removeComponent(BrakeShifted).removeComponent(BrakeReturning);
    }

    for (const snapPoint of this.queries.snapPoints.entities) {
      if (!snapPoint.object3D) continue;
      snapPoint
        .removeComponent(PopIn)
        .removeComponent(PopOut);
      snapPoint.object3D.scale.setScalar(0.001);
      snapPoint.object3D.visible = false;
    }
  }

  private resetPartComponents(entity: Entity): void {
    entity
      .removeComponent(MountTaskBinding)
      .removeComponent(OneHandGrabbable)
      .removeComponent(Grabbed)
      .removeComponent(Snappable)
      .removeComponent(Snapped)
      .removeComponent(SnapGhost)
      .removeComponent(TrackSnapZone)
      .removeComponent(InSnapZone)
      .removeComponent(SnapAnimation)
      .removeComponent(Unmounting)
      .removeComponent(UnmountPopping)
      .removeComponent(Highlight)
      .removeComponent(PopIn)
      .removeComponent(PopOut);
  }
}
