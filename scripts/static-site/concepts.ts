import fs from "node:fs";
import path from "node:path";
import type { Agent } from "./types";
import { fileExists } from "./utils";

export interface ConceptReference {
  chunk_id: string;
  description: string;
  relevance: number;
}

export interface ConceptEntry {
  segmentTitle: string;
  text: string;
  references?: ConceptReference[];
}

interface JsonlLine {
  text?: string;
  segment_title?: string;
  metadata?: {
    segment_title?: string;
    references?: Array<{ chunk_id: string; description: string; relevance: number }>;
  };
}

export function parseConceptsJsonl(filePath: string): ConceptEntry[] {
  if (!fileExists(filePath)) return [];
  const entries: ConceptEntry[] = [];
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as JsonlLine;
        const text = String(obj.text ?? "").trim();
        const segmentTitle =
          String(
            obj.metadata?.segment_title ?? obj.segment_title ?? ""
          ).trim() || "(Ohne Titel)";
        const rawRefs = obj.metadata?.references ?? [];
        const references = rawRefs
          .filter(
            (r): r is { chunk_id: string; description: string; relevance: number } =>
              r != null &&
              typeof (r as { chunk_id?: unknown }).chunk_id === "string" &&
              typeof (r as { description?: unknown }).description === "string" &&
              typeof (r as { relevance?: unknown }).relevance === "number"
          )
          .map((r) => ({ chunk_id: r.chunk_id, description: r.description, relevance: r.relevance }));
        if (text) {
          entries.push({
            segmentTitle,
            text,
            ...(references.length > 0 && { references }),
          });
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // skip file read errors
  }
  return entries;
}

export function collectConcepts(
  repoRoot: string,
  agent: Agent
): Map<string, ConceptEntry[]> {
  const result = new Map<string, ConceptEntry[]>();
  const conceptsDir = path.join(repoRoot, "assistants", agent.id, "concepts");

  for (const conceptFile of agent.concepts) {
    if (!conceptFile.endsWith(".jsonl")) continue;
    const filePath = path.join(conceptsDir, conceptFile);
    const entries = parseConceptsJsonl(filePath);
    if (entries.length > 0) {
      result.set(conceptFile, entries);
    }
  }

  return result;
}

export function getConceptFileLabel(fileName: string, agentName: string): string {
  if (fileName === "concepts.jsonl") {
    return agentName;
  }
  const match = fileName.match(/^(.+)-concepts\.jsonl$/);
  if (match) {
    const name = match[1] ?? "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return fileName;
}
