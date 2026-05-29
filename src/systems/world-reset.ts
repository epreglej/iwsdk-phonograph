import { createSystem, Entity, eq, Grabbed, OneHandGrabbable } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { PhonographPart } from "../components/phonograph-part.js";
import { Phonograph, BrakeShifted, BrakeReturning, CrankHeld, CrankingComplete } from "../components/phonograph.js";
import { CrankRotation } from "../components/crank-rotation.js";
import { Highlight } from "../components/highlight.js";
import { MountTaskBinding } from "../components/mount-task-binding.js";
import { PopIn, PopOut, SnapAnimation, Spin } from "../components/animation.js";
import { Snappable, Snapped, SnapGhost, SnapPoint } from "../components/snap.js";
import { Unmounting, UnmountPopping } from "../components/unmounting.js";
import { clearRecordedAudio } from "../audio/recording-store.js";
import { getPart } from "../helpers/parts.js";
import { PART_LAYOUT } from "../config/phonograph-layout.js";

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

    for (const layout of PART_LAYOUT) {
      const part = getPart(this.queries.parts.entities, layout.id);
      if (!part?.object3D) continue;
      part.object3D.position.set(...layout.position);
      part.object3D.quaternion.set(...layout.quaternion);
      part.object3D.scale.setScalar(1);
      part.object3D.visible = layout.visible;
      this.stripGameplay(part);
    }

    for (const snapPoint of this.queries.snapPoints.entities) {
      if (!snapPoint.object3D) continue;
      snapPoint.removeComponent(PopIn).removeComponent(PopOut);
      snapPoint.object3D.scale.setScalar(0.001);
      snapPoint.object3D.visible = false;
    }
  }

  private stripGameplay(entity: Entity): void {
    for (const component of GAMEPLAY_COMPONENTS) {
      entity.removeComponent(component);
    }
  }
}
