import {
  createSystem,
  Entity,
  Grabbed,
  isin,
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

const UNMOUNT_TASK_IDS = [
  "recording_trumpet_unmount",
  "recording_diaphragm_unmount",
] as const;

export class PartUnmountSystem extends createSystem({
  activeUnmountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [isin(Task, "id", [...UNMOUNT_TASK_IDS])],
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
      this.queries.activeUnmountTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const part = this.partForTask(taskId);
        if (part) this.activateUnmount(part, taskId);
      }),

      this.queries.activeUnmountTask.subscribe("disqualify", (taskEntity) => {
        const part = this.partForTask(taskEntity.getValue(Task, "id")!);
        part?.removeComponent(Unmounting);
      }),

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

    for (const task of this.queries.activeUnmountTask.entities) {
      if (task.getValue(Task, "id") === taskId) {
        task.addComponent(CompletedTask);
      }
    }
  }
}
