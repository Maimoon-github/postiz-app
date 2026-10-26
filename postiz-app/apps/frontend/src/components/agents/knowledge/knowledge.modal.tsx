'use client';

import React, { FC, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { KnowledgeItem, useKnowledgeMutations } from './use.knowledge';

interface KnowledgeModalProps {
  item?: KnowledgeItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const KnowledgeModal: FC<KnowledgeModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const { saveKnowledge } = useKnowledgeMutations();
  const [title, setTitle] = useState(item?.title || '');
  const [content, setContent] = useState(item?.content || '');
  const [channels, setChannels] = useState<string>(
    item?.channelIdentifiers?.join(', ') || ''
  );
  const [tags, setTags] = useState<string>(item?.tags?.join(', ') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (targetStatus: 'DRAFT' | 'PUBLISHED') => {
    if (!title.trim() || !content.trim()) {
      setError('Title and Content are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveKnowledge({
        id: item?.id,
        title: title.trim(),
        content: content.trim(),
        channelIdentifiers: channels
          .split(',')
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean),
        tags: tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        status: targetStatus,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save knowledge item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 text-white">
      <div className="flex items-center justify-between border-b border-gray-700 pb-3">
        <h3 className="text-lg font-semibold text-white">
          {item ? 'Edit Knowledge Resource' : 'Add Knowledge Resource'}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-sm"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-900/50 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 Brand Campaign Guidelines & Compliance"
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
            Document Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your source document, facts, tone of voice guidelines, or platform rules here..."
            rows={10}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Channels (comma-separated)
            </label>
            <input
              type="text"
              value={channels}
              onChange={(e) => setChannels(e.target.value)}
              placeholder="e.g. x, linkedin, instagram"
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. marketing, compliance, q3"
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-700 pt-4 mt-2">
        <Button
          type="button"
          onClick={onClose}
          className="bg-transparent hover:bg-gray-800 text-gray-300 border border-gray-700"
        >
          Cancel
        </Button>

        <Button
          type="button"
          disabled={loading}
          onClick={() => handleSubmit('DRAFT')}
          className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600"
        >
          {loading ? 'Saving...' : 'Save Draft'}
        </Button>

        <Button
          type="button"
          disabled={loading}
          onClick={() => handleSubmit('PUBLISHED')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
        >
          {loading ? 'Publishing...' : 'Publish & Embed'}
        </Button>
      </div>
    </div>
  );
};
