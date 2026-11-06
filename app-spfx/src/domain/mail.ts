/* Sending a transmittal. Pure: rules and message shape. No network here. */

export const UNDO_SECONDS = 60;
export type TransmittalStatus = 'Held' | 'Sent' | 'Cancelled' | 'Recorded';

/* A transmittal is held for the undo window before the email goes. Undo cancels; nothing is deleted. */
export function canUndo(heldAtIso: string, nowIso: string, seconds = UNDO_SECONDS): boolean {
  const elapsed = (Date.parse(nowIso) - Date.parse(heldAtIso)) / 1000;
  return elapsed >= 0 && elapsed < seconds;
}

export function secondsLeft(heldAtIso: string, nowIso: string, seconds = UNDO_SECONDS): number {
  return Math.max(0, Math.ceil(seconds - (Date.parse(nowIso) - Date.parse(heldAtIso)) / 1000));
}

export function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim());
}

/* The message as Microsoft Graph expects it. Sent from the signed-in person's own mailbox. */
export function graphMessage(p: { to: string; subject: string; body: string; attachments: Array<{ name: string; contentType: string; base64: string }> }) {
  return {
    message: {
      subject: p.subject,
      body: { contentType: 'Text', content: p.body },
      toRecipients: [{ emailAddress: { address: p.to.trim() } }],
      attachments: p.attachments.map(a => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.name, contentType: a.contentType, contentBytes: a.base64 })),
    },
    saveToSentItems: true,
  };
}
