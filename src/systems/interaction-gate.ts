import {
  createSystem,
  Grabbed,
  InputActions,
  InputComponent,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { isInteractiveTask } from "../config/task-flow.js";
import { cancelActiveGrab } from "../helpers/grab-release.js";
import {
  closeInteractionGate,
  isInteractionGateOpen,
  openInteractionGate,
} from "../interaction/interaction-gate.js";

export class InteractionGateSystem extends createSystem({
  grabbed: { required: [Grabbed] },
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        if (isInteractiveTask(taskId)) {
          openInteractionGate();
        }
      }),
    );
  }

  update() {
    if (!isInteractionGateOpen()) return;

    for (const entity of this.queries.grabbed.entities) {
      cancelActiveGrab(entity);
    }

    if (this.isGrabInputReleased()) {
      closeInteractionGate();
    }
  }

  private isGrabInputReleased(): boolean {
    if (this.input.actions.getButtonPressed(InputActions.InteractionSelect)) {
      return false;
    }

    for (const hand of ["left", "right"] as const) {
      const gamepad = this.input.xr.gamepads[hand];
      if (!gamepad) continue;
      if (gamepad.getButtonPressed(InputComponent.Trigger)) return false;
      if (gamepad.getButtonPressed(InputComponent.Squeeze)) return false;
    }

    return true;
  }
}
