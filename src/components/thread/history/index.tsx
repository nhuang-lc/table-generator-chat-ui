import { useQueryState, parseAsBoolean } from "nuqs";
import { useThreads } from "@/providers/Thread";

export default function ThreadHistory() {
  const { threads } = useThreads();
  const [_threadId, setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false)
  );

  return (
    <div className="py-2">
      {threads.map((thread) => (
        <button
          key={thread.thread_id}
          onClick={() => {
            setThreadId(thread.thread_id);
            setChatHistoryOpen(false);
          }}
          className="w-full px-4 py-2 text-center hover:bg-gray-100 text-sm"
        >
          {thread.thread_id}
        </button>
      ))}
      {threads.length === 0 && (
        <div className="px-4 py-2 text-center text-gray-500 text-sm">
          No threads yet
        </div>
      )}
    </div>
  );
}
