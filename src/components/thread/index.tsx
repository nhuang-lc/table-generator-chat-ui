import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  ArrowDown,
  LoaderCircle,
  Menu,
  ChevronDown,
  SquarePen,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { GitHubSVG } from "../icons/github";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  useArtifactOpen,
  useArtifactContext,
} from "./artifact";
import { TableView } from "@/components/TableView";
import { useThreads } from "@/providers/Thread";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function OpenGitHubRepo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/langchain-ai/agent-chat-ui"
            target="_blank"
            className="flex items-center justify-center"
          >
            <GitHubSVG
              width="24"
              height="24"
            />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Open GitHub repo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Thread() {
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);
  const formRef = useRef<HTMLDivElement>(null);

  const { getThreads, setThreads } = useThreads();

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
  };

  useEffect(() => {
    getThreads().then(setThreads).catch(console.error);
  }, [getThreads, setThreads]);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim().length === 0 || isLoading) return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        { type: "text", text: input }
      ] as Message["content"],
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values"],
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.disabled = true;
    }
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
    });
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <div className="flex flex-1">
        <div className="w-[70%] border-r overflow-hidden">
          <TableView />
        </div>

        <div className="w-[30%] flex flex-col overflow-hidden">
          <div className="flex-none">
            {!chatStarted && (
              <div className="flex w-full items-center justify-between gap-3 p-2 pl-4">
                <div className="relative">
                  <Button
                    className="hover:bg-gray-100 gap-2"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    <Menu className="size-5" />
                    <span>Thread History</span>
                    <ChevronDown className={cn(
                      "size-4 transition-transform",
                      chatHistoryOpen && "transform rotate-180"
                    )} />
                  </Button>
                  {chatHistoryOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg border z-50">
                      <ThreadHistory />
                    </div>
                  )}
                </div>
                <div className="flex items-center">
                  <OpenGitHubRepo />
                </div>
              </div>
            )}
            {chatStarted && (
              <div className="flex items-center justify-between gap-3 p-2">
                <div className="relative flex items-center justify-start gap-2">
                  <div className="relative">
                    <Button
                      className="hover:bg-gray-100 gap-2"
                      variant="ghost"
                      onClick={() => setChatHistoryOpen((p) => !p)}
                    >
                      <Menu className="size-5" />
                      <ChevronDown className={cn(
                        "size-4 transition-transform",
                        chatHistoryOpen && "transform rotate-180"
                      )} />
                    </Button>
                    {chatHistoryOpen && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg border z-50">
                        <ThreadHistory />
                      </div>
                    )}
                  </div>
                  <motion.button
                    className="flex cursor-pointer items-center gap-2"
                    onClick={() => setThreadId(null)}
                  >
                    <LangGraphLogoSVG
                      width={32}
                      height={32}
                    />
                    <span className="text-xl font-semibold tracking-tight">
                      Table Generator
                    </span>
                  </motion.button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <OpenGitHubRepo />
                  </div>
                  <TooltipIconButton
                    size="lg"
                    className="p-4"
                    tooltip="New thread"
                    variant="ghost"
                    onClick={() => setThreadId(null)}
                  >
                    <SquarePen className="size-5" />
                  </TooltipIconButton>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <StickToBottom className="h-full">
              <StickyToBottomContent
                className={cn(
                  "h-full overflow-y-auto px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
                  !chatStarted && "flex flex-col items-stretch",
                  chatStarted && "grid grid-rows-[1fr_auto]"
                )}
                contentClassName="flex flex-col gap-4 w-full"
                content={
                  <>
                    <div className="flex-1 pt-8">
                      {messages
                        .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                        .map((message, index) =>
                          message.type === "human" ? (
                            <HumanMessage
                              key={message.id || `${message.type}-${index}`}
                              message={message}
                              isLoading={isLoading}
                            />
                          ) : (
                            <AssistantMessage
                              key={message.id || `${message.type}-${index}`}
                              message={message}
                              isLoading={isLoading}
                              handleRegenerate={handleRegenerate}
                            />
                          )
                        )}
                      {hasNoAIOrToolMessages && !!stream.interrupt && (
                        <AssistantMessage
                          key="interrupt-msg"
                          message={undefined}
                          isLoading={isLoading}
                          handleRegenerate={handleRegenerate}
                        />
                      )}
                      {isLoading && !firstTokenReceived && (
                        <AssistantMessageLoading />
                      )}
                    </div>
                  </>
                }
                footer={
                  <div className="flex-none bg-white py-4">
                    {!chatStarted && (
                      <div className="flex items-center gap-3 mb-4">
                        <LangGraphLogoSVG className="h-8 flex-shrink-0" />
                        <h1 className="text-2xl font-semibold tracking-tight">
                          Table Generator
                        </h1>
                      </div>
                    )}

                    <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                    <div
                      ref={formRef}
                      className={cn(
                        "bg-muted relative z-10 mx-auto mb-8 w-full rounded-2xl shadow-xs transition-all",
                        "border border-solid"
                      )}
                    >
                      <form
                        onSubmit={handleSubmit}
                        className="mx-auto grid grid-rows-[1fr_auto] gap-2"
                      >
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              !e.metaKey &&
                              !e.nativeEvent.isComposing
                            ) {
                              e.preventDefault();
                              const el = e.target as HTMLElement | undefined;
                              const form = el?.closest("form");
                              form?.requestSubmit();
                            }
                          }}
                          disabled={messages.length > 0}
                          placeholder={messages.length > 0 ? "Chat is disabled after first message" : "Type your message..."}
                          className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />

                        <div className="flex items-center gap-6 p-2 pt-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="render-tool-calls"
                                checked={hideToolCalls ?? false}
                                onCheckedChange={setHideToolCalls}
                              />
                              <Label
                                htmlFor="render-tool-calls"
                                className="text-sm text-gray-600"
                              >
                                Hide Tool Calls
                              </Label>
                            </div>
                          </div>
                          {stream.isLoading ? (
                            <Button
                              key="stop"
                              onClick={() => stream.stop()}
                              className="ml-auto"
                            >
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Cancel
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              className="ml-auto shadow-md transition-all"
                              disabled={isLoading || !input.trim()}
                            >
                              Send
                            </Button>
                          )}
                        </div>
                      </form>
                    </div>
                  </div>
                }
              />
            </StickToBottom>
          </div>
        </div>
      </div>
    </div>
  );
}
