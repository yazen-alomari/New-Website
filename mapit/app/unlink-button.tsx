"use client";
import { useEffect, useState } from "react";
import { Unlink } from "lucide-react";

export function UnlinkButton({ itemName, stageName, busy, unlink }: { itemName: string; stageName: string; busy: boolean; unlink: () => Promise<boolean> }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const timer = setTimeout(() => setArmed(false), 6000); return () => clearTimeout(timer); }, [armed]);
  return <button type="button" className={`button small unlink-button${armed ? " is-armed" : ""}`} disabled={busy}
    aria-label={armed ? `Sure? Unlink ${itemName} from ${stageName}` : `Unlink ${itemName} from ${stageName}`} aria-pressed={armed}
    title="Remove this checkpoint link only. Inventory and stock are kept."
    onBlur={() => setArmed(false)} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setArmed(false); } }}
    onClick={async () => { if (!armed) { setArmed(true); return; } setArmed(false); await unlink(); }}><Unlink size={15}/>{armed ? "Sure?" : "Unlink"}</button>;
}
