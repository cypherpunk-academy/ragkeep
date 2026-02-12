import { Link } from 'react-router-dom';
import { BookOpen, User, FileText, ArrowRight } from 'lucide-react';
import type { Agent } from "../types";

export const AgentListPage = ({ agents }: { agents: Agent[] }) => {
  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Wähle deinen KI-Assistenten
        </h1>
        <p className="text-lg text-gray-600">
          Erkunde unsere kuratierte Sammlung spezialisierter KI-Agenten, jeder mit eigenem Wissen, Stil und Fokus.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
        {agents.map((agent) => (
          <Link 
            key={agent.id} 
            to={`/agent/${agent.id}`}
            className="group relative flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:border-indigo-300 transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="h-48 w-full overflow-hidden bg-gray-100 relative">
              {agent.coverUrl ? (
                <img
                  src={`${import.meta.env.BASE_URL}${agent.coverUrl}`}
                  alt={`${agent.name} Cover`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : agent.avatarUrl ? (
                <img 
                  src={`${import.meta.env.BASE_URL}${agent.avatarUrl}`}
                  alt={agent.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
                  <User size={64} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="text-xl font-bold">{agent.name}</h3>
                <p className="text-indigo-200 text-sm font-medium opacity-90">{agent.ragCollection}</p>
              </div>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              <p className="text-gray-600 line-clamp-3 mb-6 text-sm leading-relaxed">
                {agent.description}
              </p>
              
              <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} className="text-indigo-500" />
                    {agent.primaryBooks.length + agent.secondaryBooks.length} Bücher
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={14} className="text-indigo-500" />
                    {agent.essays.length} Essays
                  </span>
                </div>
                <ArrowRight size={16} className="text-indigo-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
