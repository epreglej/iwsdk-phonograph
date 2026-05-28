import { createComponent, Types } from "@iwsdk/core";

export const Phonograph = createComponent("Phonograph", {});

export const Cylinder = createComponent("Cylinder", {});

export const Crank = createComponent("Crank", {
  requiredRotations: { type: Types.Float32, default: 3 },
});

export const CrankingComplete = createComponent("CrankingComplete", {});
export const CrankHeld = createComponent("CrankHeld", {});
