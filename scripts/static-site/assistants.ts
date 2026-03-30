import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { Agent } from "./types";
import { fileExists, normalizeBookId } from "./utils";

interface AssistantManifest {
  name?: string;
  "rag-collection"?: string;
  description?: string;
  "writing-style"?: string;
  "primary-books"?: string[];
  "primary-lectures"?: string[];
  "secondary-books"?: string[];
  "secondary-lectures"?: string[];
  concepts?: string[];
  essays?: string[];
  quotes?: string[];
  taxonomies?: string[];
  typologies?: string[];
  talks?: string[];
  "cover-image"?: string;
  "avatar-image"?: string;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
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
    primaryLectures: input.primaryLectures ?? [],
    secondaryBooks: (input.secondaryBooks ?? []).map(normalizeBookId),
    secondaryLectures: input.secondaryLectures ?? [],
    concepts: input.concepts ?? [],
    essays: input.essays ?? [],
    quotes: input.quotes ?? [],
    taxonomies: input.taxonomies ?? [],
    typologies: input.typologies ?? [],
    talks: input.talks ?? [],
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
    primaryLectures: toStringArray(manifest["primary-lectures"]) ?? agent.primaryLectures,
    secondaryBooks:
      manifest["secondary-books"]?.map(normalizeBookId) ?? agent.secondaryBooks,
    secondaryLectures:
      toStringArray(manifest["secondary-lectures"]) ?? agent.secondaryLectures,
    concepts: manifest.concepts ?? agent.concepts,
    essays: manifest.essays ?? agent.essays,
    quotes: toStringArray(manifest.quotes) ?? agent.quotes,
    taxonomies: toStringArray(manifest.taxonomies) ?? agent.taxonomies,
    typologies:
      manifest.typologies !== undefined
        ? toStringArray(manifest.typologies)
        : agent.typologies,
    talks:
      manifest.talks !== undefined
        ? toStringArray(manifest.talks)
        : agent.talks,
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
          primaryLectures: toStringArray(obj.primaryLectures),
          secondaryBooks: toStringArray(obj.secondaryBooks),
          secondaryLectures: toStringArray(obj.secondaryLectures),
          concepts: toStringArray(obj.concepts),
          essays: toStringArray(obj.essays),
          quotes: toStringArray(obj.quotes),
          taxonomies: toStringArray(obj.taxonomies),
          typologies: toStringArray(obj.typologies),
          talks: toStringArray(obj.talks),
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
        primaryLectures: [],
        secondaryBooks: [],
        secondaryLectures: [],
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
  const foldersToCopy = ["assets", "essays", "concepts", "typologies", "taxonomies", "talks"];
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
