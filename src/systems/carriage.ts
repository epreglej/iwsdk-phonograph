import {
  createComponent,
  createSystem,
  Entity,
  eq,
  Euler,
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
type Quat4 = [number, number, number, number];

const NEEDLE_TILT_X_DEG = 4;
const NEEDLE_TILT_X_RAD = (NEEDLE_TILT_X_DEG * Math.PI) / 180;

const _engagedQuat = new Quaternion().setFromEuler(
  new Euler(-NEEDLE_TILT_X_RAD, 0, 0),
);

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
  quaternion: [0, 0, 0, 1] as Quat4,
  engagedQuaternion: [
    _engagedQuat.x,
    _engagedQuat.y,
    _engagedQuat.z,
    _engagedQuat.w,
  ] as Quat4,
  startX: 0.08,
  endX: -0.08,
  travelDurationS: 120,
};

const _worldPos = new Vector3();
const _worldQuat = new Quaternion();
const _parentWorldQuat = new Quaternion();
const _localQuat = new Quaternion();

export function carriageRestPosition(x: number): Vec3 {
  return [x, CARRIAGE_LAYOUT.position[1], CARRIAGE_LAYOUT.position[2]];
}

export function carriageEngagedPosition(x: number): Vec3 {
  return carriageRestPosition(x);
}

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
export const CarriageLowering = createComponent("CarriageLowering", {});
export const CarriageTraveling = createComponent("CarriageTraveling", {});

const CARRIAGE_MOVE_DURATION_MS = 300;
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
  activeRecordingCarriageLowerTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_carriage_lower")],
  },
  activePlaybackCarriageLowerTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_carriage_lower")],
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
    excluded: [MoveTo, CarriageReturning, CarriageLowering],
  },
  carriageReturnDone: {
    required: [Carriage, MoveDone, CarriageReturning],
  },
  carriageLowerDone: {
    required: [Carriage, MoveDone, CarriageLowering],
  },
  carriageTravelDone: {
    required: [Carriage, MoveDone, CarriageTraveling],
  },
}) {
  init() {
    this.resetCarriageToRest();

    this.cleanupFuncs.push(
      this.queries.activeRecordingTask.subscribe("qualify", () => {
        this.resetCarriageToEngagedStart();
        this.startCarriageTravel();
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        this.stopCarriageTravel();
      }),

      this.queries.activePlaybackTask.subscribe("qualify", () => {
        this.resetCarriageToEngagedStart();
        this.startCarriageTravel();
      }),

      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        this.stopCarriageTravel();
      }),

      this.queries.activeMainMenuTask.subscribe("qualify", () => {
        this.stopCarriageTravel();
        this.resetCarriageToRest();
        this.onCarriageReturnDisqualify();
        this.onCarriageLowerDisqualify();
      }),

      this.queries.carriageTravelDone.subscribe("qualify", (rig) => {
        rig.removeComponent(CarriageTraveling);
        if (this.queries.activeRecordingTask.entities.size > 0) {
          this.world.sceneEntity.addComponent(StopRecording);
        }
      }),

      this.queries.activeRecordingCarriageLowerTask.subscribe(
        "qualify",
        () => this.onCarriageLowerQualify(),
        true,
      ),
      this.queries.activePlaybackCarriageLowerTask.subscribe(
        "qualify",
        () => this.onCarriageLowerQualify(),
        true,
      ),

      this.queries.activeRecordingCarriageLowerTask.subscribe("disqualify", () => {
        this.onCarriageLowerDisqualify();
      }),
      this.queries.activePlaybackCarriageLowerTask.subscribe("disqualify", () => {
        this.onCarriageLowerDisqualify();
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
        const rig = this.rigForMesh(mesh);
        if (!rig) return;

        if (this.queries.activeCarriageReturnTask.entities.size > 0) {
          this.returnCarriage(rig, mesh);
          return;
        }

        if (this.isCarriageLowerActive()) {
          this.lowerCarriage(rig, mesh);
        }
      }),

      this.queries.carriageReturnDone.subscribe("qualify", (rig) => {
        this.finishCarriageReturn(rig);
      }),

      this.queries.carriageLowerDone.subscribe("qualify", (rig) => {
        this.finishCarriageLower(rig);
      }),
    );
  }

  private isCarriageLowerActive(): boolean {
    return (
      this.queries.activeRecordingCarriageLowerTask.entities.size > 0 ||
      this.queries.activePlaybackCarriageLowerTask.entities.size > 0
    );
  }

  private startCarriageTravel(): void {
    const rig = this.first(this.queries.carriage.entities);
    if (!rig) return;

    const [targetX, targetY, targetZ] = carriageEngagedPosition(
      CARRIAGE_LAYOUT.endX,
    );
    const [targetQX, targetQY, targetQZ, targetQW] =
      CARRIAGE_LAYOUT.engagedQuaternion;

    rig.removeComponent(CarriageReturning).removeComponent(CarriageLowering);
    rig.addComponent(CarriageTraveling);
    rig.addComponent(MoveTo, {
      targetX,
      targetY,
      targetZ,
      targetQX,
      targetQY,
      targetQZ,
      targetQW,
      useTargetRotation: true,
      duration: CARRIAGE_TRAVEL_DURATION_MS,
      linear: true,
    });
  }

  private stopCarriageTravel(): void {
    const rig = this.first(this.queries.carriage.entities);
    if (!rig) return;

    rig.removeComponent(CarriageTraveling).removeComponent(MoveTo);
  }

  private onCarriageLowerQualify(): void {
    const mesh = this.first(this.queries.carriageMesh.entities);
    const rig = this.first(this.queries.carriage.entities);
    if (!mesh || !rig?.object3D) return;

    rig
      .removeComponent(CarriageLowering)
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

  private onCarriageLowerDisqualify(): void {
    const mesh = this.first(this.queries.carriageMesh.entities);
    const rig = this.first(this.queries.carriage.entities);
    if (!rig) return;

    rig
      .removeComponent(CarriageLowering)
      .removeComponent(MoveTo)
      .removeComponent(Grabbed);

    if (mesh) {
      mesh
        .removeComponent(Grabbed)
        .removeComponent(OneHandGrabbable)
        .removeComponent(Highlight);
    }
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

  private lowerCarriage(rig: Entity, mesh: Entity): void {
    if (
      !rig.object3D ||
      rig.hasComponent(MoveTo) ||
      rig.hasComponent(CarriageLowering)
    ) {
      return;
    }

    mesh.addComponent(ReleaseGrab, { removeGrabbable: true });
    mesh
      .removeComponent(Highlight)
      .removeComponent(OneHandGrabbable)
      .removeComponent(Grabbed);
    rig.addComponent(CarriageLowering);

    this.animateCarriageToEngaged(rig, CARRIAGE_LAYOUT.startX);
  }

  private returnCarriage(rig: Entity, mesh: Entity): void {
    if (
      !rig.object3D ||
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

    this.animateCarriageToRest(rig, CARRIAGE_LAYOUT.startX);
  }

  private animateCarriageToEngaged(rig: Entity, x: number): void {
    const [targetX, targetY, targetZ] = carriageEngagedPosition(x);
    const [targetQX, targetQY, targetQZ, targetQW] =
      CARRIAGE_LAYOUT.engagedQuaternion;

    rig.addComponent(MoveTo, {
      targetX,
      targetY,
      targetZ,
      targetQX,
      targetQY,
      targetQZ,
      targetQW,
      useTargetRotation: true,
      duration: CARRIAGE_MOVE_DURATION_MS,
    });
    playSnap();
  }

  private animateCarriageToRest(rig: Entity, x: number): void {
    const [targetX, targetY, targetZ] = carriageRestPosition(x);
    const [targetQX, targetQY, targetQZ, targetQW] = CARRIAGE_LAYOUT.quaternion;

    rig.addComponent(MoveTo, {
      targetX,
      targetY,
      targetZ,
      targetQX,
      targetQY,
      targetQZ,
      targetQW,
      useTargetRotation: true,
      duration: CARRIAGE_MOVE_DURATION_MS,
    });
    playSnap();
  }

  private finishCarriageLower(rig: Entity): void {
    rig.removeComponent(CarriageLowering);

    for (const task of this.queries.activeRecordingCarriageLowerTask.entities) {
      if (!task.hasComponent(CompletedTask)) {
        task.addComponent(CompletedTask);
      }
    }
    for (const task of this.queries.activePlaybackCarriageLowerTask.entities) {
      if (!task.hasComponent(CompletedTask)) {
        task.addComponent(CompletedTask);
      }
    }
  }

  private finishCarriageReturn(rig: Entity): void {
    rig.removeComponent(CarriageReturning);
    this.teleportCarriageToRest(rig, CARRIAGE_LAYOUT.startX);

    for (const task of this.queries.activeCarriageReturnTask.entities) {
      if (!task.hasComponent(CompletedTask)) {
        task.addComponent(CompletedTask);
      }
    }
  }

  private resetCarriageToRest(): void {
    this.teleportCarriageToRest(
      this.first(this.queries.carriage.entities),
      CARRIAGE_LAYOUT.startX,
    );
  }

  private resetCarriageToEngagedStart(): void {
    this.teleportCarriageToEngaged(
      this.first(this.queries.carriage.entities),
      CARRIAGE_LAYOUT.startX,
    );
  }

  private teleportCarriageToRest(
    rig: Entity | undefined,
    x: number,
  ): void {
    if (!rig?.object3D) return;

    const [targetX, targetY, targetZ] = carriageRestPosition(x);
    const [targetQX, targetQY, targetQZ, targetQW] = CARRIAGE_LAYOUT.quaternion;

    rig.removeComponent(MoveTo);
    rig.addComponent(TeleportTo, {
      targetX,
      targetY,
      targetZ,
      targetQX,
      targetQY,
      targetQZ,
      targetQW,
      useTargetRotation: true,
    });
  }

  private teleportCarriageToEngaged(
    rig: Entity | undefined,
    x: number,
  ): void {
    if (!rig?.object3D) return;

    const [targetX, targetY, targetZ] = carriageEngagedPosition(x);
    const [targetQX, targetQY, targetQZ, targetQW] =
      CARRIAGE_LAYOUT.engagedQuaternion;

    rig.removeComponent(MoveTo);
    rig.addComponent(TeleportTo, {
      targetX,
      targetY,
      targetZ,
      targetQX,
      targetQY,
      targetQZ,
      targetQW,
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
