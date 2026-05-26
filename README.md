# Phonograph (IWSDK 0.4.1)

Simplified AR phonograph experience: a short intro welcomes the user, then mount parts, record, and play back audio. Instruction panels float above the phonograph during each step—no historic description panels.

## Run

```bash
npm install
npm run dev
```

Open `https://localhost:8081` and enter AR.

## Stack

- `@iwsdk/core` 0.4.1 — built-in `Grabbed` tag from `GrabSystem` (no custom grab sync)
- Custom tween-free `AnimationSystem` in `src/animations/animation.ts`
- Task flow: intro (`introduction_welcome` → `introduction_content` → `introduction_interaction`) then phonograph steps (see `src/task.ts`)
