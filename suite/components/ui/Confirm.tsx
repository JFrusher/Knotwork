"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./controls";
import { Dialog } from "./Dialog";

/**
 * "Are you sure?", as a dialog that looks like the rest of the app.
 *
 * `window.confirm` was guarding the two most destructive things here — deleting
 * an account and replacing a wedding with the example — in the browser's own
 * grey box, with "OK" as the button that destroys things. This asks with the
 * action named on the button, and Cancel is where focus lands.
 *
 * Awaitable, so a caller reads as it did before: `if (!(await confirm(…))) return`.
 */

export interface ConfirmRequest {
  title: string;
  body: ReactNode;
  /** The button that goes ahead, named for what it does: "Delete my account". */
  action: string;
  tone?: "primary" | "danger";
}

export type Confirm = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // A ref, so the answer is given exactly once however the dialog is closed:
  // the button, Escape, the backdrop, and the close event that follows each.
  const answer = useRef<((yes: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(
    (next) =>
      new Promise<boolean>((resolve) => {
        answer.current?.(false);
        answer.current = resolve;
        setRequest(next);
      }),
    [],
  );

  const settle = (yes: boolean) => {
    answer.current?.(yes);
    answer.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={request !== null} onClose={() => settle(false)} labelledBy="confirm-title" width="max-w-md">
        {request ? (
          <div className="p-6">
            <h2 id="confirm-title" className="text-xl text-charcoal">
              {request.title}
            </h2>
            <div className="mt-2 space-y-2 text-sm text-slate">{request.body}</div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button onClick={() => settle(false)}>Cancel</Button>
              <Button tone={request.tone ?? "primary"} onClick={() => settle(true)}>
                {request.action}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** Throws outside the provider, which is a wiring mistake rather than a user-facing one. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
