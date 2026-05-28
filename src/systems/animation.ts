import {
  createSystem,
  PanelDocument,
  Quaternion,
  UIKit,
  UIKitDocument,
  Vector3,
} from "@iwsdk/core";
import {
  PopIn,
  PopIn2D,
  PopOut,
  PopOut2D,
  Spin,
  SnapAnimation,
} from "../components/animation.js";

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
  private pop3DTweens = new Map<number, ActiveTween>();
  private pop2DTweens = new Map<number, ActiveTween>();
  private snapTweens = new Map<number, ActiveTween>();

  private stopEntityTween(
    tweensByEntity: Map<number, ActiveTween>,
    entityIndex: number,
  ) {
    const tween = tweensByEntity.get(entityIndex);
    if (tween) {
      stopTween(tween);
      tweensByEntity.delete(entityIndex);
    }
  }

  init() {
    this.queries.popIn.subscribe("qualify", (entity) => {
      const obj = entity.object3D!;
      if (entity.hasComponent(PopOut)) {
        entity.removeComponent(PopOut);
      }
      this.stopEntityTween(this.pop3DTweens, entity.index);

      const fromScale = obj.scale.x;
      const tween = startTween(
        this.tweens,
        { scale: fromScale },
        { scale: 1 },
        700,
        Easing.Cubic.Out,
        ({ scale }) => {
          if (entity.active) obj.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (!entity.active) return;
            if (this.pop3DTweens.get(entity.index) !== tween) return;
            this.pop3DTweens.delete(entity.index);
            entity.removeComponent(PopIn);
          },
        },
      );
      this.pop3DTweens.set(entity.index, tween);
    });

    this.queries.popOut.subscribe("qualify", (entity) => {
      const obj = entity.object3D!;
      if (entity.hasComponent(PopIn)) {
        entity.removeComponent(PopIn);
      }
      this.stopEntityTween(this.pop3DTweens, entity.index);

      const fromScale = obj.scale.x;
      const tween = startTween(
        this.tweens,
        { scale: fromScale },
        { scale: 0.001 },
        550,
        Easing.Cubic.In,
        ({ scale }) => {
          if (entity.active) obj.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (!entity.active) return;
            if (this.pop3DTweens.get(entity.index) !== tween) return;
            this.pop3DTweens.delete(entity.index);
            entity.removeComponent(PopOut);
          },
        },
      );
      this.pop3DTweens.set(entity.index, tween);
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
      if (entity.hasComponent(PopOut2D)) {
        entity.removeComponent(PopOut2D);
      }
      this.stopEntityTween(this.pop2DTweens, entity.index);

      const fromScale = rootElement.scale.x;
      const tween = startTween(
        this.tweens,
        { scale: fromScale },
        { scale: 1 },
        700,
        Easing.Cubic.Out,
        ({ scale }) => {
          if (entity.active) rootElement.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (!entity.active) return;
            if (this.pop2DTweens.get(entity.index) !== tween) return;
            this.pop2DTweens.delete(entity.index);
            entity.removeComponent(PopIn2D);
          },
        },
      );
      this.pop2DTweens.set(entity.index, tween);
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
      if (entity.hasComponent(PopIn2D)) {
        entity.removeComponent(PopIn2D);
      }
      this.stopEntityTween(this.pop2DTweens, entity.index);

      const fromScale = rootElement.scale.x;
      const tween = startTween(
        this.tweens,
        { scale: fromScale },
        { scale: 0.001 },
        550,
        Easing.Cubic.In,
        ({ scale }) => {
          if (entity.active) rootElement.scale.setScalar(scale);
        },
        {
          onComplete: () => {
            if (!entity.active) return;
            if (this.pop2DTweens.get(entity.index) !== tween) return;
            this.pop2DTweens.delete(entity.index);
            entity.removeComponent(PopOut2D);
          },
        },
      );
      this.pop2DTweens.set(entity.index, tween);
    });

    this.queries.snapAnimation.subscribe("qualify", (entity) => {
      const obj = entity.object3D!;
      this.stopEntityTween(this.snapTweens, entity.index);
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
      const tween = startTween(
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
            if (this.snapTweens.get(entity.index) !== tween) return;
            this.snapTweens.delete(entity.index);
            obj.position.copy(toPos);
            obj.quaternion.copy(toQuat);
            entity.removeComponent(SnapAnimation);
          },
        },
      );
      this.snapTweens.set(entity.index, tween);
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

    this.queries.popIn.subscribe("disqualify", (entity) => {
      this.stopEntityTween(this.pop3DTweens, entity.index);
    });
    this.queries.popOut.subscribe("disqualify", (entity) => {
      this.stopEntityTween(this.pop3DTweens, entity.index);
    });
    this.queries.popIn2D.subscribe("disqualify", (entity) => {
      this.stopEntityTween(this.pop2DTweens, entity.index);
    });
    this.queries.popOut2D.subscribe("disqualify", (entity) => {
      this.stopEntityTween(this.pop2DTweens, entity.index);
    });
    this.queries.snapAnimation.subscribe("disqualify", (entity) => {
      this.stopEntityTween(this.snapTweens, entity.index);
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
