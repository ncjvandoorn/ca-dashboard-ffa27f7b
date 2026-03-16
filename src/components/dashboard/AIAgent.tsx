import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Loader2, X, Sparkles } from "lucide-react";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QualityReport, Account } from "@/lib/csvParser";

interface AIAgentProps {
  reports: QualityReport[];
  accounts: Account[];
}

type Msg = { role: "user" | "assistant"; content: string };

const SAMPLE_QUESTIONS = [
  "Which farms show consistently high pH at intake?",
  "Which farms show consistently high temperatures at export cold storage?",
  "Please create a table showing all farms and their average stem lengths",
  "Which farms have the highest variations in quality rating?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

function buildFarmDataContext(reports: QualityReport[], accounts: Account[]) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const byFarm = new Map<string, QualityReport[]>();

  for (const r of reports) {
    if (r.weekNr <= 0) continue;
    if (!byFarm.has(r.farmAccountId)) byFarm.set(r.farmAccountId, []);
    byFarm.get(r.farmAccountId)!.push(r);
  }

  const summaries: any[] = [];
  for (const [farmId, farmReports] of byFarm) {
    const sorted = [...farmReports].sort((a, b) => a.weekNr - b.weekNr);
    summaries.push({
      farmId,
      farmName: accountMap.get(farmId) || farmId,
      weeklyData: sorted.map((r) => ({
        week: r.weekNr,
        intakePh: r.qrIntakePh,
        intakeEc: r.qrIntakeEc,
        intakeTemp: r.qrIntakeTempColdstore,
        intakeHumidity: r.qrIntakeHumidityColdstore,
        exportPh: r.qrExportPh,
        exportEc: r.qrExportEc,
        exportTemp: r.qrExportTempColdstore,
        exportHumidity: r.qrExportHumidityColdstore,
        qualityRating: r.qrGenQualityRating,
        waterQuality: r.qrIntakeWaterQuality,
        processingSpeed: r.qrPackProcessingSpeed,
        stemLength: r.qrIntakeStemLength,
        headSize: r.qrIntakeHeadSize,
        coldStoreHours: r.qrIntakeColdstoreHours,
        qualityNote: r.qrGenQualityFlowers,
        protocolNote: r.qrGenProtocolChanges,
        generalComment: r.generalComment,
      })),
    });
  }

  return summaries;
}

export function AIAgent({ reports, accounts }: AIAgentProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);

  const farmData = useMemo(() => buildFarmDataContext(reports, accounts), [reports, accounts]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Msg = { role: "user", content: text.trim() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      // Fire-and-forget: log the question
      try {
        const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-question`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ question: text.trim(), email: session?.user?.email || "" }),
        }).catch(() => {});
      } catch {}

      let assistantSoFar = "";

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            farmData,
          }),
        });

        if (!resp.ok || !resp.body) {
          const err = await resp.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || "Failed to get response");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                const snapshot = assistantSoFar;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: snapshot } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: snapshot }];
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                const snapshot = assistantSoFar;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: snapshot } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: snapshot }];
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${e.message || "Something went wrong. Please try again."}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, farmData]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bot className="h-4 w-4" />
          AI Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              AI Quality Agent
            </DialogTitle>
            {messages.length > 0 && (
              <ExportPdfButton targetRef={chatContentRef} filename="ai-agent-chat" size="sm" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Ask questions about farm quality data. I can analyze trends, compare farms, and create tables.
          </p>
        </DialogHeader>

        {/* Chat area */}
        <ScrollArea className="flex-1 px-5" ref={scrollRef}>
          <div className="py-4 space-y-4" ref={chatContentRef}>
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Sparkles className="h-4 w-4" />
                  Try one of these questions:
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SAMPLE_QUESTIONS.map((q, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      onClick={() => sendMessage(q)}
                      className="text-left text-sm px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-colors text-foreground"
                    >
                      {q}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 border border-border text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border [&_th]:bg-muted/50 [&_table]:overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border px-5 py-3 shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about farm quality data…"
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
