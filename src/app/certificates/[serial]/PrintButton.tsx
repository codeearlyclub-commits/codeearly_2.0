"use client";

/**
 * The only client-side JavaScript on the certificate page.
 *
 * The print stylesheet does the real work; this is a convenience so a parent does
 * not have to know Ctrl+P. The page prints correctly without it.
 */
export function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
