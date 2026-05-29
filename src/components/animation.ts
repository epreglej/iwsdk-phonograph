import { createComponent, Types } from "@iwsdk/core";

/**
 * Animation durations (ms). Single source of truth: any code that needs to
 * wait for a pop-out to finish must use POP_OUT_MS so timers can't drift from
 * the animation that AnimationSystem actually runs.
 */
export const POP_IN_MS = 700;
export const POP_OUT_MS = 550;
export const SPIN_PERIOD_MS = 1000;

/** Scale pop animations. `from` < 0 is a sentinel meaning "capture on first frame". */
const POP_FIELDS = {
  elapsed: { type: Types.Float32, default: 0 },
  from: { type: Types.Float32, default: -1 },
} as const;

export const PopIn = createComponent("PopIn", { ...POP_FIELDS });
export const PopIn2D = createComponent("PopIn2D", { ...POP_FIELDS });
export const PopOut = createComponent("PopOut", { ...POP_FIELDS });
export const PopOut2D = createComponent("PopOut2D", { ...POP_FIELDS });

/**
 * Completion pulses emitted by AnimationSystem the frame an animation reaches
 * its end (i.e. ran to completion, not cancelled — a component removed early
 * emits nothing). They live for a single frame and are swept the next update,
 * so consumers must react via a query subscription. This replaces timer/delay
 * waits and the fragile "watch the animation component disappear" pattern, and
 * lets animations be chained (e.g. a part pops in, then its placard pops in).
 */
export const PopInDone = createComponent("PopInDone", {});
export const PopOutDone = createComponent("PopOutDone", {});
export const PopOut2DDone = createComponent("PopOut2DDone", {});
export const SnapDone = createComponent("SnapDone", {});

export const Spin = createComponent("Spin", {});

export const SnapAnimation = createComponent("SnapAnimation", {
  targetX: { type: Types.Float32, default: 0 },
  targetY: { type: Types.Float32, default: 0 },
  targetZ: { type: Types.Float32, default: 0 },
  targetQX: { type: Types.Float32, default: 0 },
  targetQY: { type: Types.Float32, default: 0 },
  targetQZ: { type: Types.Float32, default: 0 },
  targetQW: { type: Types.Float32, default: 1 },
  duration: { type: Types.Float32, default: 300 },
  elapsed: { type: Types.Float32, default: 0 },
  started: { type: Types.Boolean, default: false },
  fromX: { type: Types.Float32, default: 0 },
  fromY: { type: Types.Float32, default: 0 },
  fromZ: { type: Types.Float32, default: 0 },
  fromQX: { type: Types.Float32, default: 0 },
  fromQY: { type: Types.Float32, default: 0 },
  fromQZ: { type: Types.Float32, default: 0 },
  fromQW: { type: Types.Float32, default: 1 },
});
