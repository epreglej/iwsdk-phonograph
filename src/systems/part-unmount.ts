import {
  createSystem,
  Entity,
  Grabbed,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Phonograph } from "../components/phonograph.js";
import { PhonographPart } from "../components/phonograph-part.js";
import { PopOut, PopOutDone, SnapAnimation } from "../components/animation.js";
import { Highlight, STOP_HIGHLIGHT_COLOR } from "../components/highlight.js";
import { Snappable, SnapGhost, Snapped } from "../components/snap.js";
import { Unmounting, UnmountPopping } from "../components/unmounting.js";
import { UNMOUNT_BY_TASK } from "../config/task-flow.js";
import { forceReleaseGrab } from "../helpers/grab-release.js";
import { getPart } from "../helpers/parts.js";
import { playPop } from "../audio/sfx.js";
import {
  isCarriagePart,
  reparentPartToPhonographStaging,
} from "../helpers/carriage-attach.js";
import { firstEntity } from "../helpers/entity-query.js";

export class PartUnmountSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  parts: { required: [PhonographPart] },
  phonograph: { required: [Phonograph] },
  grabbedWhileUnmounting: {
    required: [Unmounting, Grabbed],
    excluded: [PopOut, UnmountPopping],
  },
  unmountDone: { required: [Unmounting, PopOutDone] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        if (!UNMOUNT_BY_TASK[taskId]) return;
        const part = this.partForTask(taskId);
        if (part) this.activateUnmount(part, taskId);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        if (!UNMOUNT_BY_TASK[taskId]) return;
        const part = this.partForTask(taskId);
        part?.removeComponent(Unmounting);
      }),

      this.queries.grabbedWhileUnmounting.subscribe("qualify", (part) => {
        this.finishUnmount(part);
      }),

      this.queries.unmountDone.subscribe("qualify", (part) => {
        this.completeUnmount(part);
      }),
    );
  }

  private partForTask(taskId: string): Entity | undefined {
    const binding = UNMOUNT_BY_TASK[taskId];
    if (!binding) return undefined;
    return getPart(this.queries.parts.entities, binding.partId);
  }

  private activateUnmount(part: Entity, taskId: string): void {
    part.object3D!.visible = true;
    part
      .addComponent(Unmounting, { taskId })
      .removeComponent(Snapped)
      .removeComponent(SnapGhost)
      .removeComponent(Snappable)
      .addComponent(OneHandGrabbable)
      .addComponent(Highlight, { color: STOP_HIGHLIGHT_COLOR });
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

    const partId = part.getValue(PhonographPart, "id");
    const phonograph = firstEntity(this.queries.phonograph.entities);
    if (isCarriagePart(partId) && phonograph?.object3D) {
      reparentPartToPhonographStaging(part, phonograph.object3D);
    }

    const obj = part.object3D;
    if (obj) {
      obj.scale.setScalar(0.001);
      obj.visible = false;
    }

    if (!taskId) return;

    for (const task of this.queries.activeTask.entities) {
      if (task.getValue(Task, "id") === taskId) {
        task.addComponent(CompletedTask);
      }
    }
  }
}
