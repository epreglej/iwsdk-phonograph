import {
  createComponent,
  createSystem,
  Entity,
  eq,
  Grabbed,
  Object3D,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Handle } from "@iwsdk/core/dist/grab/handles.js";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { SnapAnimation, SnapDone } from "./animation.js";
import { Highlight, STOP_HIGHLIGHT_COLOR } from "./highlight.js";
import { CARRIAGE_LAYOUT } from "../config.js";
import { stopActiveRecording } from "./recording.js";
import { playSnap } from "../audio/sfx.js";

export const Carriage = createComponent("Carriage", {});
export const CarriageMesh = createComponent("CarriageMesh", {});
export const CarriageReturning = createComponent("CarriageReturning", {});

type CancellableHandle = { cancel?: () => void };

const CARRIAGE_TRAVEL =
  CARRIAGE_LAYOUT.endX - CARRIAGE_LAYOUT.startX;
const CARRIAGE_SPEED =
  Math.abs(CARRIAGE_TRAVEL) / CARRIAGE_LAYOUT.travelDurationS;
const CARRIAGE_DIRECTION = Math.sign(CARRIAGE_TRAVEL);
const CARRIAGE_RETURN_DURATION_MS = 300;

export class CarriageSystem extends createSystem({
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
  activeCarriageReturnTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "carriage_return")],
  },
  activeMainMenuTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "main_menu")],
  },
  carriage: { required: [Carriage] },
  carriageMesh: { required: [CarriageMesh] },
  carriageMeshGrabbed: {
    required: [CarriageMesh, Grabbed],
    excluded: [SnapAnimation, CarriageReturning],
  },
  carriageReturnDone: {
    required: [Carriage, SnapDone, CarriageReturning],
  },
}) {
  private recording = false;
  private playback = false;
  private recordingElapsed = 0;

  init() {
    this.resetCarriageToStart();

    this.cleanupFuncs.push(
      this.queries.activeRecordingTask.subscribe("qualify", () => {
        this.recording = true;
        this.recordingElapsed = 0;
        this.resetCarriageToStart();
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        this.recording = false;
        this.recordingElapsed = 0;
      }),

      this.queries.activePlaybackTask.subscribe("qualify", () => {
        this.playback = true;
        this.resetCarriageToStart();
      }),

      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        this.playback = false;
      }),

      this.queries.activeMainMenuTask.subscribe("qualify", () => {
        this.recording = false;
        this.playback = false;
        this.recordingElapsed = 0;
        this.resetCarriageToStart();
        this.onCarriageReturnDisqualify();
      }),

      this.queries.activeCarriageReturnTask.subscribe(
        "qualify",
        () => this.onCarriageReturnQualify(),
        true,
      ),

      this.queries.activeCarriageReturnTask.subscribe("disqualify", () => {
        this.onCarriageReturnDisqualify();
      }),

      this.queries.carriageMeshGrabbed.subscribe("qualify", (mesh) => {
        if (this.queries.activeCarriageReturnTask.entities.size === 0) return;
        const rig = this.rigForMesh(mesh);
        if (rig) this.returnCarriage(rig, mesh);
      }),

      this.queries.carriageReturnDone.subscribe("qualify", (rig) => {
        this.finishCarriageReturn(rig);
      }),
    );
  }

  update(delta: number): void {
    if (!this.recording && !this.playback) return;

    const rig = this.first(this.queries.carriage.entities);
    const obj = rig?.object3D;
    if (!obj) return;

    if (this.recording) {
      this.recordingElapsed += delta;
    }

    const atEnd = this.advanceCarriageX(obj, delta);

    if (this.recording && (atEnd || this.recordingElapsed >= CARRIAGE_LAYOUT.travelDurationS)) {
      stopActiveRecording();
    }
  }

  private advanceCarriageX(obj: Object3D, delta: number): boolean {
    const nextX = obj.position.x + CARRIAGE_DIRECTION * CARRIAGE_SPEED * delta;
    obj.position.x =
      CARRIAGE_DIRECTION > 0
        ? Math.min(CARRIAGE_LAYOUT.endX, nextX)
        : Math.max(CARRIAGE_LAYOUT.endX, nextX);

    return CARRIAGE_DIRECTION > 0
      ? obj.position.x >= CARRIAGE_LAYOUT.endX
      : obj.position.x <= CARRIAGE_LAYOUT.endX;
  }

  private onCarriageReturnQualify(): void {
    const mesh = this.first(this.queries.carriageMesh.entities);
    const rig = this.first(this.queries.carriage.entities);
    if (!mesh || !rig?.object3D) return;

    rig
      .removeComponent(CarriageReturning)
      .removeComponent(SnapAnimation)
      .removeComponent(Grabbed);
    rig.object3D.visible = true;

    mesh
      .removeComponent(Grabbed)
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .addComponent(OneHandGrabbable)
      .addComponent(Highlight, { color: STOP_HIGHLIGHT_COLOR });
  }

  private onCarriageReturnDisqualify(): void {
    const mesh = this.first(this.queries.carriageMesh.entities);
    const rig = this.first(this.queries.carriage.entities);
    if (!rig) return;

    rig
      .removeComponent(CarriageReturning)
      .removeComponent(SnapAnimation)
      .removeComponent(Grabbed);

    if (mesh) {
      mesh
        .removeComponent(Grabbed)
        .removeComponent(OneHandGrabbable)
        .removeComponent(Highlight);
    }
  }

  private returnCarriage(rig: Entity, mesh: Entity): void {
    const obj = rig.object3D;
    if (
      !obj ||
      rig.hasComponent(SnapAnimation) ||
      rig.hasComponent(CarriageReturning)
    ) {
      return;
    }

    this.forceReleaseGrab(mesh);
    mesh
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .removeComponent(Grabbed);
    rig.addComponent(CarriageReturning);

    this.animateCarriageToStart(rig);
  }

  private animateCarriageToStart(rig: Entity): void {
    const obj = rig.object3D;
    if (!obj) return;

    rig.addComponent(SnapAnimation, {
      targetX: CARRIAGE_LAYOUT.startX,
      targetY: CARRIAGE_LAYOUT.position[1],
      targetZ: CARRIAGE_LAYOUT.position[2],
      targetQX: obj.quaternion.x,
      targetQY: obj.quaternion.y,
      targetQZ: obj.quaternion.z,
      targetQW: obj.quaternion.w,
      duration: CARRIAGE_RETURN_DURATION_MS,
    });

    playSnap();
  }

  private finishCarriageReturn(rig: Entity): void {
    const obj = rig.object3D;
    if (obj) {
      obj.position.set(...CARRIAGE_LAYOUT.position);
    }

    rig.removeComponent(CarriageReturning);

    for (const task of this.queries.activeCarriageReturnTask.entities) {
      if (!task.hasComponent(CompletedTask)) {
        task.addComponent(CompletedTask);
      }
    }
  }

  private resetCarriageToStart(): void {
    const rig = this.first(this.queries.carriage.entities);
    if (!rig?.object3D) return;

    rig.object3D.position.set(...CARRIAGE_LAYOUT.position);
    rig.object3D.quaternion.set(...CARRIAGE_LAYOUT.quaternion);
  }

  private rigForMesh(mesh: Entity): Entity | undefined {
    const meshObj = mesh.object3D;
    if (!meshObj?.parent) return undefined;

    for (const rig of this.queries.carriage.entities) {
      if (rig.object3D === meshObj.parent) return rig;
    }
    return undefined;
  }

  private forceReleaseGrab(entity: Entity): void {
    const handle = entity.getValue(Handle, "instance") as
      | CancellableHandle
      | undefined;
    if (handle?.cancel) {
      try {
        handle.cancel();
      } catch {
      }
    }
    if (entity.hasComponent(Handle)) {
      entity.removeComponent(Handle);
    }
    if (entity.hasComponent(Grabbed)) {
      entity.removeComponent(Grabbed);
    }
    if (entity.hasComponent(OneHandGrabbable)) {
      entity.removeComponent(OneHandGrabbable);
    }
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
