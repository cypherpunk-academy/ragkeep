import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { Agent, Conversation } from "./types";
import { fileExists, normalizeBookId } from "./utils";

interface AssistantManifest {
  name?: string;
  "rag-collection"?: string;
  description?: string;
  "writing-style"?: string;
  "primary-books"?: string[];
  "secondary-books"?: string[];
  concepts?: string[];
  essays?: string[];
  quotes?: string[];
  taxonomies?: string[];
  conversations?: Conversation[];
  "cover-image"?: string;
  "avatar-image"?: string;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function toConversationArray(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      return {
        id: String(obj.id ?? `conversation-${idx + 1}`),
        title: String(obj.title ?? `Gespräch ${idx + 1}`),
        date: String(obj.date ?? ""),
        snippet: String(obj.snippet ?? ""),
      };
    })
    .filter((item): item is Conversation => item !== null);
}

function normalizeAgent(input: Partial<Agent> & { id: string }): Agent {
  const id = input.id;
  return {
    id,
    name: input.name ?? id,
    ragCollection: input.ragCollection ?? id,
    description: (input.description ?? "").replace(/\s+/g, " ").trim(),
    writingStyle: (input.writingStyle ?? "").replace(/\s+/g, " ").trim(),
    primaryBooks: (input.primaryBooks ?? []).map(normalizeBookId),
    secondaryBooks: (input.secondaryBooks ?? []).map(normalizeBookId),
    concepts: input.concepts ?? [],
    essays: input.essays ?? [],
    quotes: input.quotes ?? [],
    taxonomies: input.taxonomies ?? [],
    conversations: input.conversations ?? [],
    avatarUrl: input.avatarUrl,
    coverUrl: input.coverUrl,
  };
}

function mergeManifestFields(agent: Agent, manifestPath: string): Agent {
  if (!fileExists(manifestPath)) return agent;
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = (yaml.load(raw) as AssistantManifest | null) ?? {};

  const coverImage = manifest["cover-image"];
  const avatarImage = manifest["avatar-image"];

  return normalizeAgent({
    ...agent,
    name: manifest.name ?? agent.name,
    ragCollection: manifest["rag-collection"] ?? agent.ragCollection,
    description: manifest.description ?? agent.description,
    writingStyle: manifest["writing-style"] ?? agent.writingStyle,
    primaryBooks:
      manifest["primary-books"]?.map(normalizeBookId) ?? agent.primaryBooks,
    secondaryBooks:
      manifest["secondary-books"]?.map(normalizeBookId) ?? agent.secondaryBooks,
    concepts: manifest.concepts ?? agent.concepts,
    essays: manifest.essays ?? agent.essays,
    quotes: toStringArray(manifest.quotes) ?? agent.quotes,
    taxonomies: toStringArray(manifest.taxonomies) ?? agent.taxonomies,
    conversations:
      toConversationArray(manifest.conversations) ?? agent.conversations,
    coverUrl: coverImage ? `assistants/${agent.id}/${coverImage}` : agent.coverUrl,
    avatarUrl: avatarImage
      ? `assistants/${agent.id}/${avatarImage}`
      : agent.avatarUrl,
  });
}

function readAssistantsFromJson(repoRoot: string): Agent[] {
  const assistantsJsonPath = path.join(repoRoot, "site", "data", "assistants.json");
  if (!fileExists(assistantsJsonPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(assistantsJsonPath, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const obj = entry as Record<string, unknown>;
        const id = String(obj.id ?? "").trim();
        if (!id) return null;
        return normalizeAgent({
          id,
          name: String(obj.name ?? id),
          ragCollection: String(obj.ragCollection ?? id),
          description: String(obj.description ?? ""),
          writingStyle: String(obj.writingStyle ?? ""),
          primaryBooks: toStringArray(obj.primaryBooks),
          secondaryBooks: toStringArray(obj.secondaryBooks),
          concepts: toStringArray(obj.concepts),
          essays: toStringArray(obj.essays),
          quotes: toStringArray(obj.quotes),
          taxonomies: toStringArray(obj.taxonomies),
          conversations: toConversationArray(obj.conversations),
          avatarUrl: obj.avatarUrl ? String(obj.avatarUrl) : undefined,
          coverUrl: obj.coverUrl ? String(obj.coverUrl) : undefined,
        });
      })
      .filter((agent): agent is Agent => agent !== null);
  } catch {
    return [];
  }
}

function readAssistantsFromManifests(repoRoot: string): Agent[] {
  const assistantsDir = path.join(repoRoot, "assistants");
  if (!fileExists(assistantsDir)) return [];
  const entries = fs.readdirSync(assistantsDir, { withFileTypes: true });
  const assistants: Agent[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    const manifestPath = path.join(assistantsDir, id, "assistant-manifest.yaml");
    if (!fileExists(manifestPath)) continue;
    const merged = mergeManifestFields(
      normalizeAgent({
        id,
        name: id,
        ragCollection: id,
        description: "",
        writingStyle: "",
        primaryBooks: [],
        secondaryBooks: [],
      }),
      manifestPath
    );
    assistants.push(merged);
  }
  return assistants;
}

export function loadAssistants(repoRoot: string): Agent[] {
  const assistantsDir = path.join(repoRoot, "assistants");
  const fromJson = readAssistantsFromJson(repoRoot);
  if (fromJson.length === 0) return readAssistantsFromManifests(repoRoot);

  return fromJson
    .map((agent) =>
      mergeManifestFields(
        agent,
        path.join(assistantsDir, agent.id, "assistant-manifest.yaml")
      )
    )
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function copyAssistantFiles(repoRoot: string, outputDir: string, agents: Agent[]): void {
  const foldersToCopy = ["assets", "essays", "concepts", "taxonomies", "conversations"];
  for (const agent of agents) {
    for (const folderName of foldersToCopy) {
      const source = path.join(repoRoot, "assistants", agent.id, folderName);
      if (!fileExists(source)) continue;
      const destination = path.join(outputDir, "assistants", agent.id, folderName);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.cpSync(source, destination, { recursive: true });
    }
  }
}
