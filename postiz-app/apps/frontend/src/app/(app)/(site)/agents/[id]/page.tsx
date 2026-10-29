import { Metadata } from 'next';
import { Agent } from '@gitroom/frontend/components/agents/agent';
import { AgentChat } from '@gitroom/frontend/components/agents/agent.chat';
export const metadata: Metadata = {
  title: 'Postiz - Agent',
  description: '',
};
export default async function Page(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <AgentChat key={id} id={id} />;
}
