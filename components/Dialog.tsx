import React, { useEffect, useRef } from 'react';
export const Dialog: React.FC<{ open: boolean; title: string; onClose: () => void; children: React.ReactNode }> = ({ open, title, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} className="reader-dialog bg-spartan-gray text-white rounded-2xl border border-gray-700 p-0 shadow-2xl">
    <section className="p-4 sm:p-6 space-y-5"><header className="flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{title}</h2><button type="button" autoFocus onClick={onClose} aria-label={`${title}を閉じる`} className="control px-3">閉じる</button></header>{children}</section>
  </dialog>;
};
