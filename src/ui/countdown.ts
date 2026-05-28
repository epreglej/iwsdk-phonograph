export type CountdownSequenceOptions = {
  steps: string[];
  stepMs: number;
  isCancelled: () => boolean;
  onStep: (text: string, index: number) => void;
  onComplete: () => void;
};

export function runCountdownSequence(
  options: CountdownSequenceOptions,
): ReturnType<typeof setTimeout>[] {
  const timers: ReturnType<typeof setTimeout>[] = [];

  options.steps.forEach((text, index) => {
    timers.push(
      setTimeout(() => {
        if (options.isCancelled()) return;
        options.onStep(text, index);
      }, index * options.stepMs),
    );
  });

  timers.push(
    setTimeout(() => {
      if (options.isCancelled()) return;
      options.onComplete();
    }, options.steps.length * options.stepMs),
  );

  return timers;
}

export function clearCountdownTimers(
  timers: ReturnType<typeof setTimeout>[],
): void {
  for (const timer of timers) clearTimeout(timer);
}
