import {
  createSystem,
  Entity,
  eq,
  Grabbed,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import {
  RecordingDiaphragm,
  RecordingTrumpet,
} from "../components/phonograph-parts.js";
import { PopOut, SnapAnimation } from "../components/animation.js";
import { Highlight } from "../components/highlight.js";
import { Snappable, SnapGhost, Snapped } from "../components/snap.js";
import {
  Unmounting,
  UnmountPopping,
  UNMOUNT_HIGHLIGHT_COLOR,
} from "../components/unmounting.js";
import { forceReleaseGrab } from "../helpers/grab-release.js";
import { playPop } from "../audio/sfx.js";
import { firstEntity } from "../helpers/entity-query.js";

export class PartUnmountSystem extends createSystem({
  activeRecordingTrumpetUnmountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_trumpet_unmount")],
  },
  activeRecordingDiaphragmUnmountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_diaphragm_unmount")],
  },
  recordingTrumpet: { required: [RecordingTrumpet] },
  recordingDiaphragm: { required: [RecordingDiaphragm] },
  grabbedWhileUnmounting: {
    required: [Unmounting, Grabbed],
    excluded: [PopOut, UnmountPopping],
  },
  unmountPopOut: { required: [Unmounting, PopOut] },
}) {
  private partForTask(taskId: string): Entity | undefined {
    if (taskId === "recording_trumpet_unmount") {
      return firstEntity(this.queries.recordingTrumpet.entities);
    }
    if (taskId === "recording_diaphragm_unmount") {
      return firstEntity(this.queries.recordingDiaphragm.entities);
    }
    return undefined;
  }

  init() {
    this.cleanupFuncs.push(
      this.queries.activeRecordingTrumpetUnmountTask.subscribe(
        "qualify",
        (taskEntity) => {
          const part = this.partForTask(taskEntity.getValue(Task, "id")!);
          if (part) this.activateUnmount(part, "recording_trumpet_unmount");
        },
      ),

      this.queries.activeRecordingDiaphragmUnmountTask.subscribe(
        "qualify",
        (taskEntity) => {
          const part = this.partForTask(taskEntity.getValue(Task, "id")!);
          if (part) this.activateUnmount(part, "recording_diaphragm_unmount");
        },
      ),

      this.queries.activeRecordingTrumpetUnmountTask.subscribe(
        "disqualify",
        (taskEntity) => {
          const part = this.partForTask(taskEntity.getValue(Task, "id")!);
          part?.removeComponent(Unmounting);
        },
      ),

      this.queries.activeRecordingDiaphragmUnmountTask.subscribe(
        "disqualify",
        (taskEntity) => {
          const part = this.partForTask(taskEntity.getValue(Task, "id")!);
          part?.removeComponent(Unmounting);
        },
      ),

      this.queries.grabbedWhileUnmounting.subscribe("qualify", (part) => {
        this.finishUnmount(part);
      }),

      this.queries.unmountPopOut.subscribe("disqualify", (part) => {
        this.completeUnmount(part);
      }),
    );
  }

  private activateUnmount(part: Entity, taskId: string): void {
    part.object3D!.visible = true;
    part
      .addComponent(Unmounting, { taskId })
      .removeComponent(Snapped)
      .removeComponent(SnapGhost)
      .removeComponent(Snappable)
      .addComponent(OneHandGrabbable)
      .addComponent(Highlight, { color: UNMOUNT_HIGHLIGHT_COLOR });
  }

  private finishUnmount(part: Entity): void {
    if (!part.hasComponent(Unmounting) || part.hasComponent(UnmountPopping)) {
      return;
    }

    part.addComponent(UnmountPopping);
    forceReleaseGrab(part);

    part
      .removeComponent(Highlight)
      .removeComponent(Snappable)
      .removeComponent(SnapGhost)
      .removeComponent(Snapped)
      .removeComponent(SnapAnimation)
      .addComponent(PopOut);

    playPop();
  }

  private completeUnmount(part: Entity): void {
    const taskId = part.getValue(Unmounting, "taskId");
    forceReleaseGrab(part);
    part.removeComponent(Unmounting).removeComponent(UnmountPopping);

    const obj = part.object3D;
    if (obj) {
      obj.scale.setScalar(0.001);
      obj.visible = false;
    }

    if (!taskId) return;

    const activeUnmountTasks = [
      ...this.queries.activeRecordingTrumpetUnmountTask.entities,
      ...this.queries.activeRecordingDiaphragmUnmountTask.entities,
    ];

    for (const task of activeUnmountTasks) {
      if (task.getValue(Task, "id") === taskId) {
        task.addComponent(CompletedTask);
      }
    }
  }
}
