import {
  createComponent,
  createSystem,
  Entity,
  Grabbed,
  InputActions,
  InputComponent,
  OneHandGrabbable,
  Types,
} from "@iwsdk/core";
import { Handle } from "@iwsdk/core/dist/grab/handles.js";

export const InteractionGate = createComponent("InteractionGate", {});

export const ReleaseGrab = createComponent("ReleaseGrab", {
  removeGrabbable: { type: Types.Boolean, default: false },
});

type CancellableHandle = { cancel?: () => void };

export class InteractionGateSystem extends createSystem({
  gateOpen: { required: [InteractionGate] },
  grabbed: { required: [Grabbed] },
  releaseGrab: { required: [ReleaseGrab] },
}) {
  private hands: readonly ["left", "right"] = ["left", "right"];
  private cancelGrabbedSub?: () => void;

  init() {
    this.cleanupFuncs.push(
      this.queries.gateOpen.subscribe("qualify", () => {
        this.cancelGrabbedSub = this.queries.grabbed.subscribe(
          "qualify",
          (entity) => this.cancelActiveGrab(entity),
        );
      }),

      this.queries.gateOpen.subscribe("disqualify", () => {
        this.cancelGrabbedSub?.();
        this.cancelGrabbedSub = undefined;
      }),

      this.queries.releaseGrab.subscribe("qualify", (entity) => {
        this.cancelActiveGrab(entity);
        if (entity.getValue(ReleaseGrab, "removeGrabbable")) {
          entity.removeComponent(OneHandGrabbable);
        }
        entity.removeComponent(ReleaseGrab);
      }),
    );
  }

  update() {
    if (!this.world.sceneEntity.hasComponent(InteractionGate)) return;

    if (this.isGrabInputReleased()) {
      this.world.sceneEntity.removeComponent(InteractionGate);
    }
  }

  private cancelActiveGrab(entity: Entity): void {
    const handle = entity.getValue(Handle, "instance") as
      | CancellableHandle
      | undefined;
    if (handle?.cancel) {
      try {
        handle.cancel();
      } catch {
      }
    }
    if (entity.hasComponent(Handle)) {
      entity.removeComponent(Handle);
    }
    if (entity.hasComponent(Grabbed)) {
      entity.removeComponent(Grabbed);
    }
  }

  private isGrabInputReleased(): boolean {
    if (this.input.actions.getButtonPressed(InputActions.InteractionSelect)) {
      return false;
    }

    for (const hand of this.hands) {
      const gamepad = this.input.xr.gamepads[hand];
      if (!gamepad) continue;
      if (gamepad.getButtonPressed(InputComponent.Trigger)) return false;
      if (gamepad.getButtonPressed(InputComponent.Squeeze)) return false;
    }

    return true;
  }
}
