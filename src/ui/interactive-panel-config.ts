export type InteractivePanelCopy = {
  title: string;
  body: string;
};

export const INTERACTIVE_PANEL_BY_TASK: Record<string, InteractivePanelCopy> = {
  recording_setup_info: {
    title: "Recording setup",
    body: "First we need to assemble the phonograph for recording.",
  },
  recording_ready_info: {
    title: "Ready to record",
    body: "The phonograph is now ready to record. Get ready to talk into the horn, then press Continue to start the countdown.",
  },
  playback_setup_info: {
    title: "Playback setup",
    body: "To playback our recording we need to remove the recording parts and assemble the playback parts.",
  },
  playback_ready_info: {
    title: "Playback ready",
    body: "Phonograph is ready to play your recording.",
  },
};

export const INTERACTIVE_PANEL_TASK_IDS = Object.keys(
  INTERACTIVE_PANEL_BY_TASK,
);
