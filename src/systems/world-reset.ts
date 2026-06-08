import { createSystem, Entity, eq, Grabbed, OneHandGrabbable } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { PhonographPart } from "./phonograph.js";
import { Phonograph } from "./phonograph.js";
import { Carriage, CarriageMesh, CarriageReturning } from "./carriage.js";
import { BrakeShifted, BrakeReturning } from "./brake.js";
import { CrankHeld, CrankingComplete, CrankRotation } from "./crank.js";
import { Highlight } from "./highlight.js";
import { MountTaskBinding } from "./mount.js";
import { PopIn, PopOut, SnapAnimation, Spin } from "./animation.js";
import { Snappable, Snapped, SnapGhost, SnapPoint } from "./snap.js";
import { Unmounting, UnmountPopping } from "./unmount.js";
import { clearRecordedAudio } from "./recording.js";
import {
  CARRIAGE_LAYOUT,
  PART_LAYOUT,
  isCarriagePart,
  reparentObject3D,
} from "../config.js";

const GAMEPLAY_COMPONENTS = [
  MountTaskBinding,
  OneHandGrabbable,
  Grabbed,
  Snappable,
  Snapped,
  SnapGhost,
  SnapAnimation,
  Unmounting,
  UnmountPopping,
  Highlight,
  PopIn,
  PopOut,
  Spin,
  CrankHeld,
  CrankingComplete,
  CrankRotation,
  BrakeShifted,
  BrakeReturning,
  CarriageReturning,
] as const;

export class WorldResetSystem extends createSystem({
  activeMainMenuTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "main_menu")],
  },
  phonograph: { required: [Phonograph] },
  parts: { required: [PhonographPart] },
  snapPoints: { required: [SnapPoint] },
  carriage: { required: [Carriage] },
  carriageMesh: { required: [CarriageMesh] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeMainMenuTask.subscribe("qualify", () => {
        this.resetWorld();
      }),
    );
  }

  private resetWorld(): void {
    clearRecordedAudio();

    for (const phonograph of this.queries.phonograph.entities) {
      if (phonograph.object3D) phonograph.object3D.visible = false;
      this.stripGameplay(phonograph);
    }

    const phonographRoot = this.first(this.queries.phonograph.entities)?.object3D;

    for (const layout of PART_LAYOUT) {
      const part = this.partById(layout.id);
      if (!part?.object3D) continue;
      if (phonographRoot && isCarriagePart(layout.id)) {
        this.reparentPartToPhonographStaging(part, phonographRoot);
      } else {
        part.object3D.position.set(...layout.position);
        part.object3D.quaternion.set(...layout.quaternion);
      }
      part.object3D.scale.setScalar(1);
      part.object3D.visible = layout.visible;
      this.stripGameplay(part);
    }

    for (const carriage of this.queries.carriage.entities) {
      if (!carriage.object3D) continue;
      carriage.object3D.position.set(...CARRIAGE_LAYOUT.position);
      carriage.object3D.quaternion.set(...CARRIAGE_LAYOUT.quaternion);
      carriage.object3D.visible = true;
      this.stripGameplay(carriage);
    }

    for (const mesh of this.queries.carriageMesh.entities) {
      this.stripGameplay(mesh);
    }

    for (const snapPoint of this.queries.snapPoints.entities) {
      if (!snapPoint.object3D) continue;
      snapPoint.removeComponent(PopIn).removeComponent(PopOut);
      snapPoint.object3D.scale.setScalar(0.001);
      snapPoint.object3D.visible = false;
    }
  }

  private reparentPartToPhonographStaging(
    part: Entity,
    phonographRoot: import("@iwsdk/core").Object3D,
  ): void {
    const partId = part.getValue(PhonographPart, "id");
    const layout = PART_LAYOUT.find((entry) => entry.id === partId);
    if (!layout) return;

    const obj = part.object3D;
    if (!obj) return;

    if (obj.parent !== phonographRoot) {
      reparentObject3D(obj, phonographRoot);
    }

    obj.position.set(...layout.position);
    obj.quaternion.set(...layout.quaternion);
  }

  private stripGameplay(entity: Entity): void {
    for (const component of GAMEPLAY_COMPONENTS) {
      entity.removeComponent(component);
    }
  }

  private partById(id: string): Entity | undefined {
    for (const part of this.queries.parts.entities) {
      if (part.getValue(PhonographPart, "id") === id) return part;
    }
    return undefined;
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
