"use client";

import { useEffect, useRef, useState } from "react";

interface Bericht {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  bedrijf: "bb" | "sl";
  hex: string;
  naam: string;
}

const SUGGESTIES = [
  "Wat was de omzet op Koningsdag 2024?",
  "Welke dag was het allerdrukste?",
  "Hoe doen we het jaar-op-jaar?",
  "Welk product verkoopt het beste?",
];

export default function ChatBot({ bedrijf, hex, naam }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Bericht[]>([]);
  const [input, setInput] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, bezig]);

  async function vraag(vraagTekst: string) {
    const schoon = vraagTekst.trim();
    if (!schoon || bezig) return;
    setFout(null);
    const nieuweMessages: Bericht[] = [
      ...messages,
      { role: "user", content: schoon },
    ];
    setMessages(nieuweMessages);
    setInput("");
    setBezig(true);

    try {
      const res = await fetch(`/api/chat/${bedrijf}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nieuweMessages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Onbekende fout");
      setMessages([
        ...nieuweMessages,
        { role: "assistant", content: json.antwoord ?? "(leeg antwoord)" },
      ]);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setBezig(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    vraag(input);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full shadow-card hover:shadow-lg transition-shadow flex items-center gap-2 px-4 py-3 bg-white border border-slate-200"
        style={{ borderColor: `${hex}55` }}
        aria-label="Open AI assistent"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: hex }}
        >
          AI
        </span>
        <span className="text-sm font-medium text-slate-800 hidden sm:inline">
          Vraag iets over {naam}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-[400px] max-h-[calc(100vh-2.5rem)] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-200"
        style={{ backgroundColor: `${hex}10` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: hex }}
          >
            AI
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              Assistent · {naam}
            </p>
            <p className="text-[10px] text-slate-500">
              Vraag iets over je data
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
          aria-label="Sluiten"
        >
          ×
        </button>
      </div>

      {/* Berichten */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[240px] max-h-[50vh]"
      >
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 px-1">
              Probeer bijvoorbeeld:
            </p>
            {SUGGESTIES.map((s) => (
              <button
                key={s}
                onClick={() => vraag(s)}
                className="block w-full text-left text-sm text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                m.role === "user"
                  ? "text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
              style={
                m.role === "user"
                  ? { backgroundColor: hex }
                  : undefined
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {bezig && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-500 text-sm rounded-2xl px-3 py-2 flex gap-1">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse" style={{ animationDelay: "0.15s" }}>●</span>
              <span className="animate-pulse" style={{ animationDelay: "0.3s" }}>●</span>
            </div>
          </div>
        )}
        {fout && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {fout}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="border-t border-slate-200 p-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Typ je vraag…"
          disabled={bezig}
          className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={bezig || !input.trim()}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: hex }}
        >
          →
        </button>
      </form>
    </div>
  );
}
