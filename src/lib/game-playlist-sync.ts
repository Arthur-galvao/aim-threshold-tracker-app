import type { AppData, Playlist, PlaylistItem } from "./types.ts";
import { categorizeScenario, cleanScenarioName } from "./viscose.ts";

/**
 * TODO(T2.5): remove fallback.
 *
 * Fallback em TS para `sync_game_playlists` enquanto o Rust devolver "not_implemented":
 * usa os comandos `create_task` + `upsert_playlist` em sequência e lê o resultado do
 * snapshot DEPOIS dos awaits (nunca de dentro de um updater de setState).
 */

export interface GamePlaylistInput {
  name: string;
  items: Array<{ scenarioName: string; playCount: number }>;
}

/** O que o fallback precisa do backend / store (injetado para ser testável). */
export interface PlaylistSyncApi {
  getData(): AppData;
  createTask(name: string, category: string, subcategory: string): Promise<{ revision: number; taskId: string }>;
  upsertPlaylist(playlist: Playlist): Promise<{ revision: number; playlistId: string }>;
  setActiveTask(taskId: string | null): Promise<unknown>;
  waitForRevision(revision: number): Promise<void>;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Converte o formato cru do KovaaK's / Aim Lab em `GamePlaylistInput` (nomes limpos). */
export function fromRawKovaakPlaylists(
  raw: Array<{ playlistName: string; scenarioList: Array<{ scenarioName: string; playCount: number }> }>,
  cleanNames: boolean
): GamePlaylistInput[] {
  return raw.map((pl) => ({
    name: pl.playlistName.trim(),
    items: pl.scenarioList.map((item) => {
      const trimmed = item.scenarioName.trim();
      return {
        scenarioName: cleanNames && trimmed ? cleanScenarioName(trimmed) : trimmed,
        playCount: item.playCount,
      };
    }),
  }));
}

interface TaskResolver {
  resolve(name: string): Promise<string>;
  createdCount(): number;
  firstCreatedId(): string | null;
  lastRevision(): number;
}

function makeTaskResolver(api: PlaylistSyncApi): TaskResolver {
  const ids = new Map<string, string>();
  for (const task of api.getData().tasks) {
    const key = norm(task.name);
    if (!ids.has(key)) ids.set(key, task.id);
  }
  let created = 0;
  let firstCreated: string | null = null;
  let revision = 0;
  return {
    async resolve(name) {
      const key = norm(name);
      const existing = ids.get(key);
      if (existing) return existing;
      const { category, subcategory } = categorizeScenario(name.trim());
      const res = await api.createTask(name.trim(), category, subcategory);
      ids.set(key, res.taskId);
      created += 1;
      firstCreated ??= res.taskId;
      revision = Math.max(revision, res.revision);
      return res.taskId;
    },
    createdCount: () => created,
    firstCreatedId: () => firstCreated,
    lastRevision: () => revision,
  };
}

async function buildItems(
  resolver: TaskResolver,
  input: GamePlaylistInput
): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  for (const item of input.items) {
    const scenarioName = item.scenarioName.trim();
    if (!scenarioName) continue;
    const taskId = await resolver.resolve(scenarioName);
    items.push({
      id: "", // o Rust gera o id do item
      taskId,
      targetMode: "reps",
      targetValue: Math.max(1, Math.round(item.playCount || 1)),
    });
  }
  return items;
}

/** `create_task` torna a nova task ativa no Rust; devolve a ativa ao que o usuário tinha. */
async function restoreActiveTask(api: PlaylistSyncApi, resolver: TaskResolver, previous: string | null) {
  if (resolver.createdCount() === 0) return;
  const target = previous ?? api.getData().tasks[0]?.id ?? resolver.firstCreatedId();
  if (target) await api.setActiveTask(target);
}

/**
 * Sincroniza playlists de jogo: cria tasks que faltam, cria playlists novas e, nas que já
 * existem (por nome), refaz os itens preservando alvo por posição (lógica legada).
 */
export async function syncGamePlaylistsFallback(
  api: PlaylistSyncApi,
  inputs: GamePlaylistInput[]
): Promise<{ imported: number; lastRevision: number }> {
  const previousActive = api.getData().activeTaskId;
  const resolver = makeTaskResolver(api);
  const known = new Map<string, Playlist>();
  for (const pl of api.getData().playlists ?? []) known.set(norm(pl.name), pl);

  let imported = 0;
  let lastRevision = 0;

  for (const input of inputs) {
    const name = input.name.trim();
    if (!name) continue;
    const items = await buildItems(resolver, input);
    if (items.length === 0) continue;

    const existing = known.get(norm(name));
    if (existing) {
      const refreshed = items.map((item, i) => {
        const old = existing.items[i];
        return {
          ...item,
          targetMode: old?.targetMode ?? item.targetMode,
          targetValue: old?.targetValue ?? item.targetValue,
        };
      });
      const res = await api.upsertPlaylist({ ...existing, items: refreshed });
      lastRevision = Math.max(lastRevision, res.revision);
    } else {
      const draft: Playlist = { id: "", name, items, createdAt: "" };
      const res = await api.upsertPlaylist(draft);
      lastRevision = Math.max(lastRevision, res.revision);
      known.set(norm(name), { ...draft, id: res.playlistId });
      imported += 1;
    }
  }

  await restoreActiveTask(api, resolver, previousActive);
  lastRevision = Math.max(lastRevision, resolver.lastRevision());
  return { imported, lastRevision };
}

/**
 * Playlist detectada no jogo: devolve a do snapshot (por nome) ou cria a partir da lista
 * de cenários. A busca é feita no snapshot DEPOIS de esperar a revisão da própria escrita.
 */
export async function ensureDetectedPlaylist(
  api: PlaylistSyncApi,
  input: GamePlaylistInput
): Promise<Playlist | null> {
  const name = input.name.trim();
  if (!name) return null;

  const find = () =>
    (api.getData().playlists ?? []).find((p) => norm(p.name) === norm(name)) ?? null;

  const found = find();
  if (found) return found;
  if (input.items.length === 0) return null;

  const previousActive = api.getData().activeTaskId;
  const resolver = makeTaskResolver(api);
  const items = await buildItems(resolver, input);
  if (items.length === 0) return null;

  const res = await api.upsertPlaylist({ id: "", name, items, createdAt: "" });
  await restoreActiveTask(api, resolver, previousActive);
  await api.waitForRevision(Math.max(res.revision, resolver.lastRevision()));

  const data = api.getData();
  return (data.playlists ?? []).find((p) => p.id === res.playlistId) ?? find();
}
