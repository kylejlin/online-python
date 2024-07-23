import type { PyodideInterface } from "pyodide";

export const loadPyodide: (options?: {
  indexURL?: string;
  packageCacheDir?: string;
  lockFileURL?: string;
  fullStdLib?: boolean;
  stdLibURL?: string;
  stdin?: () => string;
  stdout?: (msg: string) => void;
  stderr?: (msg: string) => void;
  jsglobals?: object;
  args?: string[];
  env?: {
    [key: string]: string;
  };
  packages?: string[];
  pyproxyToStringRepr?: boolean;
  enableRunUntilComplete?: boolean;
  _node_mounts?: string[];
  _makeSnapshot?: boolean;
  _loadSnapshot?:
    | Uint8Array
    | ArrayBuffer
    | PromiseLike<Uint8Array | ArrayBuffer>;
}) => Promise<PyodideInterface> = (window as any).loadPyodide;

export const pyodideProm = loadPyodide();

export type { PyodideInterface };
