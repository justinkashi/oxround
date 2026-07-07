"use client";
// Staff messaging (Step 6F / D-23): reply to members 1:1 + broadcast to all. Community = announcements page.

import { useEffect, useMemo, useState } from "react";
import { listMembers, staffListMessages, staffSendMessage } from "@/lib/data";
import type { GymMember, Message } from "@/lib/types";
import { useFormat, useT } from "@/lib/i18n";

export default function MessagesPage() {
  const t = useT();
  const fmt = useFormat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [broadcast, setBroadcast] = useState("");

  const load = async () => {
    const [msgs, mems] = await Promise.all([staffListMessages(), listMembers()]);
    setMessages(msgs);
    setMembers(mems.filter((m) => m.roles.includes("member")));
  };
  useEffect(() => { load(); }, []);

  const name = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? `${m.first_name} ${m.last_name ?? ""}`.trim() : t.messages.memberFallback;
  };

  // Conversation partner = the member on the non-broadcast message.
  const conversations = useMemo(() => {
    const byMember: Record<string, Message[]> = {};
    for (const m of messages) {
      if (m.is_broadcast) continue;
      const partner = m.recipient_member_id ?? m.sender_member_id;
      (byMember[partner] ??= []).push(m);
    }
    return byMember;
  }, [messages]);

  const thread = selected ? (conversations[selected] ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)) : [];
  const broadcasts = messages.filter((m) => m.is_broadcast);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    await staffSendMessage({ recipient_member_id: selected, body: reply.trim(), is_broadcast: false });
    setReply("");
    load();
  };
  const sendBroadcast = async () => {
    if (!broadcast.trim()) return;
    await staffSendMessage({ recipient_member_id: null, body: broadcast.trim(), is_broadcast: true });
    setBroadcast("");
    load();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t.messages.title}</h1>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase text-neutral-500">{t.messages.broadcastTitle}</h2>
        <div className="flex gap-2">
          <input value={broadcast} onChange={(e) => setBroadcast(e.target.value)} placeholder={t.messages.broadcastPlaceholder} className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <button onClick={sendBroadcast} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">{t.messages.sendToAll}</button>
        </div>
        {broadcasts.length > 0 && <div className="mt-2 text-xs text-neutral-400">{t.messages.lastBroadcast(broadcasts[0].body)}</div>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-4 py-2 text-xs font-semibold uppercase text-neutral-500">{t.messages.conversations}</div>
          {Object.keys(conversations).length === 0 && <div className="p-4 text-sm text-neutral-400">{t.messages.noMemberMessages}</div>}
          {Object.keys(conversations).map((id) => (
            <button key={id} onClick={() => setSelected(id)} className={`block w-full border-b border-neutral-100 px-4 py-2 text-left text-sm ${selected === id ? "bg-red-50 font-medium text-brand" : "hover:bg-neutral-50"}`}>
              {name(id)}
            </button>
          ))}
          <div className="border-t border-neutral-100 p-2">
            <select value="" onChange={(e) => e.target.value && setSelected(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">{t.messages.startMessage}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white md:col-span-2">
          {!selected ? (
            <div className="p-8 text-center text-sm text-neutral-400">{t.messages.pickConversation}</div>
          ) : (
            <div className="flex h-[26rem] flex-col">
              <div className="border-b border-neutral-100 px-4 py-2 font-medium">{name(selected)}</div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.map((m) => {
                  const fromMember = m.sender_member_id === selected;
                  return (
                    <div key={m.id} className={`flex ${fromMember ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${fromMember ? "bg-neutral-100" : "bg-brand text-white"}`}>
                        {m.body}
                        <div className={`mt-0.5 text-[10px] ${fromMember ? "text-neutral-400" : "text-white/70"}`}>{fmt.dateTime(m.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  );
                })}
                {thread.length === 0 && <div className="text-center text-sm text-neutral-400">{t.messages.noThread}</div>}
              </div>
              <div className="flex gap-2 border-t border-neutral-100 p-3">
                <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} placeholder={t.messages.replyPlaceholder} className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                <button onClick={sendReply} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">{t.messages.send}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
