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
  // Extra fields for the requested tabs that weren't in the YAML but are in the requirements
  quotes?: string[];
  taxonomies?: string[];
  conversations?: Conversation[];
  avatarUrl?: string;
}

export interface Conversation {
  id: string;
  title: string;
  date: string;
  snippet: string;
}

export interface ParsedBook {
  author: string;
  title: string;
  id: string;
}

export const parseBookString = (bookStr: string): ParsedBook => {
  const parts = bookStr.split('#');
  if (parts.length >= 3) {
    return {
      author: parts[0].replace(/_/g, ' '),
      title: parts[1].replace(/_/g, ' '),
      id: parts[2]
    };
  }
  return {
    author: 'Unknown',
    title: bookStr,
    id: ''
  };
};
