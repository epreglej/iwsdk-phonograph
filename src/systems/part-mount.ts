import {
  createSystem,
  Entity,
  isin,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { MountTaskBinding } from "../components/mount-task-binding.js";
import { PopIn } from "../components/animation.js";
import { Highlight } from "../components/highlight.js";
import { Snappable, SnapGhost } from "../components/snap.js";
import { Cylinder } from "../components/phonograph.js";
import {
  PlaybackDiaphragm,
  RecordingDiaphragm,
  PlaybackTrumpet,
  RecordingTrumpet,
} from "../components/phonograph-parts.js";
import { firstEntity } from "../helpers/entity-query.js";

type MountBinding = {
  taskId: string;
  snapPointId: string;
};

const MOUNT_BINDINGS: MountBinding[] = [
  { taskId: "cylinder_mount", snapPointId: "cylinder_snap_point" },
  { taskId: "recording_diaphragm_mount", snapPointId: "diaphragm_snap_point" },
  { taskId: "playback_diaphragm_mount", snapPointId: "diaphragm_snap_point" },
  { taskId: "recording_trumpet_mount", snapPointId: "trumpet_snap_point" },
  { taskId: "playback_trumpet_mount", snapPointId: "trumpet_snap_point" },
];

const MOUNT_TASK_IDS = MOUNT_BINDINGS.map((b) => b.taskId);

export class PartMountSystem extends createSystem({
  activeMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [isin(Task, "id", MOUNT_TASK_IDS)],
  },
  cylinder: { required: [Cylinder] },
  recordingDiaphragm: { required: [RecordingDiaphragm] },
  playbackDiaphragm: { required: [PlaybackDiaphragm] },
  recordingTrumpet: { required: [RecordingTrumpet] },
  playbackTrumpet: { required: [PlaybackTrumpet] },
}) {
  private partForTask(taskId: string): Entity | undefined {
    switch (taskId) {
      case "cylinder_mount":
        return firstEntity(this.queries.cylinder.entities);
      case "recording_diaphragm_mount":
        return firstEntity(this.queries.recordingDiaphragm.entities);
      case "playback_diaphragm_mount":
        return firstEntity(this.queries.playbackDiaphragm.entities);
      case "recording_trumpet_mount":
        return firstEntity(this.queries.recordingTrumpet.entities);
      case "playback_trumpet_mount":
        return firstEntity(this.queries.playbackTrumpet.entities);
      default:
        return undefined;
    }
  }

  init() {
    this.cleanupFuncs.push(
      this.queries.activeMountTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const binding = MOUNT_BINDINGS.find((b) => b.taskId === taskId);
        const part = this.partForTask(taskId);
        if (binding && part) {
          this.activateMount(part, binding.snapPointId, binding.taskId);
        }
      }),

      this.queries.activeMountTask.subscribe("disqualify", (taskEntity) => {
        const part = this.partForTask(taskEntity.getValue(Task, "id")!);
        if (part) this.deactivateMount(part);
      }),
    );
  }

  private activateMount(
    part: Entity,
    snapPointId: string,
    taskId: string,
  ): void {
    // Ensure PopIn always has distance to tween from.
    part.object3D!.scale.setScalar(0.001);
    part.object3D!.visible = true;
    part.addComponent(PopIn);
    part
      .addComponent(OneHandGrabbable)
      .addComponent(Snappable, { snapPointId })
      .addComponent(SnapGhost)
      .addComponent(Highlight)
      .addComponent(MountTaskBinding, { taskId, snapPointId });
  }

  private deactivateMount(part: Entity): void {
    part
      .removeComponent(MountTaskBinding)
      .removeComponent(Highlight)
      .removeComponent(SnapGhost)
      .removeComponent(Snappable)
      .removeComponent(OneHandGrabbable);
  }
}
