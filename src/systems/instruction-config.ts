import { TaskId } from "./task-config.js";

/** Match part name tag panel follow settings. */
export const INSTRUCTION_PANEL_FOLLOW_SPEED = 12;
export const INSTRUCTION_PANEL_FOLLOW_TOLERANCE = 0.05;

export interface InstructionSpec {
  panelConfig: string;
  maxWidth: number;
  anchor: "phonograph" | "part";
  partId?: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export const INSTRUCTION_BY_TASK: Record<string, InstructionSpec> = {
  [TaskId.AssemblyPhonographInfo]: {
    panelConfig: "./ui/instructions/read-more-instruction.json",
    maxWidth: 0.16,
    anchor: "phonograph",
    offsetX: 0.05,
    offsetY: 0.5,
    offsetZ: 0,
  },
  [TaskId.AssemblyCylinderMount]: {
    panelConfig: "./ui/instructions/pinch-instruction.json",
    maxWidth: 0.16,
    anchor: "part",
    partId: "cylinder",
    offsetX: 0,
    offsetY: -0.11,
    offsetZ: 0,
  },
};
