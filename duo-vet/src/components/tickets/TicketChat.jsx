import React, { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Paperclip, Send, UploadCloud, X, MessageSquareText, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import AttachmentPreview from './AttachmentPreview';
import { StatusBadge, PriorityBadge } from './StatusBadge';

const QUICK_REPLIES = [
  'Recebemos seu chamado e já estamos analisando.',
  'Pode compartilhar um print da tela para avançarmos?',
  'Aplicamos um ajuste, consegue validar novamente?',
  'Obrigado pelo retorno. Seguimos acompanhando.'
];

const toDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function relativeDate(value) {
  if (!value) return 'agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'agora';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export default function TicketChat({
  ticket,
  isAdmin,
  sending,
  onSendMessage,
  onCloseTicket,
  onDeleteTicket
}) {
  const [message, setMessage] = useState('');
  const [quickReply, setQuickReply] = useState('');
  const [attachments, setAttachments] = useState([]);

  const thread = useMemo(() => {
    if (!ticket?.messages) return [];
    return Array.isArray(ticket.messages) ? ticket.messages : [];
  }, [ticket?.messages]);

  const attachFiles = async (files) => {
    const incoming = Array.from(files || []);
    if (incoming.length === 0) return;
    const next = [];
    for (const file of incoming.slice(0, 6)) {
      const url = await toDataUrl(file);
      next.push({
        name: file.name,
        size: file.size,
        type: file.type,
        url
      });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 8));
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    await attachFiles(event.dataTransfer.files);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    await onSendMessage({
      text,
      quickReply: quickReply || undefined,
      attachments
    });
    setMessage('');
    setQuickReply('');
    setAttachments([]);
  };

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center">
        <MessageSquareText className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-secondary)]">Selecione um ticket para visualizar a conversa.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col min-h-[560px]">
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-[var(--text-muted)]">{ticket.ticket_code || `#${ticket.id}`}</p>
            <h3 className="font-semibold text-[var(--text-primary)]">{ticket.subject}</h3>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{ticket.description}</p>
      </div>

      <ScrollArea className="h-[360px]">
        <div className="p-4 space-y-4">
          {thread.map((item, index) => {
            const mine = isAdmin ? item.sender === 'admin' : item.sender === 'user';
            return (
              <div key={item.id || `${item.timestamp}-${index}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 border ${
                  mine
                    ? 'bg-[var(--accent)]/15 border-[var(--accent)]/20'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                }`}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{item.senderName || (item.sender === 'admin' ? 'Admin' : 'Usuário')}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{relativeDate(item.timestamp)}</p>
                  </div>
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{item.text}</p>
                  <AttachmentPreview attachments={item.attachments} />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <form
        onSubmit={handleSubmit}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="p-4 border-t border-[var(--border-color)] space-y-3"
      >
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="rounded-xl">
                  QuickReply
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-w-xs">
                {QUICK_REPLIES.map((reply) => (
                  <DropdownMenuItem
                    key={reply}
                    onClick={() => {
                      setQuickReply(reply);
                      setMessage(reply);
                    }}
                  >
                    {reply}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {quickReply ? <p className="text-xs text-[var(--text-muted)] truncate">{quickReply}</p> : null}
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((item, index) => (
              <div key={`${item.name}-${index}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]">
                <span className="max-w-[160px] truncate">{item.name}</span>
                <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== index))}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Digite sua mensagem. Você pode arrastar arquivos para anexar."
          className="min-h-[90px] bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={async (event) => {
                  await attachFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <Button type="button" variant="outline" asChild className="rounded-xl">
                <span>
                  <Paperclip className="w-4 h-4 mr-2" />
                  Anexar
                </span>
              </Button>
            </label>
            <span className="text-xs text-[var(--text-muted)] inline-flex items-center">
              <UploadCloud className="w-3 h-3 mr-1" />
              Drag-and-drop ativo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onCloseTicket(ticket.id)} className="rounded-xl">
              Encerrar
            </Button>
            <Button type="button" variant="outline" onClick={() => onDeleteTicket(ticket.id)} className="rounded-xl">
              Excluir
            </Button>
            <Button type="submit" disabled={sending || !message.trim()} className="rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white">
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
