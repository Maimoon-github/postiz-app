'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import useSWR, { useSWRConfig } from 'swr';
import { orderBy } from 'lodash';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useWaitForClass } from '@gitroom/helpers/utils/use.wait.for.class';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import { Integration } from '@prisma/client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const MediaPortal: FC<{
  media: { path: string; id: string }[];
  value: string;
  setMedia: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }[];
    };
  }) => void;
}> = ({ media, setMedia, value }) => {
  const waitForClass = useWaitForClass('copilotKitMessages');
  const t = useT();
  if (!waitForClass) return null;
  return (
    <div className="pl-[14px] pr-[24px] whitespace-nowrap editor rm-bg">
      <MultiMediaComponent
        allData={[{ content: value }]}
        text={value}
        label={t('attachments', 'Attachments')}
        description=""
        value={media}
        dummy={false}
        name="image"
        onChange={setMedia}
        onOpen={() => {}}
        onClose={() => {}}
      />
    </div>
  );
};

export const AgentList: FC<{ onChange: (arr: any[]) => void }> = ({
  onChange,
}) => {
  const fetch = useFetch();
  const t = useT();
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);

  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');

  const { data } = useSWR('integrations', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const setIntegration = useCallback(
    (integration: Integration) => () => {
      if (selected.some((p) => p.id === integration.id)) {
        onChange(selected.filter((p) => p.id !== integration.id));
        setSelected(selected.filter((p) => p.id !== integration.id));
      } else {
        onChange([...selected, integration]);
        setSelected([...selected, integration]);
      }
    },
    [selected]
  );

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data || [],
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative mobile:w-full mobile:order-1',
        collapseMenu === '1' ? 'group sidebar w-[100px]' : 'w-[260px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] mobile:p-[12px] mobile:static mobile:h-auto overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="flex items-center mobile:hidden">
          <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500] mb-[15px]">
            {t('select_channels', 'Select Channels')}
          </h2>
          <div
            onClick={() => setCollapseMenu(collapseMenu === '1' ? '0' : '1')}
            className="-mt-3 group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="7"
              height="13"
              viewBox="0 0 7 13"
              fill="none"
            >
              <path
                d="M6 11.5L1 6.5L6 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div
          className={clsx(
            'flex flex-col gap-[15px] mobile:flex-row mobile:gap-[12px] mobile:ps-[12px] mobile:pt-[6px]'
          )}
        >
          {sortedIntegrations.map((integration, index) => (
            <div
              onClick={setIntegration(integration)}
              key={integration.id}
              className={clsx(
                'flex gap-[12px] items-center group/profile justify-center hover:bg-boxHover rounded-e-[8px] hover:opacity-100 cursor-pointer mobile:shrink-0',
                !selected.some((p) => p.id === integration.id) && 'opacity-20'
              )}
            >
              <div
                className={clsx(
                  'relative rounded-full flex justify-center items-center gap-[6px]',
                  integration.disabled && 'opacity-50'
                )}
              >
                {(integration.inBetweenSteps || integration.refreshNeeded) && (
                  <div className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer">
                    <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-0 -top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
                      !
                    </div>
                    <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[199]" />
                  </div>
                )}
                <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity">
                  <SVGLine />
                </div>
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                  src={integration.picture}
                  className="rounded-[8px]"
                  alt={integration.identifier}
                  width={36}
                  height={36}
                />
                <SafeImage
                  src={`/icons/platforms/${integration.identifier}.png`}
                  className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                  alt={integration.identifier}
                  width={18.41}
                  height={18.41}
                />
              </div>
              <div
                className={clsx(
                  'flex-1 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden mobile:hidden',
                  integration.disabled && 'opacity-50'
                )}
              >
                {integration.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export interface RecentThreadItem {
  id: string;
  title: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export const formatChatTimestamp = (timestamp?: string | number): string => {
  if (!timestamp) return '';
  const date =
    typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
};

interface PropertiesContextType {
  properties: any[];
  newSessionId: string;
  newChatResetCount: number;
  sessionTitles: Record<string, string>;
  activeSessions: RecentThreadItem[];
  startNewChat: () => void;
  deleteChatSession: (threadId: string) => Promise<void>;
  recordChatActivity: (threadId: string, promptText?: string) => void;
  refreshThreads: () => void;
}

const CHAT_TITLES_STORAGE_KEY = 'postiz_agent_chat_titles_v1';
const CHAT_SESSIONS_STORAGE_KEY = 'postiz_agent_recent_sessions_v1';

const summarizePrompt = (raw?: string): string => {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\[--integrations--\][\s\S]*?\[--integrations--\]/g, '')
    .replace(/\[--Media--\][\s\S]*?\[--Media--\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.length > 48 ? `${cleaned.slice(0, 48).trim()}...` : cleaned;
};

export const PropertiesContext = createContext<PropertiesContextType>({
  properties: [],
  newSessionId: '',
  newChatResetCount: 0,
  sessionTitles: {},
  activeSessions: [],
  startNewChat: () => {},
  deleteChatSession: async () => {},
  recordChatActivity: () => {},
  refreshThreads: () => {},
});

export const Agent: FC<{ children: ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState([]);
  const [newSessionId, setNewSessionId] = useState(() => makeId(20));
  const [newChatResetCount, setNewChatResetCount] = useState(0);
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>(
    () => {
      if (typeof window === 'undefined') return {};
      try {
        const stored = window.sessionStorage.getItem(CHAT_TITLES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }
  );
  const [activeSessions, setActiveSessions] = useState<RecentThreadItem[]>(
    () => {
      if (typeof window === 'undefined') return [];
      try {
        const stored = window.sessionStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
  );

  const fetch = useFetch();
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  const refreshThreads = useCallback(() => {
    mutate('threads');
  }, [mutate]);

  const deleteChatSession = useCallback(
    async (threadId: string) => {
      if (!threadId) return;

      // Optimistically update local active sessions state & session storage
      setActiveSessions((prev) => {
        const next = prev.filter((s) => s.id !== threadId);
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(
              CHAT_SESSIONS_STORAGE_KEY,
              JSON.stringify(next)
            );
          } catch {}
        }
        return next;
      });

      // Optimistically clean stored titles
      setSessionTitles((prev) => {
        const next = { ...prev };
        delete next[threadId];
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(
              CHAT_TITLES_STORAGE_KEY,
              JSON.stringify(next)
            );
          } catch {}
        }
        return next;
      });

      // Optimistically update SWR threads cache
      mutate(
        'threads',
        (current: any) => {
          if (!current?.threads) return current;
          return {
            ...current,
            threads: current.threads.filter((t: any) => t.id !== threadId),
          };
        },
        false
      );

      // Perform backend deletion
      try {
        await fetch(`/copilot/${threadId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete thread on server:', err);
      }

      mutate('threads');

      // If the currently viewed thread was deleted, transition to a new chat
      if (pathname.includes(threadId)) {
        startNewChat();
      }
    },
    [fetch, mutate, pathname]
  );

  const recordChatActivity = useCallback(
    (threadId: string, promptText?: string) => {
      if (!threadId) return;
      const snippet = summarizePrompt(promptText);

      if (snippet) {
        setSessionTitles((prev) => {
          if (prev[threadId]) return prev;
          const next = { ...prev, [threadId]: snippet };
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.setItem(
                CHAT_TITLES_STORAGE_KEY,
                JSON.stringify(next)
              );
            } catch {
              // Ignore storage quota errors
            }
          }
          return next;
        });
      }

      setActiveSessions((prev) => {
        const existing = prev.find((s) => s.id === threadId);
        const updatedItem: RecentThreadItem = {
          id: threadId,
          title: existing?.title || snippet || 'New conversation',
          updatedAt: Date.now(),
        };
        const next = [
          updatedItem,
          ...prev.filter((s) => s.id !== threadId),
        ].slice(0, 50);
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(
              CHAT_SESSIONS_STORAGE_KEY,
              JSON.stringify(next)
            );
          } catch {
            // Ignore storage quota errors
          }
        }
        return next;
      });

      mutate('threads');
      setTimeout(() => mutate('threads'), 1500);
      setTimeout(() => mutate('threads'), 4000);
    },
    [mutate]
  );

  const startNewChat = useCallback(() => {
    setNewSessionId(makeId(20));
    setNewChatResetCount((c) => c + 1);
    mutate('threads');
    if (pathname !== '/agents/new') {
      router.push('/agents/new');
    }
  }, [mutate, pathname, router]);

  const contextValue = useMemo(
    () => ({
      properties,
      newSessionId,
      newChatResetCount,
      sessionTitles,
      activeSessions,
      startNewChat,
      deleteChatSession,
      recordChatActivity,
      refreshThreads,
    }),
    [
      properties,
      newSessionId,
      newChatResetCount,
      sessionTitles,
      activeSessions,
      startNewChat,
      deleteChatSession,
      recordChatActivity,
      refreshThreads,
    ]
  );

  return (
    <PropertiesContext.Provider value={contextValue}>
      <AgentList onChange={setProperties} />
      <div className="bg-newBgColorInner flex flex-1 mobile:order-3 mobile:min-h-[500px]">
        {children}
      </div>
      <Threads />
    </PropertiesContext.Provider>
  );
};

const Threads: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const {
    newSessionId,
    sessionTitles,
    activeSessions,
    startNewChat,
    deleteChatSession,
    refreshThreads,
  } = useContext(PropertiesContext);

  const threads = useCallback(async () => {
    const res = await fetch('/copilot/list');
    if (!res.ok) return { threads: [] };
    return res.json();
  }, [fetch]);

  const { data, isValidating } = useSWR('threads', threads, {
    revalidateOnFocus: true,
    revalidateOnMount: true,
    refreshInterval: 15000,
  });

  const effectiveActiveId = id === 'new' ? newSessionId : id;

  const mergedThreads = useMemo(() => {
    const serverThreads: Array<{
      id: string;
      title?: string;
      createdAt?: string | number;
      updatedAt?: string | number;
    }> = data?.threads || [];
    const seen = new Set<string>();
    const result: Array<{
      id: string;
      title: string;
      isActive: boolean;
      timestamp?: string | number;
    }> = [];

    // Include optimistic/active sessions from the current session first if not yet on server
    for (const local of activeSessions) {
      const matchingServer = serverThreads.find((s) => s.id === local.id);
      if (!matchingServer && !seen.has(local.id)) {
        seen.add(local.id);
        result.push({
          id: local.id,
          title:
            sessionTitles[local.id] || local.title || 'New conversation',
          isActive: local.id === effectiveActiveId,
          timestamp: local.updatedAt || local.createdAt || Date.now(),
        });
      }
    }

    for (const item of serverThreads) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      const serverTitle = (item.title || '').trim();
      const fallbackTitle =
        sessionTitles[item.id] ||
        activeSessions.find((s) => s.id === item.id)?.title ||
        'Untitled conversation';
      const localMatch = activeSessions.find((s) => s.id === item.id);
      result.push({
        id: item.id,
        title: serverTitle || fallbackTitle,
        isActive: item.id === effectiveActiveId,
        timestamp:
          item.updatedAt ||
          item.createdAt ||
          localMatch?.updatedAt ||
          localMatch?.createdAt,
      });
    }

    return result;
  }, [data?.threads, activeSessions, sessionTitles, effectiveActiveId]);

  const isBrandNewUnsavedSession =
    id === 'new' &&
    !!newSessionId &&
    !mergedThreads.some((item) => item.id === newSessionId);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner border-s border-newTableBorder/60 flex flex-col gap-[15px] transition-all relative',
        'w-[270px] mobile:w-full mobile:order-2 mobile:border-s-0 mobile:border-b'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[18px] mobile:p-[12px] mobile:static mobile:h-auto flex flex-col gap-[14px] mobile:flex-row mobile:items-center overflow-hidden">
        <div className="justify-center flex mobile:shrink-0">
          <button
            type="button"
            onClick={startNewChat}
            className="text-white whitespace-nowrap flex-1 px-[16px] min-h-[42px] max-h-[42px] rounded-[10px] bg-btnPrimary hover:opacity-95 active:scale-[0.99] transition-all flex justify-center items-center gap-[8px] cursor-pointer shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 21 20"
              fill="none"
              className="shrink-0"
            >
              <path
                d="M10.5001 4.16699V15.8337M4.66675 10.0003H16.3334"
                stroke="white"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[14.5px] font-[600]">
              {t('start_a_new_chat', 'Start a new chat')}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between px-[4px] mobile:hidden">
          <span className="text-[11.5px] font-[600] uppercase tracking-wider text-textColor/55">
            {t('recent_chats', 'Recent Chats')}
          </span>
          <div className="flex items-center gap-[6px]">
            {mergedThreads.length > 0 && (
              <span className="text-[11px] px-[6px] py-[1px] rounded-full bg-newBgColor text-textColor/65 border border-newTableBorder">
                {mergedThreads.length + (isBrandNewUnsavedSession ? 1 : 0)}
              </span>
            )}
            <button
              type="button"
              onClick={refreshThreads}
              title="Refresh recent chats"
              className="w-[22px] h-[22px] rounded-[6px] hover:bg-newBgColor text-textColor/55 hover:text-textColor flex items-center justify-center cursor-pointer transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                className={clsx(isValidating && 'animate-spin')}
              >
                <path
                  d="M13.5 8A5.5 5.5 0 1 1 11.88 4.11M13.5 2.5V5.5H10.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mobile:overflow-x-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor flex flex-col gap-[4px] mobile:flex-row mobile:gap-[6px] pe-[2px]">
          {isBrandNewUnsavedSession && (
            <div className="flex items-center gap-[8px] px-[10px] py-[8px] rounded-[10px] bg-newBgColor border border-btnPrimary/40 text-textColor mobile:shrink-0">
              <span className="w-[7px] h-[7px] rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span className="flex-1 text-[13.5px] font-[500] truncate">
                {t('new_chat_session', 'New Chat')}
              </span>
              <span className="text-[10px] font-[600] uppercase px-[6px] py-[1px] rounded bg-btnPrimary/20 text-textColor/85 border border-btnPrimary/30">
                Active
              </span>
            </div>
          )}

          {mergedThreads.map((p) => {
            const timeLabel = formatChatTimestamp(p.timestamp);
            return (
              <Link
                className={clsx(
                  'group flex items-center gap-[8px] px-[10px] py-[8px] rounded-[10px] text-[13.5px] transition-all cursor-pointer mobile:shrink-0 mobile:max-w-[200px] border relative',
                  p.isActive
                    ? 'bg-newBgColor border-btnPrimary/45 text-textColor font-[500]'
                    : 'border-transparent hover:bg-newBgColor/70 hover:border-newTableBorder text-textColor/80 hover:text-textColor'
                )}
                href={`/agents/${p.id}`}
                key={p.id}
                title={p.title}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={clsx(
                    'shrink-0 transition-opacity mt-[1px]',
                    p.isActive
                      ? 'text-btnPrimary opacity-100'
                      : 'text-textColor/45 group-hover:text-textColor/75'
                  )}
                >
                  <path
                    d="M2.5 4.5C2.5 3.67157 3.17157 3 4 3H12C12.8284 3 13.5 3.67157 13.5 4.5V9.5C13.5 10.3284 12.8284 11 12 11H6L3 13.5V11C2.72386 11 2.5 10.7761 2.5 10.5V4.5Z"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinejoin="round"
                  />
                </svg>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <span className="overflow-ellipsis overflow-hidden whitespace-nowrap text-[13px] leading-snug">
                    {p.title}
                  </span>
                  {timeLabel && (
                    <span className="text-[10.5px] text-textColor/45 leading-tight group-hover:text-textColor/60 transition-colors">
                      {timeLabel}
                    </span>
                  )}
                </div>

                {p.isActive && (
                  <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 shrink-0" />
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteChatSession(p.id);
                  }}
                  title={t('delete_chat', 'Delete conversation')}
                  className="opacity-0 group-hover:opacity-100 p-[3px] rounded-[5px] hover:bg-red-500/20 hover:text-red-400 text-textColor/40 transition-all shrink-0 cursor-pointer"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M2.5 4H13.5M5.5 4V2.667C5.5 2.298 5.798 2 6.167 2H9.833C10.202 2 10.5 2.298 10.5 2.667V4M12.167 4V13.333C12.167 13.702 11.869 14 11.5 14H4.5C4.131 14 3.833 13.702 3.833 13.333V4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.5 7V11M9.5 7V11"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </Link>
            );
          })}

          {!isBrandNewUnsavedSession && mergedThreads.length === 0 && (
            <div className="px-[10px] py-[16px] text-center text-[12.5px] text-textColor/45 mobile:py-[4px]">
              {t('no_recent_chats', 'No previous chats yet')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
