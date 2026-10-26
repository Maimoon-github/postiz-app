import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';

export interface KnowledgeItem {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  summary: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  version: number;
  contentHash: string;
  channelIdentifiers: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    chunks: number;
  };
}

export interface KnowledgeListResponse {
  items: KnowledgeItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const useKnowledgeList = (params?: {
  status?: string;
  search?: string;
  channel?: string;
  page?: number;
}) => {
  const fetch = useFetch();
  return useSWR<KnowledgeListResponse>(
    ['/knowledge', params?.status, params?.search, params?.channel, params?.page],
    async () => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.search) query.append('search', params.search);
      if (params?.channel) query.append('channel', params.channel);
      if (params?.page) query.append('page', params.page.toString());
      const res = await fetch(`/knowledge?${query.toString()}`);
      return res.json();
    }
  );
};

export const useKnowledgeItem = (id?: string | null) => {
  const fetch = useFetch();
  return useSWR<KnowledgeItem>(
    id ? `/knowledge/${id}` : null,
    async () => {
      const res = await fetch(`/knowledge/${id}`);
      return res.json();
    }
  );
};

export const useKnowledgeMutations = () => {
  const fetch = useFetch();

  const saveKnowledge = useCallback(
    async (payload: {
      id?: string;
      title: string;
      content: string;
      channelIdentifiers?: string[];
      tags?: string[];
      status?: 'DRAFT' | 'PUBLISHED';
    }) => {
      return fetch('/knowledge', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    [fetch]
  );

  const updateStatus = useCallback(
    async (id: string, status: 'DRAFT' | 'PUBLISHED') => {
      return fetch(`/knowledge/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
    [fetch]
  );

  const deleteKnowledge = useCallback(
    async (id: string) => {
      return fetch(`/knowledge/${id}`, {
        method: 'DELETE',
      });
    },
    [fetch]
  );

  return {
    saveKnowledge,
    updateStatus,
    deleteKnowledge,
  };
};
