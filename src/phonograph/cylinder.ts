import {
  createSystem,
  eq,
  createComponent,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../task.js";
import { Highlight } from "../utils/highlight.js";
import { Snappable, SnapGhost, Snapped } from "../utils/snap.js";
import { PopIn, Spin } from "../animations/animation.js";
import { PlacardTarget } from "../utils/object-placard.js";
import { RecordingArmed } from "../utils/instruction.js";

export const Cylinder = createComponent("Cylinder", {});

export class CylinderSystem extends createSystem({
  activeCylinderMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "cylinder_mount")],
  },
  activeRecordingTask: {
    required: [Task, ActiveTask, RecordingArmed],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording")],
  },
  activePlaybackTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback")],
  },
  cylinder: { required: [Cylinder] },
  snappedCylinder: { required: [Cylinder, Snapped] },
}) {
  init() {
    const [cylinderEntity] = this.queries.cylinder.entities;

    this.cleanupFuncs.push(
      this.queries.activeCylinderMountTask.subscribe("qualify", () => {
        cylinderEntity.object3D!.visible = true;
        cylinderEntity.addComponent(PopIn);
        cylinderEntity
          .addComponent(OneHandGrabbable)
          .addComponent(Snappable, { snapPointId: "cylinder_snap_point" })
          .addComponent(SnapGhost)
          .addComponent(Highlight);
        cylinderEntity.addComponent(PlacardTarget, {
          panelConfig: "./ui/cylinder-mount-instruction.json",
          offsetX: 0,
          offsetY: 0.2,
          offsetZ: 0,
          dismissOnGrab: false,
          dismissOnSnap: true,
          autoDismissMs: 0,
        });
      }),

      this.queries.snappedCylinder.subscribe("qualify", (entity) => {
        entity.removeComponent(Highlight).removeComponent(SnapGhost);
        for (const task of this.queries.activeCylinderMountTask.entities) {
          task.addComponent(CompletedTask);
        }
      }),

      this.queries.activeRecordingTask.subscribe("qualify", () => {
        cylinderEntity.addComponent(Spin);
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        cylinderEntity.removeComponent(Spin);
      }),

      this.queries.activePlaybackTask.subscribe("qualify", () => {
        cylinderEntity.addComponent(Spin);
      }),

      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        cylinderEntity.removeComponent(Spin);
      }),
    );
  }
}
