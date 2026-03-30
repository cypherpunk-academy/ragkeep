export interface Agent {
  id: string;
  name: string;
  ragCollection: string;
  description: string;
  writingStyle: string;
  primaryBooks: string[];
  primaryLectures: string[];
  secondaryBooks: string[];
  secondaryLectures: string[];
  concepts: string[];
  essays: string[];
  quotes: string[];
  taxonomies: string[];
  /** JSONL-Dateinamen unter assistants/<id>/typologies/chunks/ (wie bei concepts) */
  typologies: string[];
  /** Dateinamen unter assistants/<id>/talks/ (z. B. *.md), analog chunk_type „talk“. */
  talks: string[];
  avatarUrl?: string;
  coverUrl?: string;
}

export interface Book {
  dirName: string;
  absBookDir: string;
  absHtmlDir: string;
  relOutputDir: string;
  author: string;
  title: string;
  subtitle: string;
}
