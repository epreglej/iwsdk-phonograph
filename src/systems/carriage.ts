import {
  createComponent,
  createSystem,
  Entity,
  eq,
  Grabbed,
  Object3D,
  OneHandGrabbable,
  Quaternion,
  Vector3,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { MoveDone, MoveTo, TeleportTo } from "./animation.js";
import { Highlight, STOP_HIGHLIGHT_COLOR } from "./highlight.js";
import { StopRecording } from "./recording.js";
import { ReleaseGrab } from "./interaction-gate.js";
import { playSnap } from "../audio/sfx.js";

type Vec3 = [number, number, number];

export const CARRIAGE_SNAP_POINT_IDS = [
  "recorder_snap_point",
  "horn_snap_point",
] as const;

export const CARRIAGE_PART_IDS = [
  "recorder",
  "reproducer",
  "recording_horn",
  "listening_horn",
] as const;

export const CARRIAGE_LAYOUT = {
  assetKey: "carriage",
  position: [0.08, 0.2375, 0.03885] as Vec3,
  quaternion: [0, 0, 0, 1] as [number, number, number, number],
  startX: 0.08,
  endX: -0.08,
  travelDurationS: 120,
};

const _worldPos = new Vector3();
const _worldQuat = new Quaternion();
const _parentWorldQuat = new Quaternion();
const _localQuat = new Quaternion();

export function isCarriageSnapPoint(snapPointId: string): boolean {
  return (CARRIAGE_SNAP_POINT_IDS as readonly string[]).includes(snapPointId);
}

export function isCarriagePart(partId: string | null | undefined): boolean {
  return partId != null && (CARRIAGE_PART_IDS as readonly string[]).includes(partId);
}

export function snapPointLocalOnCarriage(phonographLocal: Vec3): Vec3 {
  const [, cy, cz] = CARRIAGE_LAYOUT.position;
  return [0, phonographLocal[1] - cy, phonographLocal[2] - cz];
}

export function reparentObject3D(child: Object3D, newParent: Object3D): void {
  child.updateWorldMatrix(true, false);
  child.getWorldPosition(_worldPos);
  child.getWorldQuaternion(_worldQuat);

  newParent.add(child);
  newParent.updateWorldMatrix(true, false);
  newParent.worldToLocal(_worldPos);
  child.position.copy(_worldPos);

  newParent.getWorldQuaternion(_parentWorldQuat);
  _parentWorldQuat.invert();
  _localQuat.copy(_parentWorldQuat).multiply(_worldQuat);
  child.quaternion.copy(_localQuat);
}

export const Carriage = createComponent("Carriage", {});
export const CarriageMesh = createComponent("CarriageMesh", {});
export const CarriageReturning = createComponent("CarriageReturning", {});
export const CarriageTraveling = createComponent("CarriageTraveling", {});

const CARRIAGE_RETURN_DURATION_MS = 300;
const CARRIAGE_TRAVEL_DURATION_MS = CARRIAGE_LAYOUT.travelDurationS * 1000;

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
    excluded: [MoveTo, CarriageReturning],
  },
  carriageReturnDone: {
    required: [Carriage, MoveDone, CarriageReturning],
  },
  carriageTravelDone: {
    required: [Carriage, MoveDone, CarriageTraveling],
  },
}) {
  init() {
    this.resetCarriageToStart();

    this.cleanupFuncs.push(
      this.queries.activeRecordingTask.subscribe("qualify", () => {
        this.resetCarriageToStart();
        this.startCarriageTravel();
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        this.stopCarriageTravel();
      }),

      this.queries.activePlaybackTask.subscribe("qualify", () => {
        this.resetCarriageToStart();
        this.startCarriageTravel();
      }),

      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        this.stopCarriageTravel();
      }),

      this.queries.activeMainMenuTask.subscribe("qualify", () => {
        this.stopCarriageTravel();
        this.resetCarriageToStart();
        this.onCarriageReturnDisqualify();
      }),

      this.queries.carriageTravelDone.subscribe("qualify", (rig) => {
        rig.removeComponent(CarriageTraveling);
        if (this.queries.activeRecordingTask.entities.size > 0) {
          this.world.sceneEntity.addComponent(StopRecording);
        }
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

  private startCarriageTravel(): void {
    const rig = this.first(this.queries.carriage.entities);
    if (!rig) return;

    rig.removeComponent(CarriageReturning);
    rig.addComponent(CarriageTraveling);
    rig.addComponent(MoveTo, {
      targetX: CARRIAGE_LAYOUT.endX,
      targetY: CARRIAGE_LAYOUT.position[1],
      targetZ: CARRIAGE_LAYOUT.position[2],
      duration: CARRIAGE_TRAVEL_DURATION_MS,
      linear: true,
    });
  }

  private stopCarriageTravel(): void {
    const rig = this.first(this.queries.carriage.entities);
    if (!rig) return;

    rig.removeComponent(CarriageTraveling).removeComponent(MoveTo);
  }

  private onCarriageReturnQualify(): void {
    const mesh = this.first(this.queries.carriageMesh.entities);
    const rig = this.first(this.queries.carriage.entities);
    if (!mesh || !rig?.object3D) return;

    rig
      .removeComponent(CarriageReturning)
      .removeComponent(MoveTo)
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
      .removeComponent(MoveTo)
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
      rig.hasComponent(MoveTo) ||
      rig.hasComponent(CarriageReturning)
    ) {
      return;
    }

    mesh.addComponent(ReleaseGrab, { removeGrabbable: true });
    mesh
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .removeComponent(Grabbed);
    rig.addComponent(CarriageReturning);

    this.animateCarriageToStart(rig);
  }

  private animateCarriageToStart(rig: Entity): void {
    rig.addComponent(MoveTo, {
      targetX: CARRIAGE_LAYOUT.startX,
      targetY: CARRIAGE_LAYOUT.position[1],
      targetZ: CARRIAGE_LAYOUT.position[2],
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

    rig.removeComponent(MoveTo);
    rig.addComponent(TeleportTo, {
      targetX: CARRIAGE_LAYOUT.position[0],
      targetY: CARRIAGE_LAYOUT.position[1],
      targetZ: CARRIAGE_LAYOUT.position[2],
      targetQX: CARRIAGE_LAYOUT.quaternion[0],
      targetQY: CARRIAGE_LAYOUT.quaternion[1],
      targetQZ: CARRIAGE_LAYOUT.quaternion[2],
      targetQW: CARRIAGE_LAYOUT.quaternion[3],
      useTargetRotation: true,
    });
  }

  private rigForMesh(mesh: Entity): Entity | undefined {
    const meshObj = mesh.object3D;
    if (!meshObj?.parent) return undefined;

    for (const rig of this.queries.carriage.entities) {
      if (rig.object3D === meshObj.parent) return rig;
    }
    return undefined;
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
