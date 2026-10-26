'use client';

import React, { FC, useState } from 'react';
import {
  KnowledgeItem,
  useKnowledgeList,
  useKnowledgeMutations,
} from './use.knowledge';
import { KnowledgeModal } from './knowledge.modal';
import { Button } from '@gitroom/react/form/button';

export const KnowledgeManager: FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, mutate, isLoading } = useKnowledgeList({
    status: statusFilter,
    search: search.trim() || undefined,
  });

  const { updateStatus, deleteKnowledge } = useKnowledgeMutations();

  const handleToggleStatus = async (item: KnowledgeItem) => {
    const nextStatus = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    await updateStatus(item.id, nextStatus);
    mutate();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this knowledge resource?')) {
      await deleteKnowledge(id);
      mutate();
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-800 bg-gray-950/80 p-5 text-white shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Knowledge Base & Agentic RAG</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              7-Layer CRAG
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Manage authoritative brand guidelines, channel briefs, and compliance documents for AI generation.
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedItem(null);
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-4 py-2 rounded-lg"
        >
          + Add Knowledge
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter(undefined)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              !statusFilter
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({data?.total || 0})
          </button>
          <button
            onClick={() => setStatusFilter('PUBLISHED')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              statusFilter === 'PUBLISHED'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Published
          </button>
          <button
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              statusFilter === 'DRAFT'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Drafts
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title or tag..."
          className="rounded-lg border border-gray-800 bg-gray-900/90 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none w-56"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800/80 bg-gray-900/40">
        <table className="w-full text-left text-xs text-gray-300">
          <thead className="bg-gray-900/80 text-gray-400 uppercase tracking-wider border-b border-gray-800">
            <tr>
              <th className="px-4 py-3">Title & Summary</th>
              <th className="px-3 py-3">Channels</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Version</th>
              <th className="px-3 py-3">Chunks</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading knowledge items...
                </td>
              </tr>
            ) : !data?.items?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No knowledge resources found. Click "+ Add Knowledge" to create your first document.
                </td>
              </tr>
            ) : (
              data.items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-800/30 transition group"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{item.title}</div>
                    {item.summary && (
                      <div className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                        {item.summary}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {item.channelIdentifiers?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {item.channelIdentifiers.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-300 uppercase"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-[11px]">All Channels</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                        item.status === 'PUBLISHED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-gray-400">
                    v{item.version}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-gray-400">
                    {item._count?.chunks || 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        title={
                          item.status === 'PUBLISHED'
                            ? 'Revert to Draft'
                            : 'Publish and Index'
                        }
                        className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800/80 hover:bg-gray-700"
                      >
                        {item.status === 'PUBLISHED' ? 'To Draft' : 'Publish'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setIsModalOpen(true);
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-gray-800/80 hover:bg-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded bg-gray-800/80 hover:bg-gray-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-950 shadow-2xl">
            <KnowledgeModal
              item={selectedItem}
              onClose={() => setIsModalOpen(false)}
              onSuccess={() => mutate()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
