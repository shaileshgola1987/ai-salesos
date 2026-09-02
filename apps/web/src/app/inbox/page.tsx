"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  ConversationDto,
  LeadDto,
  MessageDto,
  MessageTemplateDto,
} from "@ai-salesos/shared";
import { apiFetch, apiFetchBlob, ApiError } from "@/lib/api";
import { getWhatsAppSocket } from "@/lib/socket";
import { AppShell } from "@/components/AppShell";

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const MEDIA_TYPE_OPTIONS = ["IMAGE", "DOCUMENT", "AUDIO", "VIDEO"] as const;

function isSessionOpen(conversation: ConversationDto): boolean {
  if (!conversation.lastInboundMessageAt) return false;
  return Date.now() - new Date(conversation.lastInboundMessageAt).getTime() < SESSION_WINDOW_MS;
}

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversationId");

  const [conversations, setConversations] = useState<ConversationDto[] | null>(null);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [templates, setTemplates] = useState<MessageTemplateDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch<ConversationDto[]>("/conversations");
      setConversations(data);
      setSelectedId((current) => current ?? requestedConversationId ?? data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversations");
    }
  }, [requestedConversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial inbox fetch
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void Promise.all([
      apiFetch<LeadDto[]>("/leads").then(setLeads),
      apiFetch<MessageTemplateDto[]>("/message-templates").then(setTemplates),
    ]).catch(() => undefined);
  }, []);

  // Live conversation-list updates (new threads, reordering on new messages, session-window
  // state) so the Inbox reflects inbound WhatsApp webhook traffic without a manual reload.
  useEffect(() => {
    const socket = getWhatsAppSocket();
    if (!socket) return;

    function upsert(conversation: ConversationDto) {
      setConversations((prev) => {
        const list = prev ?? [];
        const withoutExisting = list.filter((c) => c.id !== conversation.id);
        return [conversation, ...withoutExisting].sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
        );
      });
    }

    socket.on("conversation.updated", upsert);
    return () => {
      socket.off("conversation.updated", upsert);
    };
  }, []);

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  return (
    <AppShell fullWidth>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Inbox</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Manage templates
          </Link>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {showNew ? "Cancel" : "New conversation"}
          </button>
        </div>
      </div>

      {showNew && (
        <NewConversationForm
          leads={leads}
          onCreated={(conversation) => {
            setShowNew(false);
            setSelectedId(conversation.id);
            void loadConversations();
          }}
        />
      )}

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-1 gap-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
          {!conversations && !error && (
            <p className="p-4 text-sm text-zinc-500">Loading…</p>
          )}
          {conversations?.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No conversations yet.</p>
          )}
          {conversations?.map((c) => {
            const lastMessage = c.messages?.[0];
            const title = c.lead?.name ?? c.customer?.name ?? c.phone;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`block w-full border-b border-zinc-100 px-4 py-3 text-left text-sm dark:border-zinc-900 ${
                  c.id === selectedId
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                }`}
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{title}</p>
                <p className="text-xs text-zinc-500">{c.phone}</p>
                {lastMessage && (
                  <p className="mt-1 truncate text-xs text-zinc-400">
                    {lastMessage.direction === "OUTBOUND" ? "You: " : ""}
                    {lastMessage.type !== "TEXT" ? `📎 ${lastMessage.type.toLowerCase()}` : lastMessage.body}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col">
          {selected ? (
            <ConversationThread conversation={selected} templates={templates} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-zinc-500">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function NewConversationForm({
  leads,
  onCreated,
}: {
  leads: LeadDto[];
  onCreated: (conversation: ConversationDto) => void;
}) {
  const [phone, setPhone] = useState("");
  const [leadId, setLeadId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const conversation = await apiFetch<ConversationDto>("/conversations", {
        method: "POST",
        body: JSON.stringify({ phone, leadId: leadId || undefined }),
      });
      onCreated(conversation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start conversation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Phone</span>
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="91XXXXXXXXXX"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Link to lead (optional)</span>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">None</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Starting…" : "Start"}
      </button>
    </form>
  );
}

function ConversationThread({
  conversation,
  templates,
}: {
  conversation: ConversationDto;
  templates: MessageTemplateDto[];
}) {
  const [messages, setMessages] = useState<MessageDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<(typeof MEDIA_TYPE_OPTIONS)[number]>("IMAGE");
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MessageDto[]>(`/conversations/${conversation.id}/messages`);
      setMessages(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load messages");
    }
  }, [conversation.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- conversation changed -> refetch thread
    void load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Live message updates for the open thread (new inbound/outbound messages, status changes).
  useEffect(() => {
    const socket = getWhatsAppSocket();
    if (!socket) return;

    function upsert(message: MessageDto) {
      if (message.conversationId !== conversation.id) return;
      setMessages((prev) => {
        const list = prev ?? [];
        const withoutExisting = list.filter((m) => m.id !== message.id);
        return [...withoutExisting, message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    }

    socket.on("message.created", upsert);
    socket.on("message.updated", upsert);
    return () => {
      socket.off("message.created", upsert);
      socket.off("message.updated", upsert);
    };
  }, [conversation.id]);

  const sessionOpen = isSessionOpen(conversation);
  const canSendFreeform = sessionOpen || !!templateName;

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !mediaUrl.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: body || undefined,
          templateName: templateName || undefined,
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaUrl ? mediaType : undefined,
        }),
      });
      setBody("");
      setMediaUrl("");
      setShowAttach(false);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function onSimulateReply() {
    const text = prompt("Simulated reply text (dev/testing only):");
    if (!text) return;
    try {
      await apiFetch(`/conversations/${conversation.id}/simulate-inbound`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to simulate reply");
    }
  }

  function applyTemplate(name: string) {
    setTemplateName(name);
    const template = templates.find((t) => t.name === name);
    if (template) setBody(template.body);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {conversation.lead?.name ?? conversation.customer?.name ?? conversation.phone}
          </p>
          <p className="text-xs text-zinc-500">{conversation.phone}</p>
        </div>
        {conversation.lead && (
          <Link
            href={`/leads/${conversation.lead.id}`}
            className="text-xs text-zinc-500 hover:underline"
          >
            View lead →
          </Link>
        )}
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {!messages && !error && <p className="text-sm text-zinc-500">Loading…</p>}
        {messages?.map((m) => (
          <div
            key={m.id}
            className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
              m.direction === "OUTBOUND"
                ? "self-end bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            }`}
          >
            {m.type !== "TEXT" && <MediaContent message={m} />}
            {m.body && <p className={m.type !== "TEXT" ? "mt-2" : ""}>{m.body}</p>}
            <p
              className={`mt-1 text-[10px] ${
                m.direction === "OUTBOUND" ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"
              }`}
            >
              {new Date(m.createdAt).toLocaleString()}
              {m.sentBy && ` · ${m.sentBy.name}`}
              {m.direction === "OUTBOUND" && ` · ${m.status.toLowerCase()}`}
            </p>
          </div>
        ))}
      </div>

      {error && <p className="px-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!sessionOpen && (
        <p className="mx-4 mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          This conversation&apos;s 24-hour customer session window is closed — pick a template
          below to reopen it. (Send a &ldquo;Simulate reply&rdquo; to reopen it in dev.)
        </p>
      )}

      <form onSubmit={onSend} className="flex flex-col gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={templateName}
            onChange={(e) => applyTemplate(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAttach((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            {showAttach ? "Remove attachment" : "Attach media"}
          </button>
          <button
            type="button"
            onClick={onSimulateReply}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Simulate reply (dev)
          </button>
        </div>

        {showAttach && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as (typeof MEDIA_TYPE_OPTIONS)[number])}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              {MEDIA_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://… (publicly reachable file URL)"
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              canSendFreeform ? "Type a message…" : "Select a template to reopen this conversation"
            }
            disabled={!canSendFreeform}
            rows={2}
            className="flex-1 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={sending || !canSendFreeform}
            className="rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

/** Renders an inbound/outbound media message. Provider-hosted media (no direct mediaUrl) is
 * fetched as an authenticated blob via /whatsapp/media/:messageId — see MediaController. */
function MediaContent({ message }: { message: MessageDto }) {
  const [src, setSrc] = useState<string | null>(message.mediaUrl ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (message.mediaUrl || !message.mediaProviderId) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    void apiFetchBlob(`/whatsapp/media/${message.id}`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.id, message.mediaUrl, message.mediaProviderId]);

  if (failed) {
    return <p className="text-xs italic text-red-400">Failed to load attachment</p>;
  }
  if (!src) {
    return <p className="text-xs italic text-zinc-400">Loading attachment…</p>;
  }

  if (message.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element -- blob/remote URLs, not a static asset next/image can optimize
    return <img src={src} alt="" className="max-w-full rounded-lg" />;
  }
  if (message.type === "VIDEO") {
    return <video src={src} controls className="max-w-full rounded-lg" />;
  }
  if (message.type === "AUDIO") {
    return <audio src={src} controls />;
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-medium underline underline-offset-2"
    >
      📎 {message.mediaMimeType ?? "Document"}
    </a>
  );
}
