import { createComponent, Types } from "@iwsdk/core";

export const Task = createComponent("Task", {
  id: { type: Types.String, default: "introduction_welcome" },
});
export const ActiveTask = createComponent("ActiveTask", {});
export const CompletedTask = createComponent("CompletedTask", {});
