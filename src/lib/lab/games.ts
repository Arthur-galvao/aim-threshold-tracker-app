// Tabela de jogos e conversão de sensibilidade (cm/360 <-> sens do jogo).
// `note` é uma chave i18n (ver docs/plans/i18n-pending/T6.1.json), nunca texto PT.

export interface GameDef {
  id: string;
  name: string;
  yaw: number;
  note?: string;
  decimals: number;
}

export const GAMES: GameDef[] = [
  { id: "valorant", name: "Valorant", yaw: 0.07, decimals: 3 },
  { id: "cs2", name: "Counter-Strike 2", yaw: 0.022, decimals: 2 },
  { id: "apex", name: "Apex Legends (hipfire)", yaw: 0.022, decimals: 2 },
  { id: "ow2", name: "Overwatch 2", yaw: 0.0066, decimals: 2 },
  { id: "fortnite", name: "Fortnite (slider %)", yaw: 0.0055555555, decimals: 1 },
  { id: "r6", name: "Rainbow Six Siege", yaw: 0.00528, decimals: 0, note: "lab.games.r6Note" },
];

export function findGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export const cmToGame = (cm: number, dpi: number, g: GameDef) => 914.4 / (dpi * g.yaw * cm);
export const gameToCm = (sens: number, dpi: number, g: GameDef) => 914.4 / (dpi * g.yaw * sens);

export function formatGameSens(sens: number, g: GameDef): string {
  return sens.toFixed(g.decimals);
}
