export type ConsoleEntryKind = "input" | "output" | "error";

export interface ConsoleEntry {
  readonly kind: ConsoleEntryKind;
  readonly value: string;
}

export type ConsoleChangeListener = (
  oldEntries: readonly ConsoleEntry[],
  newEntries: readonly ConsoleEntry[]
) => void;

let globalConsoleEntries: readonly ConsoleEntry[] = [];
let changeListeners: readonly ConsoleChangeListener[] = [];

export function getGlobalConsoleEntries(): readonly ConsoleEntry[] {
  return globalConsoleEntries;
}

export function clearGlobalConsole(): void {
  const oldEntries = globalConsoleEntries;
  globalConsoleEntries = [];
  changeListeners.forEach((listener) =>
    listener(oldEntries, globalConsoleEntries)
  );
}

export function appendGlobalConsoleEntry(entry: ConsoleEntry): void {
  const oldEntries = globalConsoleEntries;
  const normalizedEntry = {
    kind: entry.kind,
    value: entry.value.endsWith("\n") ? entry.value.slice(0, -1) : entry.value,
  };
  globalConsoleEntries = globalConsoleEntries.concat([normalizedEntry]);
  changeListeners.forEach((listener) =>
    listener(oldEntries, globalConsoleEntries)
  );
}

export function addConsoleChangeListener(
  listener: ConsoleChangeListener
): void {
  changeListeners = changeListeners.concat([listener]);
}

export function removeConsoleChangeListener(
  listener: ConsoleChangeListener
): void {
  changeListeners = changeListeners.filter((l) => l !== listener);
}
