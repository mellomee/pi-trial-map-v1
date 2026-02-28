/**
 * Returns the display number for a joint exhibit.
 * If admitted, shows "Admitted Ex. {admitted_no}", else "Marked Ex. {marked_no}".
 * NEVER hardcode numbers in annotations — always call this.
 */
export function exhibitDisplayNo(joint) {
  if (!joint) return "—";
  if (joint.admitted_no && joint.status === "Admitted") {
    return `Admitted Ex. ${joint.admitted_no}`;
  }
  return `Marked Ex. ${joint.marked_no}`;
}

/**
 * Short label for compact display e.g. in dropdowns.
 */
export function exhibitShortLabel(joint) {
  if (!joint) return "—";
  if (joint.admitted_no && joint.status === "Admitted") {
    return `AX-${joint.admitted_no}`;
  }
  return `MX-${joint.marked_no}`;
}

/**
 * Badge color class for exhibit status.
 */
export function exhibitStatusColor(status) {
  switch (status) {
    case "Admitted": return "bg-green-500/20 text-green-400 border-green-600/30";
    case "Offered": return "bg-blue-500/20 text-blue-400 border-blue-600/30";
    case "Excluded": return "bg-red-500/20 text-red-400 border-red-600/30";
    case "Withdrawn": return "bg-slate-500/20 text-slate-500 border-slate-600/30";
    case "Marked": return "bg-amber-500/20 text-amber-400 border-amber-600/30";
    default: return "bg-slate-600/20 text-slate-500 border-slate-700/30";
  }
}