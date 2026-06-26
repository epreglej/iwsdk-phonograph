import { createSystem } from "@iwsdk/core";

type Hand = "left" | "right";

/**
 * IWSDK's MultiPointer shows a shared surface cursor for every active pointer,
 * including touch/poke. The finger tip is already visible — suppress the dot.
 */
type MultiPointerWithCursor = {
  getActiveKind(): "ray" | "grab" | "touch" | null;
  cursorVisual: { setVisible(visible: boolean): void };
};

export class HidePokeCursorSystem extends createSystem({}) {
  update() {
    for (const hand of ["left", "right"] as Hand[]) {
      const multiPointer = this.input.xr.multiPointers[
        hand
      ] as unknown as MultiPointerWithCursor;

      if (multiPointer.getActiveKind() === "touch") {
        multiPointer.cursorVisual.setVisible(false);
      }
    }
  }
}
