import { createComponent, createSystem, eq, Types } from "@iwsdk/core";
import { playTaskChime } from "./audio/sfx.js";

export const Task = createComponent("Task", {
  id: { type: Types.String, default: "introduction_welcome" },
});
export const ActiveTask = createComponent("ActiveTask", {});
export const CompletedTask = createComponent("CompletedTask", {});

const INTRO_SEQUENCE = [
  "introduction_welcome",
  "introduction_content",
  "introduction_interaction",
] as const;

const TASK_SEQUENCE = [
  "cylinder_mount",
  "recording_diaphragm_mount",
  "recording_trumpet_mount",
  "crank_cranking",
  "recording",
  "recording_trumpet_unmount",
  "recording_diaphragm_unmount",
  "playback_diaphragm_mount",
  "playback_trumpet_mount",
  "playback",
] as const;

export class TaskSystem extends createSystem({
  completedActiveTask: { required: [Task, ActiveTask, CompletedTask] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.completedActiveTask.subscribe("qualify", (entity) => {
        const lastId = entity.getValue(Task, "id")!;
        playTaskChime();
        this.transition(lastId);
        entity.dispose();
      }),
    );
  }

  private transition(lastId: string) {
    const next = this.world.createEntity().addComponent(ActiveTask);

    const introIndex = INTRO_SEQUENCE.indexOf(
      lastId as (typeof INTRO_SEQUENCE)[number],
    );
    if (introIndex >= 0 && introIndex < INTRO_SEQUENCE.length - 1) {
      next.addComponent(Task, { id: INTRO_SEQUENCE[introIndex + 1] });
      return;
    }

    if (lastId === "introduction_interaction") {
      next.addComponent(Task, { id: "cylinder_mount" });
      return;
    }

    const index = TASK_SEQUENCE.indexOf(lastId as (typeof TASK_SEQUENCE)[number]);
    if (index >= 0 && index < TASK_SEQUENCE.length - 1) {
      next.addComponent(Task, { id: TASK_SEQUENCE[index + 1] });
    } else if (lastId === "playback") {
      next.addComponent(Task, { id: "done" });
    }
  }
}
