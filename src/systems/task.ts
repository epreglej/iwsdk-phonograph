import { createSystem, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { playTaskChime } from "../audio/sfx.js";

const INTRO_SEQUENCE = [
  "introduction_welcome",
  "introduction_content",
] as const;

const TASK_SEQUENCE = [
  "recording_setup_info",
  "cylinder_mount",
  "recording_diaphragm_mount",
  "recording_trumpet_mount",
  "crank_cranking",
  "recording_ready_info",
  "recording",
  "playback_setup_info",
  "recording_trumpet_unmount",
  "recording_diaphragm_unmount",
  "playback_diaphragm_mount",
  "playback_trumpet_mount",
  "playback_ready_info",
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

    if (lastId === "introduction_content") {
      next.addComponent(Task, { id: "recording_setup_info" });
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
