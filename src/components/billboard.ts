import { createComponent, Types } from "@iwsdk/core";

export const Billboard = createComponent("Billboard", {
  lockY: { type: Types.Boolean, default: false },
});
