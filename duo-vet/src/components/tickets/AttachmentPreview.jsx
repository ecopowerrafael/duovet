import React from 'react';
import { FileImage, FileText, File } from 'lucide-react';

function isImage(type, url) {
  return String(type || '').startsWith('image/') || String(url || '').startsWith('data:image/');
}

export default function AttachmentPreview({ attachments = [] }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {attachments.map((attachment, index) => {
        const key = `${attachment.name || 'anexo'}-${index}`;
        const image = isImage(attachment.type, attachment.url);
        return (
          <a
            key={key}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 hover:bg-[var(--bg-card)] transition-colors"
          >
            {image ? (
              <img src={attachment.url} alt={attachment.name || 'Anexo'} className="h-20 w-full rounded-lg object-cover mb-2" />
            ) : (
              <div className="h-20 w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center mb-2">
                {String(attachment.type || '').includes('pdf') ? (
                  <FileText className="w-7 h-7 text-[var(--text-muted)]" />
                ) : String(attachment.type || '').includes('text') ? (
                  <FileText className="w-7 h-7 text-[var(--text-muted)]" />
                ) : String(attachment.type || '').includes('image') ? (
                  <FileImage className="w-7 h-7 text-[var(--text-muted)]" />
                ) : (
                  <File className="w-7 h-7 text-[var(--text-muted)]" />
                )}
              </div>
            )}
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{attachment.name || 'Anexo'}</p>
          </a>
        );
      })}
    </div>
  );
}
