import {
  createComponent,
  createSystem,
  Entity,
  eq,
  Grabbed,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task.js";
import { TaskId } from "./task-config.js";
import { MoveDone, MoveTo, TeleportTo } from "./animation.js";
import { Highlight, STOP_HIGHLIGHT_COLOR } from "./highlight.js";
import { Recording, StopRecording, recordingStopUiDelayMs } from "./recording.js";
import { ReleaseGrab } from "./interaction-gate.js";
import { playSnap } from "../audio/sfx.js";

const BRAKE_SHIFT_X = 0.035;
export const BRAKE_PLAY = { x: -0.1, y: 0.16, z: 0.0725 };
export const BRAKE_STOP = {
  x: BRAKE_PLAY.x + BRAKE_SHIFT_X,
  y: BRAKE_PLAY.y,
  z: BRAKE_PLAY.z,
};

export const Brake = createComponent("Brake", {});
export const BrakeShifted = createComponent("BrakeShifted", {});
export const BrakeReturning = createComponent("BrakeReturning", {});
/** Brake is disengaged (at play position); cylinder spins while this is present. */
export const BrakeReleased = createComponent("BrakeReleased", {});

const BRAKE_SHIFT_DURATION_MS = 300;

export class BrakeSystem extends createSystem({
  activeBrakeShiftTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", TaskId.RecordingBrakeRelease)],
  },
  activePlaybackBrakeShiftTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", TaskId.PlaybackBrakeRelease)],
  },
  activeRecordingSpeakTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", TaskId.RecordingSpeak)],
  },
  activePlaybackTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", TaskId.PlaybackListen)],
  },
  brake: { required: [Brake] },
  brakeGrabbed: {
    required: [Brake, Grabbed],
    excluded: [MoveTo, BrakeShifted, BrakeReturning],
  },
  brakeGrabbedToStopRecording: {
    required: [Brake, Grabbed],
    excluded: [MoveTo, BrakeReturning],
  },
  brakeShiftDone: { required: [Brake, MoveDone, BrakeShifted] },
  brakeReturnDone: { required: [Brake, MoveDone, BrakeReturning] },
}) {
  private recordingStopActivationTimer: ReturnType<typeof setTimeout> | null =
    null;

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

      this.queries.activeRecordingSpeakTask.subscribe("qualify", () => {
        const brake = this.first(this.queries.brake.entities);
        if (brake) this.scheduleRecordingStopActivation(brake);
      }),

      this.queries.activeRecordingSpeakTask.subscribe("disqualify", () => {
        this.clearRecordingStopActivationTimer();
        const brake = this.first(this.queries.brake.entities);
        if (!brake) return;
        this.deactivateRecordingStop(brake);
        brake
          .removeComponent(BrakeReturning)
          .removeComponent(BrakeReleased)
          .removeComponent(MoveTo);
        this.teleportBrake(brake, BRAKE_STOP);
      }),

      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        const brake = this.first(this.queries.brake.entities);
        if (brake) this.returnBrakeAfterPlayback(brake);
      }),

      this.queries.brakeGrabbed.subscribe("qualify", (brake) => {
        if (!this.isManualBrakeShiftActive()) return;
        this.shiftBrake(brake);
      }),

      this.queries.brakeGrabbedToStopRecording.subscribe("qualify", (brake) => {
        if (this.queries.activeRecordingSpeakTask.entities.size === 0) return;
        this.stopRecordingWithBrake(brake);
      }),

      this.queries.brakeShiftDone.subscribe("qualify", (brake) => {
        if (!this.isManualBrakeShiftActive()) return;
        this.completeBrakeShiftTask(brake);
      }),

      this.queries.brakeReturnDone.subscribe("qualify", (brake) => {
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
    const brake = this.first(this.queries.brake.entities);
    if (!brake?.object3D) return;

    brake
      .removeComponent(BrakeReturning)
      .removeComponent(BrakeShifted)
      .removeComponent(BrakeReleased)
      .removeComponent(MoveTo)
      .removeComponent(Grabbed);
    this.teleportBrake(brake, BRAKE_STOP);
    brake.object3D.visible = true;

    brake
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .addComponent(OneHandGrabbable)
      .addComponent(Highlight);
  }

  private onManualBrakeShiftDisqualify(): void {
    const brake = this.first(this.queries.brake.entities);
    if (!brake) return;

    brake
      .removeComponent(BrakeShifted)
      .removeComponent(MoveTo)
      .removeComponent(Grabbed);

    if (this.queries.activeRecordingSpeakTask.entities.size > 0) {
      this.scheduleRecordingStopActivation(brake);
      return;
    }

    if (this.queries.activePlaybackTask.entities.size > 0) {
      this.setBrakeAtPlay(brake);
      return;
    }

    brake.removeComponent(OneHandGrabbable).removeComponent(Highlight);
  }

  private clearRecordingStopActivationTimer(): void {
    if (this.recordingStopActivationTimer == null) return;
    clearTimeout(this.recordingStopActivationTimer);
    this.recordingStopActivationTimer = null;
  }

  private scheduleRecordingStopActivation(brake: Entity): void {
    this.clearRecordingStopActivationTimer();
    this.deactivateRecordingStop(brake);

    const delayMs = recordingStopUiDelayMs();
    if (delayMs <= 0) {
      this.activateRecordingStop(brake);
      return;
    }

    this.recordingStopActivationTimer = setTimeout(() => {
      this.recordingStopActivationTimer = null;
      if (this.queries.activeRecordingSpeakTask.entities.size === 0) return;
      const currentBrake = this.first(this.queries.brake.entities);
      if (currentBrake) this.activateRecordingStop(currentBrake);
    }, delayMs);
  }

  private activateRecordingStop(brake: Entity): void {
    if (!brake.object3D) return;

    brake.removeComponent(BrakeReturning);
    this.teleportBrake(brake, BRAKE_PLAY);
    brake.object3D.visible = true;

    brake
      .removeComponent(Grabbed)
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .addComponent(OneHandGrabbable)
      .addComponent(Highlight, { color: STOP_HIGHLIGHT_COLOR });
  }

  private setBrakeAtPlay(brake: Entity): void {
    if (!brake.object3D) return;

    brake.removeComponent(BrakeReturning).removeComponent(Grabbed);
    brake.removeComponent(OneHandGrabbable).removeComponent(Highlight);

    this.teleportBrake(brake, BRAKE_PLAY);
    brake.object3D.visible = true;
  }

  private returnBrakeAfterPlayback(brake: Entity): void {
    if (brake.hasComponent(MoveTo)) {
      brake.removeComponent(MoveTo);
    }

    this.animateBrakeTo(brake, BRAKE_STOP, BrakeReturning);
  }

  private shiftBrake(brake: Entity): void {
    if (
      !brake.object3D ||
      brake.hasComponent(MoveTo) ||
      brake.hasComponent(BrakeShifted)
    ) {
      return;
    }

    brake.addComponent(ReleaseGrab, { removeGrabbable: true });
    brake
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .removeComponent(Grabbed)
      .addComponent(BrakeShifted);

    this.animateBrakeTo(brake, BRAKE_PLAY, BrakeShifted);
  }

  private stopRecordingWithBrake(brake: Entity): void {
    if (
      brake.hasComponent(BrakeReturning) ||
      brake.hasComponent(MoveTo) ||
      !this.world.sceneEntity.hasComponent(Recording)
    ) {
      return;
    }

    if (!brake.object3D) return;

    this.world.sceneEntity.addComponent(StopRecording);
    brake.addComponent(ReleaseGrab, { removeGrabbable: true });
    this.deactivateRecordingStop(brake);
    this.animateBrakeTo(brake, BRAKE_STOP, BrakeReturning);
  }

  private animateBrakeTo(
    brake: Entity,
    target: { x: number; y: number; z: number },
    marker: typeof BrakeShifted | typeof BrakeReturning,
  ): void {
    if (!brake.object3D) return;

    if (brake.hasComponent(marker)) {
      brake.removeComponent(marker);
    }
    brake.addComponent(marker);
    brake.addComponent(MoveTo, {
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z,
      duration: BRAKE_SHIFT_DURATION_MS,
    });

    playSnap();
  }

  private finishReturnHome(brake: Entity): void {
    this.teleportBrake(brake, BRAKE_STOP);
    brake.removeComponent(BrakeReturning).removeComponent(BrakeReleased);
  }

  private completeBrakeShiftTask(brake: Entity): void {
    if (!brake.hasComponent(BrakeShifted)) return;

    this.teleportBrake(brake, BRAKE_PLAY);
    brake.removeComponent(BrakeShifted).addComponent(BrakeReleased);

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

  private teleportBrake(
    brake: Entity,
    target: { x: number; y: number; z: number },
  ): void {
    brake.addComponent(TeleportTo, {
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z,
    });
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
