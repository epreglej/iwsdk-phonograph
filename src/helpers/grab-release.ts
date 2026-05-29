import { Entity, Grabbed, OneHandGrabbable } from "@iwsdk/core";
import { Handle } from "@iwsdk/core/dist/grab/handles.js";

type CancellableHandle = { cancel?: () => void };

/** Drop an active grab but keep the entity grabbable. */
export function cancelActiveGrab(entity: Entity): void {
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

export function forceReleaseGrab(entity: Entity): void {
  cancelActiveGrab(entity);
  if (entity.hasComponent(OneHandGrabbable)) {
    entity.removeComponent(OneHandGrabbable);
  }
}
