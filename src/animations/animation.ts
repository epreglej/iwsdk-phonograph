import {
  createComponent,
  createSystem,
  PanelDocument,
  Quaternion,
  Types,
  UIKit,
  UIKitDocument,
  Vector3,
} from "@iwsdk/core";

export const PopIn = createComponent("PopIn", {});
export const PopIn2D = createComponent("PopIn2D", {});
export const PopOut = createComponent("PopOut", {});
export const PopOut2D = createComponent("PopOut2D", {});
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
});

type EasingFn = (t: number) => number;

const Easing = {
  Linear: {
    None: (t: number) => t,
  },
  Cubic: {
    In: (t: number) => t * t * t,
    Out: (t: number) => 1 - (1 - t) ** 3,
  },
  Back: {
    Out: (t: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    },
  },
} as const;

type NumericProps = Record<string, number>;

interface ActiveTween {
  from: NumericProps;
  to: NumericProps;
  values: NumericProps;
  durationMs: number;
  elapsedMs: number;
  easing: EasingFn;
  repeat: boolean;
  stopped: boolean;
  onUpdate: (values: NumericProps) => void;
  onComplete?: () => void;
}

function lerpProps(
  from: NumericProps,
  to: NumericProps,
  t: number,
  out: NumericProps,
) {
  for (const key of Object.keys(from)) {
    out[key] = from[key] + (to[key] - from[key]) * t;
  }
}

function startTween(
  tweens: ActiveTween[],
  from: NumericProps,
  to: NumericProps,
  durationMs: number,
  easing: EasingFn,
  onUpdate: (values: NumericProps) => void,
  options?: { onComplete?: () => void; repeat?: boolean },
): ActiveTween {
  const tween: ActiveTween = {
    from: { ...from },
    to: { ...to },
    values: { ...from },
    durationMs,
    elapsedMs: 0,
    easing,
    repeat: options?.repeat ?? false,
    stopped: false,
    onUpdate,
    onComplete: options?.onComplete,
  };
  tweens.push(tween);
  return tween;
}

function stopTween(tween: ActiveTween) {
  tween.stopped = true;
}

export class AnimationSystem extends createSystem({
  popIn: { required: [PopIn] },
  popIn2D: { required: [PopIn2D] },
  popOut: { required: [PopOut] },
  popOut2D: { required: [PopOut2D] },
  spin: { required: [Spin] },
  snapAnimation: { required: [SnapAnimation] },
}) {
  private tweens: ActiveTween[] = [];
  private spinTweens = new Map<number, ActiveTween>();

  init() {
    this.queries.popIn.subscribe("qualify", (entity) => {
      const obj = entity.object3D!;
      startTween(
        this.tweens,
        { scale: 0.001 },
        { scale: 1 },
        700,
        Easing.Cubic.Out,
        ({ scale }) => {
          if (entity.active) obj.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (entity.active) entity.removeComponent(PopIn);
          },
        },
      );
    });

    this.queries.popOut.subscribe("qualify", (entity) => {
      const obj = entity.object3D!;
      startTween(
        this.tweens,
        { scale: 1 },
        { scale: 0.001 },
        550,
        Easing.Cubic.In,
        ({ scale }) => {
          if (entity.active) obj.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (entity.active) entity.removeComponent(PopOut);
          },
        },
      );
    });

    this.queries.popIn2D.subscribe("qualify", (entity) => {
      const document = entity.getValue(
        PanelDocument,
        "document",
      ) as UIKitDocument;
      if (!document) return;
      const rootElement = document.getElementById(
        "panel-root",
      ) as UIKit.Component;
      if (!rootElement) return;
      startTween(
        this.tweens,
        { scale: 0.001 },
        { scale: 1 },
        700,
        Easing.Cubic.Out,
        ({ scale }) => {
          if (entity.active) rootElement.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (entity.active) entity.removeComponent(PopIn2D);
          },
        },
      );
    });

    this.queries.popOut2D.subscribe("qualify", (entity) => {
      const document = entity.getValue(
        PanelDocument,
        "document",
      ) as UIKitDocument;
      if (!document) return;
      const rootElement = document.getElementById(
        "panel-root",
      ) as UIKit.Component;
      if (!rootElement) return;
      startTween(
        this.tweens,
        { scale: 1 },
        { scale: 0.001 },
        550,
        Easing.Cubic.In,
        ({ scale }) => {
          if (entity.active) rootElement.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (entity.active) entity.removeComponent(PopOut2D);
          },
        },
      );
    });

    this.queries.snapAnimation.subscribe("qualify", (entity) => {
      const obj = entity.object3D!;
      const fromPos = obj.position.clone();
      const fromQuat = obj.quaternion.clone();
      const toPos = new Vector3(
        entity.getValue(SnapAnimation, "targetX")!,
        entity.getValue(SnapAnimation, "targetY")!,
        entity.getValue(SnapAnimation, "targetZ")!,
      );
      const toQuat = new Quaternion(
        entity.getValue(SnapAnimation, "targetQX")!,
        entity.getValue(SnapAnimation, "targetQY")!,
        entity.getValue(SnapAnimation, "targetQZ")!,
        entity.getValue(SnapAnimation, "targetQW")!,
      );
      startTween(
        this.tweens,
        { t: 0 },
        { t: 1 },
        entity.getValue(SnapAnimation, "duration")!,
        Easing.Back.Out,
        ({ t }) => {
          if (!entity.active) return;
          obj.position.lerpVectors(fromPos, toPos, t);
          obj.quaternion.slerpQuaternions(fromQuat, toQuat, t);
        },
        {
          onComplete: () => {
            if (!entity.active) return;
            obj.position.copy(toPos);
            obj.quaternion.copy(toQuat);
            entity.removeComponent(SnapAnimation);
          },
        },
      );
    });

    this.queries.spin.subscribe("qualify", (entity) => {
      const obj = entity.object3D!;
      const rotation = obj.rotation.x;

      const tween = startTween(
        this.tweens,
        { rotation },
        { rotation: rotation + Math.PI * 2 },
        1000,
        Easing.Linear.None,
        ({ rotation: r }) => {
          if (entity.active) obj.rotation.x = r;
        },
        { repeat: true },
      );

      this.spinTweens.set(entity.index, tween);
    });

    this.queries.spin.subscribe("disqualify", (entity) => {
      const tween = this.spinTweens.get(entity.index);
      if (tween) stopTween(tween);
      this.spinTweens.delete(entity.index);
    });
  }

  update(delta: number) {
    const dtMs = delta * 1000;

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tween = this.tweens[i];
      if (tween.stopped) {
        this.tweens.splice(i, 1);
        continue;
      }

      tween.elapsedMs += dtMs;
      const linearT = Math.min(tween.elapsedMs / tween.durationMs, 1);
      const easedT = tween.easing(linearT);
      lerpProps(tween.from, tween.to, easedT, tween.values);
      tween.onUpdate(tween.values);

      if (linearT < 1) continue;

      if (tween.repeat) {
        tween.elapsedMs = 0;
        continue;
      }

      tween.onComplete?.();
      this.tweens.splice(i, 1);
    }
  }
}
