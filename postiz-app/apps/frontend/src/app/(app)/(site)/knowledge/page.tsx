export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { KnowledgeManager } from '@gitroom/frontend/components/agents/knowledge/knowledge.manager';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Knowledge Base`,
  description: 'Manage brand guidelines, channel briefs, and compliance documents for Agentic RAG',
};

export default async function KnowledgePage() {
  return (
    <div className="flex-1 w-full max-w-[1400px] mx-auto py-6 px-4 md:px-8">
      <KnowledgeManager />
    </div>
  );
}
