import { z } from "zod";
import { check } from "@/lib/server/check";
import { KINDS } from "./items";
import type { LibraryStore } from "./store";

export interface Reply {
  status: number;
  body: unknown;
}

export const saveSchema = z.object({
  kind: z.enum(KINDS),
  name: z.string().trim().min(1, "Give it a name.").max(120, "That name is too long."),
  content: z.record(z.string(), z.unknown()),
});

const MISSING = { status: 404, body: { error: "That is not in your library." } };

export async function listHandler(store: LibraryStore, owner: string): Promise<Reply> {
  return { status: 200, body: { items: await store.list(owner) } };
}

export async function getHandler(store: LibraryStore, owner: string, id: string): Promise<Reply> {
  const content = await store.get(owner, id);
  return content === null ? MISSING : { status: 200, body: { content } };
}

export async function saveHandler(store: LibraryStore, owner: string, body: unknown): Promise<Reply> {
  const input = check(saveSchema, body);
  if (!input.ok) return { status: 400, body: { error: input.error } };
  const item = await store.save(owner, input.value.kind, input.value.name, input.value.content);
  return { status: 200, body: { item } };
}

export async function removeHandler(store: LibraryStore, owner: string, id: string): Promise<Reply> {
  return (await store.remove(owner, id)) ? { status: 200, body: { removed: id } } : MISSING;
}
