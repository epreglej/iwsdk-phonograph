let gateOpen = false;

export function openInteractionGate(): void {
  gateOpen = true;
}

export function closeInteractionGate(): void {
  gateOpen = false;
}

export function isInteractionGateOpen(): boolean {
  return gateOpen;
}
