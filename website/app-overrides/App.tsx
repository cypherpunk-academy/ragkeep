import { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Layout } from './components/Layout';
import { AgentListPage } from './pages/AgentListPage';
import { AgentDetailPage } from './pages/AgentDetailPage';
import type { Agent } from "./types";

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      Lade Assistenten-Daten...
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Daten konnten nicht geladen werden</h2>
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadAgents() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/assistants.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as Agent[];
        if (!isCancelled) {
          setAgents(payload);
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : "Unbekannter Fehler";
          setError(message);
          setIsLoading(false);
        }
      }
    }

    loadAgents();
    return () => {
      isCancelled = true;
    };
  }, []);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<AgentListPage agents={agents} />} />
          <Route path="agent/:id" element={<AgentDetailPage agents={agents} />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
