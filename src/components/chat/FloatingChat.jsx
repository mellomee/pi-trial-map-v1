import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, X, Send, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

export default function FloatingChat({ caseId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const [showToasts, setShowToasts] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!caseId) return;
    base44.entities.ChatMessages.filter({ case_id: caseId }, "-created_date", 50)
      .then(msgs => setMessages(msgs.reverse()));
    
    const unsub = base44.entities.ChatMessages.subscribe((event) => {
      if (event.type === "create" && event.data?.case_id === caseId) {
        setMessages(prev => [...prev, event.data]);
        if (!open) {
          setUnread(u => u + 1);
          if (showToasts) {
            setToast(event.data);
            setTimeout(() => setToast(null), 4000);
          }
        }
      }
    });
    return unsub;
  }, [caseId, open, showToasts]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages]);

  const send = async () => {
    if (!text.trim() || !caseId) return;
    await base44.entities.ChatMessages.create({
      case_id: caseId,
      channel: "general",
      user_id: user?.id,
      user_name: user?.full_name || "Unknown",
      message_text: text.trim()
    });
    setText("");
  };

  return (
    <>
      <AnimatePresence>
        {toast && !open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-4 z-[60] bg-slate-800 border border-cyan-500/30 rounded-lg p-3 max-w-xs shadow-lg"
          >
            <p className="text-xs text-cyan-400 font-medium">{toast.user_name}</p>
            <p className="text-sm text-slate-200 mt-1 line-clamp-2">{toast.message_text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-20 left-4 z-[60] w-80 h-96 bg-slate-900 border border-slate-700 rounded-xl flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <span className="text-sm font-semibold text-slate-200">Team Chat</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => setShowToasts(!showToasts)}>
                  {showToasts ? "🔔" : "🔕"}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => setOpen(false)}>
                  <Minimize2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`text-xs ${m.user_id === user?.id ? "text-right" : ""}`}>
                  <span className="text-cyan-400 font-medium">{m.user_name}: </span>
                  <span className="text-slate-300">{m.message_text}</span>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="p-2 border-t border-slate-700 flex gap-2">
              <Input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Type a message..."
                className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200"
              />
              <Button size="icon" className="h-8 w-8 bg-cyan-600 hover:bg-cyan-700" onClick={send}>
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 left-4 z-[60] w-12 h-12 rounded-full bg-cyan-600 hover:bg-cyan-700 flex items-center justify-center shadow-lg transition-colors"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <MessageCircle className="w-5 h-5 text-white" />}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </>
  );
}