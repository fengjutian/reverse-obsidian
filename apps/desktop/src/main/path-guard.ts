import { resolve, sep } from "node:path";

/**
 * Security middleware that prevents path traversal attacks on IPC file operations.
 * Ensures all requested paths resolve to within the active Vault's notes directory.
 */

export interface IpcError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Asserts that `requestedPath` resolves to a location within `vaultPath`.
 * Throws a structured IPC error if the path escapes the vault boundary.
 *
 * @throws `{ code: "E_VAULT_PATH_TRAVERSAL", message, details }` on violation
 */
export function assertWithinVault(vaultPath: string, requestedPath: string): void {
  if (!vaultPath || !requestedPath) {
    throw {
      code: "E_VAULT_PATH_TRAVERSAL",
      message: "Path must not be empty",
      details: { requested: requestedPath, vaultPath }
    } satisfies IpcError;
  }

  const resolvedVault = resolve(vaultPath);
  const resolvedRequest = resolve(vaultPath, requestedPath);

  const isWithin =
    resolvedRequest === resolvedVault ||
    resolvedRequest.startsWith(resolvedVault + sep);

  if (!isWithin) {
    throw {
      code: "E_VAULT_PATH_TRAVERSAL",
      message: "Requested path is outside the vault directory",
      details: { requested: resolvedRequest, vaultPath: resolvedVault }
    } satisfies IpcError;
  }
}
