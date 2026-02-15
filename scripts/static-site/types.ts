export interface Conversation {
  id: string;
  title: string;
  date: string;
  snippet: string;
}

export interface Agent {
  id: string;
  name: string;
  ragCollection: string;
  description: string;
  writingStyle: string;
  primaryBooks: string[];
  secondaryBooks: string[];
  concepts: string[];
  essays: string[];
  quotes: string[];
  taxonomies: string[];
  conversations: Conversation[];
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
