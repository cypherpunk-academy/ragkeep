import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Book,
  FileText,
  Lightbulb,
  Quote,
  Network,
  MessageSquare,
  ScrollText,
  ArrowLeft,
  BookOpen,
  User,
} from 'lucide-react';
import { ImageWithFallback } from '../atoms/ImageWithFallback';
import { clsx } from 'clsx';
import type { Agent } from '../../data/types';
import { parseBookString } from '../../utils/parseBookString';

const BASE_URL = import.meta.env.BASE_URL;

export function AgentTabs({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
        <div className="w-32 h-32 flex-shrink-0 rounded-full overflow-hidden border-4 border-indigo-50 shadow-md">
          {agent.avatarUrl ? (
            <ImageWithFallback
              src={`${BASE_URL}${agent.avatarUrl}`}
              alt={agent.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-400">
              <User size={48} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600 mb-2 transition-colors"
          >
            <ArrowLeft size={14} className="mr-1" /> Zurück zur Liste
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{agent.name}</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium border border-indigo-100">
              Collection: {agent.ragCollection}
            </span>
            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium border border-gray-200">
              {agent.primaryBooks.length + agent.secondaryBooks.length} Bücher insgesamt
            </span>
          </div>
        </div>
      </div>

      {/* Tabs System */}
      <Tabs.Root defaultValue="overview" className="flex flex-col space-y-6">
        <Tabs.List className="flex flex-wrap gap-2 border-b border-gray-200 pb-1 overflow-x-auto no-scrollbar">
          <TabTrigger value="overview" icon={<FileText size={16} />} label="Übersicht" />
          <TabTrigger value="primary-books" icon={<Book size={16} />} label="Bücher" />
          <TabTrigger value="secondary-books" icon={<BookOpen size={16} />} label="Sekundärliteratur" />
          <TabTrigger value="essays" icon={<ScrollText size={16} />} label="Essays" />
          <TabTrigger value="concepts" icon={<Lightbulb size={16} />} label="Begriffe" />
          <TabTrigger value="quotes" icon={<Quote size={16} />} label="Zitate" />
          <TabTrigger value="taxonomies" icon={<Network size={16} />} label="Taxonomien" />
          <TabTrigger value="conversations" icon={<MessageSquare size={16} />} label="Gespräche" />
        </Tabs.List>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 min-h-[400px]">
          <Tabs.Content value="overview" className="space-y-8 outline-none animate-in slide-in-from-bottom-2 duration-300">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={20} className="text-indigo-500" />
                Beschreibung
              </h3>
              <p className="text-gray-700 leading-relaxed max-w-4xl">{agent.description}</p>
            </section>
            <div className="h-px bg-gray-100" />
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-500" />
                Schreibstil
              </h3>
              <p className="text-gray-700 leading-relaxed max-w-4xl italic bg-gray-50 p-6 rounded-xl border border-gray-100">
                &quot;{agent.writingStyle}&quot;
              </p>
            </section>
          </Tabs.Content>

          <Tabs.Content value="primary-books" className="space-y-8 outline-none animate-in slide-in-from-bottom-2 duration-300">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-6 border-l-4 border-indigo-500 pl-4">
                Primärliteratur
              </h3>
              <BookList books={agent.primaryBooks} />
            </div>
          </Tabs.Content>

          <Tabs.Content value="secondary-books" className="space-y-8 outline-none animate-in slide-in-from-bottom-2 duration-300">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-6 border-l-4 border-slate-400 pl-4">
                Sekundärliteratur
              </h3>
              <BookList books={agent.secondaryBooks} isSecondary />
            </div>
          </Tabs.Content>

          <Tabs.Content value="essays" className="outline-none animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Verfügbare Essays</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agent.essays.map((essay, idx) => (
                <a
                  key={idx}
                  href={`${BASE_URL}assistants/${encodeURIComponent(agent.id)}/essays/${encodeURIComponent(essay)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer flex items-start gap-3"
                >
                  <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <ScrollText size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 break-all">{essay}</h4>
                    <p className="text-xs text-gray-500 mt-1">Essay • .essay Format • Öffnen</p>
                  </div>
                </a>
              ))}
            </div>
          </Tabs.Content>

          <Tabs.Content value="concepts" className="outline-none animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Begriffskonzepte (JSONL)</h3>
            <div className="space-y-3">
              {agent.concepts.map((concept, idx) => (
                <a
                  key={idx}
                  href={`${BASE_URL}assistants/${encodeURIComponent(agent.id)}/concepts/${encodeURIComponent(concept)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 font-mono text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Lightbulb size={16} className="text-yellow-500 flex-shrink-0" />
                  {concept}
                </a>
              ))}
            </div>
          </Tabs.Content>

          <Tabs.Content value="quotes" className="outline-none animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Zitate</h3>
            <div className="grid gap-6">
              {agent.quotes?.map((quote, idx) => (
                <blockquote
                  key={idx}
                  className="relative p-6 bg-amber-50 rounded-xl border-l-4 border-amber-400 shadow-sm"
                >
                  <Quote size={24} className="text-amber-300 absolute top-4 left-4 opacity-50" />
                  <p className="text-lg text-gray-800 font-serif italic relative z-10 pl-8">
                    &quot;{quote}&quot;
                  </p>
                </blockquote>
              )) || <p className="text-gray-500 italic">Keine Zitate verfügbar.</p>}
            </div>
          </Tabs.Content>

          <Tabs.Content value="taxonomies" className="outline-none animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Wissens-Taxonomien</h3>
            <div className="space-y-2">
              {agent.taxonomies?.map((tax, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-gray-700 bg-white border border-gray-200 p-3 rounded-lg shadow-sm"
                >
                  <Network size={16} className="text-blue-500" />
                  <span className="font-medium">{tax.split('>').join(' → ')}</span>
                </div>
              )) || <p className="text-gray-500 italic">Keine Taxonomien verfügbar.</p>}
            </div>
          </Tabs.Content>

          <Tabs.Content value="conversations" className="outline-none animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Gespeicherte Gespräche</h3>
            <div className="space-y-4">
              {agent.conversations?.map((conv) => (
                <div
                  key={conv.id}
                  className="p-5 rounded-xl border border-gray-200 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900 text-lg">{conv.title}</h4>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{conv.date}</span>
                  </div>
                  <p className="text-gray-600 line-clamp-2">{conv.snippet}</p>
                  <button className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                    Gespräch öffnen <ArrowLeft className="rotate-180" size={14} />
                  </button>
                </div>
              )) || <p className="text-gray-500 italic">Keine Gespräche gefunden.</p>}
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}

function TabTrigger({ value, icon, label }: { value: string; icon: ReactNode; label: string }) {
  return (
    <Tabs.Trigger
      value={value}
      className={clsx(
        'px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 outline-none select-none',
        'data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md',
        'data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100 data-[state=inactive]:hover:text-gray-900'
      )}
    >
      {icon}
      <span>{label}</span>
    </Tabs.Trigger>
  );
}

function BookList({ books, isSecondary = false }: { books: string[]; isSecondary?: boolean }) {
  if (books.length === 0) return <p className="text-gray-500 italic">Keine Bücher in dieser Kategorie.</p>;

  return (
    <div className="grid grid-cols-1 gap-4">
      {books.map((bookStr, idx) => {
        const book = parseBookString(bookStr);
        return (
          <a
            key={idx}
            href={`${BASE_URL}books/${encodeURIComponent(bookStr)}/index.html`}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-sm hover:border-indigo-100 transition-all duration-200"
          >
            <div
              className={clsx(
                'p-3 rounded-lg flex-shrink-0',
                isSecondary ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'
              )}
            >
              <Book size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 truncate pr-4" title={book.title}>
                {book.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                <User size={12} /> {book.author}
              </p>
              {book.id && (
                <span className="inline-block mt-2 text-xs font-mono text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
                  ID: {book.id}
                </span>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
