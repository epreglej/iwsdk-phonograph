import { UIKit, UIKitDocument } from "@iwsdk/core";

export function setPanelElementText(
  doc: UIKitDocument | null,
  elementId: string,
  text: string,
): boolean {
  if (!doc) return false;

  const el = doc.getElementById(elementId) as UIKit.Component | undefined;
  if (!el) return false;

  (el as { setProperties?: (props: { text: string }) => void }).setProperties?.({
    text,
  });
  return true;
}
