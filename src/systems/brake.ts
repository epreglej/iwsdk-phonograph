import {
  createSystem,
  Entity,
  eq,
  Grabbed,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Brake, BrakeReturning, BrakeShifted } from "../components/phonograph.js";
import { SnapAnimation } from "../components/animation.js";
import { Highlight } from "../components/highlight.js";
import { stopActiveRecording } from "../audio/recording-store.js";
import { forceReleaseGrab } from "../helpers/grab-release.js";
import { playSnap } from "../audio/sfx.js";
import { firstEntity } from "../helpers/entity-query.js";

export const BRAKE_HOME = { x: -0.1, y: 0.155, z: 0.0725 };
const BRAKE_SHIFT_X = 0.035;
const BRAKE_SHIFT_DURATION_MS = 300;

const BRAKE_SHIFTED = {
  x: BRAKE_HOME.x + BRAKE_SHIFT_X,
  y: BRAKE_HOME.y,
  z: BRAKE_HOME.z,
};

export const BRAKE_RECORDING_STOP_HIGHLIGHT: [number, number, number, number] = [
  1, 0.12, 0.08, 0.38,
];

export class BrakeSystem extends createSystem({
  activeBrakeShiftTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "brake_shift")],
  },
  activePlaybackBrakeShiftTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_brake_shift")],
  },
  activeRecordingTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording")],
  },
  activePlaybackTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback")],
  },
  brake: { required: [Brake] },
  brakeGrabbed: {
    required: [Brake, Grabbed],
    excluded: [SnapAnimation, BrakeShifted, BrakeReturning],
  },
  brakeGrabbedToStopRecording: {
    required: [Brake, Grabbed],
    excluded: [SnapAnimation, BrakeReturning],
  },
  brakeShifting: { required: [Brake, SnapAnimation, BrakeShifted] },
  brakeReturningHome: { required: [Brake, SnapAnimation, BrakeReturning] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeBrakeShiftTask.subscribe(
        "qualify",
        () => this.onManualBrakeShiftQualify(),
        true,
      ),

      this.queries.activePlaybackBrakeShiftTask.subscribe(
        "qualify",
        () => this.onManualBrakeShiftQualify(),
        true,
      ),

      this.queries.activeBrakeShiftTask.subscribe("disqualify", () => {
        this.onManualBrakeShiftDisqualify();
      }),

      this.queries.activePlaybackBrakeShiftTask.subscribe("disqualify", () => {
        this.onManualBrakeShiftDisqualify();
      }),

      this.queries.activeRecordingTask.subscribe("qualify", () => {
        const brake = firstEntity(this.queries.brake.entities);
        if (brake) this.activateRecordingStop(brake);
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        const brake = firstEntity(this.queries.brake.entities);
        if (!brake) return;
        this.deactivateRecordingStop(brake);
        brake.removeComponent(BrakeReturning).removeComponent(SnapAnimation);
        if (brake.object3D) {
          brake.object3D.position.set(BRAKE_HOME.x, BRAKE_HOME.y, BRAKE_HOME.z);
        }
      }),

      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        const brake = firstEntity(this.queries.brake.entities);
        if (brake) this.returnBrakeAfterPlayback(brake);
      }),

      this.queries.brakeGrabbed.subscribe("qualify", (brake) => {
        if (!this.isManualBrakeShiftActive()) return;
        this.shiftBrake(brake);
      }),

      this.queries.brakeGrabbedToStopRecording.subscribe("qualify", (brake) => {
        if (this.queries.activeRecordingTask.entities.size === 0) return;
        this.stopRecordingWithBrake(brake);
      }),

      this.queries.brakeShifting.subscribe("disqualify", (brake) => {
        if (!brake.hasComponent(BrakeShifted)) return;
        if (!this.isManualBrakeShiftActive()) return;
        this.completeBrakeShiftTask(brake);
      }),

      this.queries.brakeReturningHome.subscribe("disqualify", (brake) => {
        if (!brake.hasComponent(BrakeReturning)) return;
        this.finishReturnHome(brake);
      }),
    );
  }

  private isManualBrakeShiftActive(): boolean {
    return (
      this.queries.activeBrakeShiftTask.entities.size > 0 ||
      this.queries.activePlaybackBrakeShiftTask.entities.size > 0
    );
  }

  private onManualBrakeShiftQualify(): void {
    const brake = firstEntity(this.queries.brake.entities);
    if (!brake?.object3D) return;

    brake
      .removeComponent(BrakeReturning)
      .removeComponent(BrakeShifted)
      .removeComponent(SnapAnimation)
      .removeComponent(Grabbed);
    brake.object3D.position.set(BRAKE_HOME.x, BRAKE_HOME.y, BRAKE_HOME.z);
    brake.object3D.visible = true;

    if (brake.hasComponent(Highlight)) {
      brake.removeComponent(Highlight);
    }
    if (brake.hasComponent(OneHandGrabbable)) {
      brake.removeComponent(OneHandGrabbable);
    }

    brake.addComponent(OneHandGrabbable).addComponent(Highlight);
  }

  private onManualBrakeShiftDisqualify(): void {
    const brake = firstEntity(this.queries.brake.entities);
    if (!brake) return;

    brake
      .removeComponent(BrakeShifted)
      .removeComponent(SnapAnimation)
      .removeComponent(Grabbed);

    if (this.queries.activeRecordingTask.entities.size > 0) {
      this.activateRecordingStop(brake);
      return;
    }

    if (this.queries.activePlaybackTask.entities.size > 0) {
      this.setBrakeAtShifted(brake);
      return;
    }

    brake.removeComponent(OneHandGrabbable).removeComponent(Highlight);
  }

  private activateRecordingStop(brake: Entity): void {
    const obj = brake.object3D;
    if (!obj) return;

    brake.removeComponent(BrakeReturning);

    obj.position.set(BRAKE_SHIFTED.x, BRAKE_SHIFTED.y, BRAKE_SHIFTED.z);
    obj.visible = true;

    brake.removeComponent(Grabbed);

    if (brake.hasComponent(Highlight)) {
      brake.removeComponent(Highlight);
    }
    if (brake.hasComponent(OneHandGrabbable)) {
      brake.removeComponent(OneHandGrabbable);
    }

    brake
      .addComponent(OneHandGrabbable)
      .addComponent(Highlight, { color: BRAKE_RECORDING_STOP_HIGHLIGHT });
  }

  private setBrakeAtShifted(brake: Entity): void {
    const obj = brake.object3D;
    if (!obj) return;

    brake.removeComponent(BrakeReturning).removeComponent(Grabbed);
    brake.removeComponent(OneHandGrabbable).removeComponent(Highlight);

    obj.position.set(BRAKE_SHIFTED.x, BRAKE_SHIFTED.y, BRAKE_SHIFTED.z);
    obj.visible = true;
  }

  private returnBrakeAfterPlayback(brake: Entity): void {
    if (brake.hasComponent(SnapAnimation)) {
      brake.removeComponent(SnapAnimation);
    }

    this.animateBrakeTo(brake, BRAKE_HOME, BrakeReturning);
  }

  private shiftBrake(brake: Entity): void {
    const obj = brake.object3D;
    if (!obj || brake.hasComponent(SnapAnimation) || brake.hasComponent(BrakeShifted)) {
      return;
    }

    forceReleaseGrab(brake);
    brake
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .removeComponent(Grabbed)
      .addComponent(BrakeShifted);

    this.animateBrakeTo(brake, BRAKE_SHIFTED, BrakeShifted);
  }

  private stopRecordingWithBrake(brake: Entity): void {
    if (
      brake.hasComponent(BrakeReturning) ||
      brake.hasComponent(SnapAnimation)
    ) {
      return;
    }
    if (!stopActiveRecording()) return;

    const obj = brake.object3D;
    if (!obj) return;

    forceReleaseGrab(brake);
    this.deactivateRecordingStop(brake);

    this.animateBrakeTo(brake, BRAKE_HOME, BrakeReturning);
  }

  private animateBrakeTo(
    brake: Entity,
    target: { x: number; y: number; z: number },
    marker: typeof BrakeShifted | typeof BrakeReturning,
  ): void {
    const obj = brake.object3D;
    if (!obj) return;

    if (brake.hasComponent(marker)) {
      brake.removeComponent(marker);
    }
    brake.addComponent(marker);
    brake.addComponent(SnapAnimation, {
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z,
      targetQX: obj.quaternion.x,
      targetQY: obj.quaternion.y,
      targetQZ: obj.quaternion.z,
      targetQW: obj.quaternion.w,
      duration: BRAKE_SHIFT_DURATION_MS,
    });

    playSnap();
  }

  private finishReturnHome(brake: Entity): void {
    const obj = brake.object3D;
    if (obj) {
      obj.position.set(BRAKE_HOME.x, BRAKE_HOME.y, BRAKE_HOME.z);
    }
    brake.removeComponent(BrakeReturning);
  }

  private completeBrakeShiftTask(brake: Entity): void {
    if (!brake.hasComponent(BrakeShifted)) return;

    const obj = brake.object3D;
    if (obj) {
      obj.position.set(BRAKE_SHIFTED.x, BRAKE_SHIFTED.y, BRAKE_SHIFTED.z);
    }

    brake.removeComponent(BrakeShifted);

    for (const task of this.queries.activeBrakeShiftTask.entities) {
      if (!task.hasComponent(CompletedTask)) {
        task.addComponent(CompletedTask);
      }
    }
    for (const task of this.queries.activePlaybackBrakeShiftTask.entities) {
      if (!task.hasComponent(CompletedTask)) {
        task.addComponent(CompletedTask);
      }
    }
  }

  private deactivateRecordingStop(brake: Entity): void {
    brake
      .removeComponent(OneHandGrabbable)
      .removeComponent(Highlight)
      .removeComponent(Grabbed);
  }
}
