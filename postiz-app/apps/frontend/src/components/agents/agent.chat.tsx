'use client';

import React, {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AssistantMessageProps,
  CopilotChat,
  CopilotKitCSSProperties,
  InputProps,
  Markdown,
  RenderMessageProps,
  UserMessageProps,
} from '@copilotkit/react-ui';
import clsx from 'clsx';
import copy from 'copy-to-clipboard';
import { Input } from '@gitroom/frontend/components/agents/agent.input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotChatInternal,
} from '@copilotkit/react-core';
import {
  MediaPortal,
  PropertiesContext,
} from '@gitroom/frontend/components/agents/agent';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  Message as CopilotMessage,
  TextMessage,
} from '@copilotkit/runtime-client-gql';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { fromUtc } from '@gitroom/frontend/components/layout/set.timezone';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';

export const AgentChat: FC<{ id?: string }> = ({ id: propId }) => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id: string }>();
  const id = propId || params?.id || 'new';
  const {
    properties,
    newSessionId,
    newChatResetCount,
    refreshThreads,
  } = useContext(PropertiesContext);
  const t = useT();

  const isNew = id === 'new';
  const effectiveThreadId = isNew ? newSessionId || undefined : id;
  const copilotInstanceKey = isNew
    ? `new-${newChatResetCount}-${newSessionId}`
    : `existing-${id}`;

  const welcomeMessage = t(
    'agent_welcome_message',
    `Hello, I am your Postiz agent 🙌🏻.

I can schedule a post or multiple posts to multiple channels and generate pictures and videos.

You can select the channels you want to use from the left menu.

You can see your previous conversations from the right menu.

You can also use me as an MCP Server, check Settings >> Agents / Dev`
  );

  return (
    <CopilotKit
      key={copilotInstanceKey}
      {...(effectiveThreadId ? { threadId: effectiveThreadId } : {})}
      credentials="include"
      runtimeUrl={backendUrl + '/copilot/agent'}
      useSingleEndpoint={true}
      showDevConsole={false}
      agent="postiz"
      properties={{
        integrations: properties,
      }}
    >
      <Hooks />
      <LoadMessages id={id} />
      <div
        style={
          {
            '--copilot-kit-primary-color': 'var(--new-btn-primary)',
            '--copilot-kit-contrast-color': '#ffffff',
            '--copilot-kit-background-color': 'var(--new-bgColorInner)',
            '--copilot-kit-secondary-color': 'var(--new-bgColor)',
            '--copilot-kit-secondary-contrast-color': 'var(--new-btn-text)',
            '--copilot-kit-separator-color': 'var(--new-table-border)',
          } as CopilotKitCSSProperties
        }
        className="trz agent bg-newBgColorInner flex flex-col gap-[15px] transition-all flex-1 items-center relative"
      >
        <div className="absolute left-0 w-full h-full pb-[16px]">
          <CopilotChat
            className="w-full h-full"
            onInProgress={(inProgress) => {
              if (!inProgress) {
                refreshThreads();
                setTimeout(() => refreshThreads(), 2500);
              }
            }}
            labels={{
              title: t('your_assistant', 'Your Assistant'),
              placeholder: t(
                'agent_input_placeholder',
                'Ask Postiz Agent to draft, schedule, or analyze posts...'
              ),
              initial: isNew ? welcomeMessage : '',
            }}
            RenderMessage={CustomRenderMessage}
            AssistantMessage={RefinedAssistantMessage}
            UserMessage={Message}
            Input={NewInput}
          />
        </div>
      </div>
    </CopilotKit>
  );
};

const extractReasoningFromParts = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        return extractReasoningFromParts(parsed);
      }
    } catch {
      return '';
    }
    return '';
  }
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (part?.type === 'reasoning') {
          if (typeof part.reasoning === 'string') return part.reasoning;
          if (typeof part.text === 'string') return part.text;
          if (Array.isArray(part.details)) {
            return part.details
              .map((d: any) => (typeof d?.text === 'string' ? d.text : ''))
              .join('');
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  if (typeof content === 'object') {
    const chunks: string[] = [];
    if (typeof content.reasoning === 'string' && content.reasoning.trim()) {
      chunks.push(content.reasoning.trim());
    }
    if (
      typeof content.reasoningContent === 'string' &&
      content.reasoningContent.trim()
    ) {
      chunks.push(content.reasoningContent.trim());
    }
    if (Array.isArray(content.parts)) {
      const fromParts = extractReasoningFromParts(content.parts);
      if (fromParts) chunks.push(fromParts);
    }
    if (content.content && typeof content.content === 'object') {
      const nested = extractReasoningFromParts(content.content);
      if (nested) chunks.push(nested);
    }
    return chunks.join('\n\n');
  }
  return '';
};

const extractText = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        return extractText(parsed);
      }
    } catch {
      return content;
    }
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part: any) =>
        part?.type === 'text'
          ? part.text
          : typeof part === 'string'
          ? part
          : ''
      )
      .join('');
  }
  if (typeof content === 'object') {
    if (Array.isArray(content.parts)) {
      const partsText = content.parts
        .map((part: any) => (part?.type === 'text' ? part.text : ''))
        .join('');
      if (partsText) return partsText;
    }
    if (typeof content.content === 'string') return content.content;
    if (content.content && typeof content.content === 'object')
      return extractText(content.content);
    if (content.text) return content.text;
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return String(content);
};

const parseReasoningAndAnswer = (
  rawContent: string,
  externalReasoning = ''
): {
  reasoning: string;
  answer: string;
  isThinkingOpen: boolean;
} => {
  const cleanedRaw = (rawContent || '').replace(
    /\[--integrations--\][\s\S]*?\[--integrations--\]/g,
    ''
  );
  const reasoningParts: string[] = [];
  if (externalReasoning.trim()) {
    reasoningParts.push(externalReasoning.trim());
  }

  let working = cleanedRaw;
  const closedThinkRegex = /<(?:think|thinking)>([\s\S]*?)<\/(?:think|thinking)>/gi;
  working = working.replace(closedThinkRegex, (_, inner: string) => {
    if (inner && inner.trim()) {
      reasoningParts.push(inner.trim());
    }
    return '';
  });

  let isThinkingOpen = false;
  const openMatch = working.match(/<(?:think|thinking)>([\s\S]*)$/i);
  if (openMatch && openMatch.index !== undefined) {
    isThinkingOpen = true;
    const partialThought = openMatch[1]?.trim();
    if (partialThought) {
      reasoningParts.push(partialThought);
    }
    working = working.slice(0, openMatch.index);
  }

  const dedupedReasoning = Array.from(new Set(reasoningParts)).join('\n\n');

  return {
    reasoning: dedupedReasoning.trim(),
    answer: working.trim(),
    isThinkingOpen,
  };
};

const LoadMessages: FC<{ id: string }> = ({ id }) => {
  const { messages, setMessages, agent } = useCopilotChatInternal();
  const fetch = useFetch();
  const [isLoadingHistory, setIsLoadingHistory] = useState(id !== 'new');
  const currentId = useRef<string | null>(null);
  const loaded = useRef<{ id: string; messages: CopilotMessage[] } | null>(
    null
  );

  const agentRef = useRef(agent);
  agentRef.current = agent;
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;

  useEffect(() => {
    let isCancelled = false;
    currentId.current = id;

    if (id === 'new') {
      loaded.current = null;
      setMessagesRef.current([]);
      if ((agentRef.current as any)?.setMessages) {
        (agentRef.current as any).setMessages([]);
      }
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);

    (async () => {
      try {
        const response = await fetch(`/copilot/${id}/list`);
        if (isCancelled || currentId.current !== id) return;
        if (!response.ok) {
          setIsLoadingHistory(false);
          return;
        }
        const data = await response.json();
        if (isCancelled || currentId.current !== id) return;

        const rawMessages: any[] = data.messages || [];
        const list: CopilotMessage[] = [];
        let pendingReasoning: string[] = [];

        for (const p of rawMessages) {
          if (!p) continue;
          if (p.role === 'user') {
            if (pendingReasoning.length) {
              list.push(
                new TextMessage({
                  id: makeId(12),
                  role: 'assistant' as any,
                  content: `<think>${pendingReasoning.join('\n\n')}</think>`,
                })
              );
              pendingReasoning = [];
            }
            const userText = extractText(p.content);
            if (userText.trim()) {
              list.push(
                new TextMessage({
                  id: p.id || makeId(12),
                  content: userText,
                  role: p.role,
                })
              );
            }
            continue;
          }

          if (p.role === 'reasoning') {
            const rText =
              extractText(p.content) || extractReasoningFromParts(p.content);
            if (rText.trim()) pendingReasoning.push(rText.trim());
            continue;
          }

          if (p.role === 'assistant') {
            const text = extractText(p.content);
            const partReasoning =
              extractReasoningFromParts(p.content) ||
              (typeof p.reasoning === 'string' ? p.reasoning : '');
            if (partReasoning.trim()) {
              pendingReasoning.push(partReasoning.trim());
            }

            if (!text.trim()) {
              continue;
            }

            const hasInlineThink = /<(?:think|thinking)>/i.test(text);
            const combinedContent =
              pendingReasoning.length && !hasInlineThink
                ? `<think>${pendingReasoning.join('\n\n')}</think>\n\n${text}`
                : text;
            pendingReasoning = [];

            list.push(
              new TextMessage({
                id: p.id || makeId(12),
                content: combinedContent,
                role: p.role,
              })
            );
          }
        }

        if (pendingReasoning.length) {
          list.push(
            new TextMessage({
              id: makeId(12),
              role: 'assistant' as any,
              content: `<think>${pendingReasoning.join('\n\n')}</think>`,
            })
          );
        }

        if (isCancelled || currentId.current !== id) return;

        loaded.current = { id, messages: list };
        setMessagesRef.current(list);

        if ((agentRef.current as any)?.setMessages) {
          (agentRef.current as any).setMessages(
            list.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load past chat messages:', err);
      } finally {
        if (!isCancelled && currentId.current === id) {
          setIsLoadingHistory(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [id, fetch]);

  // Handle rehydration if agent re-connects or resets
  useEffect(() => {
    if (id === 'new') return;
    if (loaded.current?.id === id && loaded.current.messages.length > 0) {
      if (!messages.length && !isLoadingHistory) {
        setMessagesRef.current(loaded.current.messages);
        if ((agentRef.current as any)?.setMessages) {
          (agentRef.current as any).setMessages(
            loaded.current.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        }
      }
    }
  }, [messages.length, id, isLoadingHistory]);

  if (isLoadingHistory && id !== 'new') {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-newBgColorInner/80 backdrop-blur-[1px] pointer-events-none">
        <div className="flex items-center gap-[8px] px-[16px] py-[10px] rounded-[10px] bg-newBgColor border border-newTableBorder shadow-md">
          <span className="w-[14px] h-[14px] rounded-full border-2 border-btnPrimary border-t-transparent animate-spin" />
          <span className="text-[12.5px] font-[500] text-textColor/75">
            Loading conversation...
          </span>
        </div>
      </div>
    );
  }

  return null;
};

const ReasoningPanel: FC<{
  reasoning: string;
  isStreamingThought: boolean;
}> = ({ reasoning, isStreamingThought }) => {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (isStreamingThought) {
      setExpanded(true);
    }
  }, [isStreamingThought]);

  const lineCount = useMemo(
    () => reasoning.split(/\r?\n/).filter((l) => l.trim().length > 0).length,
    [reasoning]
  );

  return (
    <div className="rounded-[12px] border border-newTableBorder bg-newBgColor/75 overflow-hidden mb-[12px]">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-[12px] py-[9px] flex items-center justify-between gap-[8px] text-start hover:bg-boxHover/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-[8px]">
          <span
            className={clsx(
              'w-[20px] h-[20px] rounded-[6px] flex items-center justify-center shrink-0',
              isStreamingThought
                ? 'bg-btnPrimary/25 text-btnPrimary animate-pulse'
                : 'bg-btnPrimary/15 text-textColor/80'
            )}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.75L9.6 5.4L13.25 7L9.6 8.6L8 12.25L6.4 8.6L2.75 7L6.4 5.4L8 1.75Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M12.5 11.25L13.1 12.65L14.5 13.25L13.1 13.85L12.5 15.25L11.9 13.85L10.5 13.25L11.9 12.65L12.5 11.25Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="text-[12.5px] font-[600] text-textColor/90">
            {isStreamingThought ? 'Reasoning...' : 'Model Reasoning'}
          </span>
          {isStreamingThought ? (
            <span className="text-[10.5px] px-[6px] py-[1px] rounded-full bg-btnPrimary/20 text-textColor/80 border border-btnPrimary/30">
              Thinking
            </span>
          ) : (
            <span className="text-[11px] text-textColor/50">
              {lineCount} {lineCount === 1 ? 'step' : 'steps'}
            </span>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className={clsx(
            'text-textColor/55 transition-transform duration-200 shrink-0',
            expanded ? 'rotate-180' : 'rotate-0'
          )}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="px-[14px] pb-[12px] pt-[4px] border-t border-newTableBorder/60 max-h-[280px] overflow-y-auto scrollbar scrollbar-thumb-fifth scrollbar-track-transparent">
          <div className="ps-[10px] border-s-2 border-btnPrimary/50 text-[12.5px] leading-[1.6] text-textColor/75 agent-reasoning-markdown">
            <Markdown content={reasoning} />
          </div>
        </div>
      )}
    </div>
  );
};

const collectTurnReasoning = (
  allMessages: any[] | undefined,
  targetIndex: number
): string => {
  if (!Array.isArray(allMessages) || targetIndex < 0) return '';
  const collected: string[] = [];

  for (let i = targetIndex - 1; i >= 0; i--) {
    const prev = allMessages[i];
    if (!prev) continue;
    if (prev.role === 'user') break;
    if (prev.role === 'assistant') {
      const prevText = extractText(prev.content);
      const hasPrevSubUI = Boolean(prev.generativeUI?.());
      if (prevText.trim() || hasPrevSubUI) {
        break;
      }
    }
    if (prev.role === 'reasoning') {
      const rText =
        extractText(prev.content) || extractReasoningFromParts(prev.content);
      if (rText.trim()) {
        collected.unshift(rText.trim());
      }
    }
  }

  const current = allMessages[targetIndex];
  if (current?.role === 'reasoning') {
    const ownText =
      extractText(current.content) ||
      extractReasoningFromParts(current.content);
    if (ownText.trim()) {
      collected.push(ownText.trim());
    }
  }

  return collected.join('\n\n');
};

interface AgentActionMeta {
  name: string;
  label: string;
  icon: string;
  status: 'completed' | 'running';
  args?: any;
}

const KNOWN_AGENT_CAPABILITIES: Record<
  string,
  { label: string; icon: string }
> = {
  integrationSchedulePostTool: { label: 'Schedule Social Post', icon: '📅' },
  postsListTool: { label: 'List Scheduled Posts', icon: '📋' },
  postSettingsTool: { label: 'Update Post Settings', icon: '⚙️' },
  deletePostTool: { label: 'Delete Scheduled Post', icon: '🗑️' },
  generateImageTool: { label: 'Generate AI Image', icon: '🎨' },
  generateVideoTool: { label: 'Generate AI Video', icon: '🎬' },
  generateVideoOptionsTool: { label: 'Video Generation Options', icon: '🎞️' },
  clippingTool: { label: 'Video Clipping Tool', icon: '✂️' },
  knowledgeRetrieveTool: { label: 'Knowledge Base Search', icon: '🔍' },
  integrationListTool: { label: 'Connected Channels', icon: '🌐' },
  integrationValidationTool: { label: 'Channel Validation', icon: '🛡️' },
  groupListTool: { label: 'Customer Channel Groups', icon: '👥' },
  uploadFromUrlTool: { label: 'Import Media from URL', icon: '🔗' },
  mediaListTool: { label: 'Media Library Search', icon: '📁' },
  manualPosting: { label: 'Manual Post Composer', icon: '✍️' },
};

const extractAgentActions = (message: any): AgentActionMeta[] => {
  const actions: AgentActionMeta[] = [];
  if (!message) return actions;

  // 1. Check raw tool calls (from OpenAI adapter or Mastra)
  const rawToolCalls =
    (message as any)?.toolCalls || (message as any)?.tool_calls || [];
  if (Array.isArray(rawToolCalls)) {
    for (const tc of rawToolCalls) {
      const fnName = tc?.function?.name || tc?.name;
      if (!fnName) continue;
      const meta = KNOWN_AGENT_CAPABILITIES[fnName] || {
        label: fnName
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (s: string) => s.toUpperCase()),
        icon: '⚡',
      };
      let argsObj: any = null;
      try {
        argsObj =
          typeof tc?.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc?.function?.arguments || tc?.args;
      } catch {
        argsObj = tc?.function?.arguments;
      }
      actions.push({
        name: fnName,
        label: meta.label,
        icon: meta.icon,
        status: 'completed',
        args: argsObj,
      });
    }
  }

  // 2. Check parts in content (Mastra format 2)
  const rawParts = (message as any)?.content?.parts || [];
  if (Array.isArray(rawParts)) {
    for (const part of rawParts) {
      if (part?.type === 'tool-call' || part?.type === 'tool_call') {
        const toolName = part?.toolName || part?.name || part?.function?.name;
        if (!toolName) continue;
        const meta = KNOWN_AGENT_CAPABILITIES[toolName] || {
          label: toolName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (s: string) => s.toUpperCase()),
          icon: '⚡',
        };
        actions.push({
          name: toolName,
          label: meta.label,
          icon: meta.icon,
          status: 'completed',
          args: part?.args || part?.input,
        });
      }
    }
  }

  return actions;
};

const AgentActionBadge: FC<{ action: AgentActionMeta }> = ({ action }) => {
  const [open, setOpen] = useState(false);
  const hasArgs =
    action.args &&
    (typeof action.args === 'object'
      ? Object.keys(action.args).length > 0
      : String(action.args).trim().length > 0);

  return (
    <div className="rounded-[10px] bg-newBgColor/80 border border-newTableBorder/80 px-[10px] py-[7px] text-[12px] my-[3px] flex flex-col gap-[4px] transition-all">
      <div
        className={clsx(
          'flex items-center justify-between select-none',
          hasArgs && 'cursor-pointer'
        )}
        onClick={() => hasArgs && setOpen(!open)}
      >
        <div className="flex items-center gap-[7px]">
          <span className="text-[13px]">{action.icon}</span>
          <span className="font-[600] text-textColor/90 text-[12.5px]">
            {action.label}
          </span>
        </div>
        <div className="flex items-center gap-[6px]">
          <span className="inline-flex items-center gap-[4px] text-[10.5px] font-[500] px-[7px] py-[1.5px] rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-[5px] h-[5px] rounded-full bg-emerald-400" />
            Action Executed
          </span>
          {hasArgs && (
            <span className="text-textColor/40 text-[10px] font-mono">
              {open ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>
      {open && hasArgs && (
        <pre className="text-[11px] p-[8px] rounded-[6px] bg-black/45 text-textColor/80 font-mono overflow-x-auto max-h-[140px] scrollbar border border-newTableBorder/40 mt-[3px]">
          {typeof action.args === 'string'
            ? action.args
            : JSON.stringify(action.args, null, 2)}
        </pre>
      )}
    </div>
  );
};

const RefinedAssistantMessage: FC<
  AssistantMessageProps & {
    turnReasoning?: string;
    isWelcomeMessage?: boolean;
    forceThinkingState?: boolean;
  }
> = (props) => {
  const {
    message,
    isLoading,
    isGenerating,
    onRegenerate,
    onCopy,
    markdownTagRenderers,
    turnReasoning = '',
    isWelcomeMessage = false,
    forceThinkingState = false,
  } = props;

  const [copied, setCopied] = useState(false);

  const rawContent = extractText(message?.content);
  const directMsgReasoning =
    typeof (message as any)?.reasoning === 'string'
      ? (message as any).reasoning
      : extractReasoningFromParts(message?.content);

  const combinedExternalReasoning = [turnReasoning, directMsgReasoning]
    .filter(Boolean)
    .join('\n\n');

  const { reasoning, answer, isThinkingOpen } = useMemo(
    () => parseReasoningAndAnswer(rawContent, combinedExternalReasoning),
    [rawContent, combinedExternalReasoning]
  );

  const agentActions = useMemo(
    () => extractAgentActions(message),
    [message]
  );

  const subComponent = message?.generativeUI?.() ?? props.subComponent;
  const subComponentPosition = message?.generativeUIPosition ?? 'after';
  const renderBefore = subComponent && subComponentPosition === 'before';
  const renderAfter = subComponent && subComponentPosition !== 'before';

  const isStreamingThought =
    forceThinkingState ||
    ((isLoading || isGenerating) && (isThinkingOpen || (!answer && !!reasoning)));

  const handleCopy = () => {
    const textToCopy = answer || reasoning;
    if (!textToCopy) return;
    copy(textToCopy);
    setCopied(true);
    onCopy?.(textToCopy);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!reasoning && !answer && !subComponent && !isLoading && !agentActions.length) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-[6px] my-[4px]">
      {renderBefore ? <div className="mb-[6px]">{subComponent}</div> : null}

      <div className="copilotKitMessage copilotKitAssistantMessage !max-w-[92%] w-fit min-w-[260px] !bg-newTableHeader !border !border-newTableBorder !rounded-[16px] !rounded-tl-[4px] !px-[16px] !py-[14px] !text-textColor shadow-sm">
        {/* Assistant Header */}
        <div className="flex items-center justify-between gap-[10px] mb-[8px]">
          <div className="flex items-center gap-[8px]">
            <span className="w-[22px] h-[22px] rounded-[7px] bg-btnPrimary/20 border border-btnPrimary/40 text-textColor flex items-center justify-center text-[11px] font-[700]">
              AI
            </span>
            <span className="text-[12.5px] font-[600] text-textColor/85">
              Postiz Agent
            </span>
          </div>
          {(isStreamingThought || isGenerating || isLoading) && (
            <span className="inline-flex items-center gap-[5px] text-[11px] font-[500] text-textColor/65">
              <span className="w-[6px] h-[6px] rounded-full bg-btnPrimary animate-ping" />
              <span>
                {isStreamingThought
                  ? 'Thinking...'
                  : isGenerating
                  ? 'Responding...'
                  : 'Working...'}
              </span>
            </span>
          )}
        </div>

        {/* Reasoning Block */}
        {!!reasoning && (
          <ReasoningPanel
            reasoning={reasoning}
            isStreamingThought={isStreamingThought}
          />
        )}

        {/* Agent Capabilities & Action Badges */}
        {agentActions.length > 0 && (
          <div className="flex flex-col gap-[4px] my-[6px]">
            {agentActions.map((action, idx) => (
              <AgentActionBadge key={idx} action={action} />
            ))}
          </div>
        )}

        {/* Final Answer Content */}
        {answer ? (
          <div className="text-[14px] leading-[1.65] text-textColor agent-response-markdown">
            <Markdown content={answer} components={markdownTagRenderers} />
          </div>
        ) : isLoading || isStreamingThought ? (
          <div className="flex items-center gap-[6px] py-[4px] text-[13px] text-textColor/60">
            <span className="w-[6px] h-[6px] rounded-full bg-textColor/50 animate-bounce" />
            <span
              className="w-[6px] h-[6px] rounded-full bg-textColor/50 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-[6px] h-[6px] rounded-full bg-textColor/50 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
            <span className="ms-[4px]">
              {isStreamingThought
                ? 'Synthesizing final response...'
                : 'Generating response...'}
            </span>
          </div>
        ) : null}

        {/* Action Controls */}
        {(answer || reasoning) &&
          !isLoading &&
          !isGenerating &&
          !forceThinkingState &&
          !isWelcomeMessage && (
            <div className="flex items-center gap-[8px] mt-[10px] pt-[8px] border-t border-newTableBorder/60">
              <button
                type="button"
                onClick={handleCopy}
                className="px-[8px] py-[4px] rounded-[6px] text-[11.5px] font-[500] text-textColor/65 hover:text-textColor hover:bg-newBgColor flex items-center gap-[5px] transition-colors cursor-pointer"
                title="Copy response"
              >
                {copied ? (
                  <>
                    <span className="text-emerald-400">✓</span>
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <rect
                        x="5.5"
                        y="5.5"
                        width="8"
                        height="8"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M10.5 5.5V3.5C10.5 2.95 10.05 2.5 9.5 2.5H3.5C2.95 2.5 2.5 2.95 2.5 3.5V9.5C2.5 10.05 2.95 10.5 3.5 10.5H5.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="px-[8px] py-[4px] rounded-[6px] text-[11.5px] font-[500] text-textColor/65 hover:text-textColor hover:bg-newBgColor flex items-center gap-[5px] transition-colors cursor-pointer"
                  title="Regenerate response"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.5 8A5.5 5.5 0 1 1 11.88 4.11M13.5 2.5V5.5H10.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          )}
      </div>

      {renderAfter ? <div className="mt-[4px]">{subComponent}</div> : null}
    </div>
  );
};

const CustomRenderMessage: FC<RenderMessageProps> = (props) => {
  const {
    message,
    messages,
    inProgress,
    index,
    isCurrentMessage,
    onRegenerate,
    onCopy,
    onThumbsUp,
    onThumbsDown,
    messageFeedback,
    markdownTagRenderers,
    ImageRenderer,
  } = props;

  if (message.role === 'user') {
    return (
      <Message
        rawData={message}
        message={message as any}
        ImageRenderer={ImageRenderer as any}
      />
    );
  }

  if (message.role === 'reasoning') {
    // Check whether a later reasoning or visible assistant message already renders this turn
    let handledLaterInTurn = false;
    for (let j = index + 1; j < messages.length; j++) {
      const next = messages[j] as any;
      if (!next) continue;
      if (next.role === 'user') break;
      if (next.role === 'reasoning') {
        handledLaterInTurn = true;
        break;
      }
      if (next.role === 'assistant') {
        const nextText = extractText(next.content);
        if (nextText.trim() || Boolean(next.generativeUI?.())) {
          handledLaterInTurn = true;
          break;
        }
      }
    }
    if (handledLaterInTurn) {
      return null;
    }

    const turnReasoning = collectTurnReasoning(messages as any[], index);
    if (!turnReasoning) return null;

    return (
      <RefinedAssistantMessage
        rawData={message}
        message={{ id: message.id, role: 'assistant', content: '' } as any}
        messages={messages}
        isLoading={inProgress}
        isGenerating={false}
        isCurrentMessage={isCurrentMessage}
        turnReasoning={turnReasoning}
        forceThinkingState={inProgress}
        markdownTagRenderers={markdownTagRenderers}
        ImageRenderer={ImageRenderer}
      />
    );
  }

  if (message.role === 'assistant') {
    const turnReasoning = collectTurnReasoning(messages as any[], index);
    const isWelcomeMessage =
      index === 0 && (message as any).id === extractText(message.content);

    return (
      <RefinedAssistantMessage
        rawData={message}
        subComponent={(message as any).generativeUI?.()}
        message={message as any}
        messages={messages}
        isLoading={inProgress && isCurrentMessage && !message.content}
        isGenerating={inProgress && isCurrentMessage && !!message.content}
        isCurrentMessage={isCurrentMessage}
        turnReasoning={turnReasoning}
        isWelcomeMessage={isWelcomeMessage}
        onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
        onCopy={onCopy}
        onThumbsUp={onThumbsUp}
        onThumbsDown={onThumbsDown}
        feedback={messageFeedback?.[message.id] || null}
        markdownTagRenderers={markdownTagRenderers}
        ImageRenderer={ImageRenderer}
      />
    );
  }

  if (message.role === 'tool') {
    const toolText = extractText(message.content);
    return (
      <div className="w-full max-w-[92%] my-[3px] px-[12px] py-[7px] rounded-[10px] bg-newBgColor/60 border border-newTableBorder/60 text-[12px] text-textColor/75 flex items-center justify-between">
        <div className="flex items-center gap-[6px]">
          <span className="w-[6px] h-[6px] rounded-full bg-emerald-400" />
          <span className="font-[600] text-textColor/85">Tool Result</span>
        </div>
        <span className="text-[11px] text-textColor/50 truncate max-w-[240px] font-mono">
          {toolText.slice(0, 60)}
        </span>
      </div>
    );
  }

  return null;
};

const Message: FC<UserMessageProps> = (props) => {
  const convertContentToImagesAndVideo = useMemo(() => {
    const text = extractText(props.message?.content);

    return text
      .replace(/Video: (http.*mp4\n)/g, (match, p1) => {
        return `<video controls class="h-[150px] w-[150px] rounded-[8px] mb-[10px]"><source src="${p1.trim()}" type="video/mp4">Your browser does not support the video tag.</video>`;
      })
      .replace(/Image: (http.*\n)/g, (match, p1) => {
        return `<img src="${p1.trim()}" class="h-[150px] w-[150px] rounded-[8px] object-cover max-w-full border border-newBgColorInner" />`;
      })
      .replace(/\[\-\-Media\-\-\](.*)\[\-\-Media\-\-\]/g, (match, p1) => {
        return `<div class="flex flex-wrap gap-[8px] justify-end mt-[12px]">${p1}</div>`;
      })
      .replace(
        /(\[--integrations--\][\s\S]*?\[--integrations--\])/g,
        () => ``
      )
      .trim();
  }, [props.message?.content]);

  if (!convertContentToImagesAndVideo) return null;

  return (
    <div className="w-full flex justify-end my-[4px]">
      <div
        className="copilotKitMessage copilotKitUserMessage !bg-btnPrimary !text-white !rounded-[16px] !rounded-br-[4px] !px-[16px] !py-[11px] !max-w-[80%] w-fit text-[14px] leading-[1.55] shadow-sm whitespace-pre-wrap break-words"
        dangerouslySetInnerHTML={{ __html: convertContentToImagesAndVideo }}
      />
    </div>
  );
};
const NewInput: FC<InputProps> = (props) => {
  const [media, setMedia] = useState([] as { path: string; id: string }[]);
  const [value, setValue] = useState('');
  const params = useParams<{ id: string }>();
  const { properties, newSessionId, recordChatActivity } =
    useContext(PropertiesContext);
  const activeThreadId = params.id === 'new' ? newSessionId : params.id;

  return (
    <>
      <MediaPortal
        value={value}
        media={media}
        setMedia={(e) => setMedia(e.target.value)}
      />
      <Input
        {...props}
        onChange={setValue}
        onSend={(text) => {
          recordChatActivity(activeThreadId, text);
          const send = props.onSend(
            text +
              (media.length > 0
                ? '\n[--Media--]' +
                  media
                    .map((m) =>
                      hasExtension(m.path, 'mp4')
                        ? `Video: ${m.path}`
                        : `Image: ${m.path}`
                    )
                    .join('\n') +
                  '\n[--Media--]'
                : '') +
              `
${
  properties.length
    ? `[--integrations--]
Use the following social media platforms: ${JSON.stringify(
        properties.map((p) => ({
          id: p.id,
          platform: p.identifier,
          profilePicture: p.picture,
          additionalSettings: p.additionalSettings,
        }))
      )}
[--integrations--]`
    : ``
}`
          );
          setValue('');
          setMedia([]);
          return send;
        }}
      />
    </>
  );
};

export const Hooks: FC = () => {
  const modals = useModals();

  useCopilotAction({
    name: 'manualPosting',
    description:
      'This tool should be triggered when the user wants to manually add the generated post',
    parameters: [
      {
        name: 'list',
        type: 'object[]',
        description:
          'list of posts to schedule to different social media (integration ids)',
        attributes: [
          {
            name: 'integrationId',
            type: 'string',
            description: 'The integration id',
          },
          {
            name: 'date',
            type: 'string',
            description: 'UTC date of the scheduled post',
          },
          {
            name: 'settings',
            type: 'object',
            description: 'Settings for the integration [input:settings]',
          },
          {
            name: 'posts',
            type: 'object[]',
            description: 'list of posts / comments (one under another)',
            attributes: [
              {
                name: 'content',
                type: 'string',
                description: 'the content of the post',
              },
              {
                name: 'attachments',
                type: 'object[]',
                description: 'list of attachments',
                attributes: [
                  {
                    name: 'id',
                    type: 'string',
                    description: 'id of the attachment',
                  },
                  {
                    name: 'path',
                    type: 'string',
                    description: 'url of the attachment',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      if (status === 'executing') {
        return <OpenModal args={args} respond={respond} />;
      }

      return null;
    },
  });
  return null;
};

const OpenModal: FC<{
  respond: (value: any) => void;
  args: {
    list: {
      integrationId: string;
      date: string;
      settings?: Record<string, any>;
      posts: { content: string; attachments: { id: string; path: string }[] }[];
    }[];
  };
}> = ({ args, respond }) => {
  const modals = useModals();
  const { properties } = useContext(PropertiesContext);
  const startModal = useCallback(async () => {
    for (const integration of args.list) {
      await new Promise((res) => {
        const group = makeId(10);
        modals.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          size: '80%',
          title: ``,
          classNames: {
            modal: 'w-[100%] max-w-[1400px] text-textColor',
          },
          children: (
            <ExistingDataContextProvider
              value={{
                group,
                integration: integration.integrationId,
                integrationPicture:
                  properties.find((p) => p.id === integration.integrationId)
                    ?.picture || '',
                settings: integration.settings || {},
                posts: integration.posts.map((p) => ({
                  approvedSubmitForOrder: 'NO',
                  content: p.content,
                  createdAt: new Date().toISOString(),
                  state: 'DRAFT',
                  id: makeId(10),
                  settings: JSON.stringify(integration.settings || {}),
                  group,
                  integrationId: integration.integrationId,
                  integration: properties.find(
                    (p) => p.id === integration.integrationId
                  ),
                  publishDate: dayjs.utc(integration.date).toISOString(),
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                })),
              }}
            >
              <AddEditModal
                date={fromUtc(integration.date)}
                allIntegrations={properties}
                integrations={properties.filter(
                  (p) => p.id === integration.integrationId
                )}
                onlyValues={integration.posts.map((p) => ({
                  content: p.content,
                  id: makeId(10),
                  settings: integration.settings || {},
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                }))}
                reopenModal={() => {}}
                mutate={() => res(true)}
              />
            </ExistingDataContextProvider>
          ),
        });
      });
    }

    respond('User scheduled all the posts');
  }, [args, respond, properties]);

  useEffect(() => {
    startModal();
  }, []);
  return (
    <div onClick={() => respond('continue')}>
      Opening manually ${JSON.stringify(args)}
    </div>
  );
};
