/**
 * Client-side exports (§11). PNG uses html2canvas (lazy-loaded so it stays out of
 * the initial bundle); PDF uses the browser print path with print CSS. Nothing is
 * ever uploaded. Unmasked PII is included ONLY when the caller opts in per export.
 */
export async function captureElementToPng(el: HTMLElement, filename: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: false });
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      resolve();
    }, 'image/png');
  });
}

export function printDocument(): void {
  window.print();
}

/** Wait two animation frames so a state change (e.g. reveal PII) has painted. */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
