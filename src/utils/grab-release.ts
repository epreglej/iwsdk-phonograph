import { Entity, OneHandGrabbable } from "@iwsdk/core";
// GrabSystem-internal component (not re-exported from @iwsdk/core).
import { Handle } from "@iwsdk/core/dist/grab/handles.js";

type CancellableHandle = { cancel?: () => void };

/** End an active one-hand grab (Handle is managed by GrabSystem). */
export function forceReleaseGrab(entity: Entity): void {
  const handle = entity.getValue(Handle, "instance") as
    | CancellableHandle
    | undefined;
  if (handle?.cancel) {
    try {
      handle.cancel();
    } catch {
      // Handle may already be torn down.
    }
  }
  if (entity.hasComponent(Handle)) {
    entity.removeComponent(Handle);
  }
  if (entity.hasComponent(OneHandGrabbable)) {
    entity.removeComponent(OneHandGrabbable);
  }
}
