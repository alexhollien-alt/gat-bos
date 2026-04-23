// Signed-from helper for event invites.
// Source-of-truth spec: ~/.claude/plans/event-cycle-build.md Step 5 plan.
//
// Rules (from source-of-truth prompt + lender-partner scoping):
//   Christine events  -> "Christine McConnell & Alex Hollien"
//   Stephanie events  -> "Stephanie Reid & Alex Hollien"
//   Alex solo (85254) -> "Alex Hollien"  (lender_flag='none', no lender mention)

import type { EventOwnerName, LenderFlag } from "./types";

export interface SignatureBlock {
  sign_off: string; // e.g. "With warm regards,"
  names_line: string; // e.g. "Christine McConnell & Alex Hollien"
  roles_line: string; // e.g. "Christine McConnell, Nations Lending | Alex Hollien, Great American Title"
}

export function buildSignature(
  host_name: EventOwnerName,
  lender_flag: LenderFlag,
): SignatureBlock {
  if (lender_flag === "christine") {
    return {
      sign_off: "With warm regards,",
      names_line: "Christine McConnell & Alex Hollien",
      roles_line:
        "Christine McConnell, Nations Lending | Alex Hollien, Great American Title",
    };
  }

  if (lender_flag === "stephanie") {
    return {
      sign_off: "With warm regards,",
      names_line: "Stephanie Reid & Alex Hollien",
      roles_line:
        "Stephanie Reid, Gravity Home Loans | Alex Hollien, Great American Title",
    };
  }

  // lender_flag === 'none' (Alex solo, 85254 Home Tour)
  if (host_name !== "Alex Hollien") {
    throw new Error(
      `Invalid signature: lender_flag='none' requires host_name='Alex Hollien', got '${host_name}'`,
    );
  }

  return {
    sign_off: "With warm regards,",
    names_line: "Alex Hollien",
    roles_line: "Alex Hollien, Great American Title",
  };
}
