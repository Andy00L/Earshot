import { MaterialId, CraftedItemId, InventorySlotItem } from "./types";

export interface Recipe {
  output: CraftedItemId;
  inputs: [MaterialId, MaterialId];
  name: string;
  costLabel: string;
}

export const RECIPES: Recipe[] = [
  { output: "flare", inputs: ["wire", "battery"], name: "Flare", costLabel: "wire + battery" },
  { output: "smoke_bomb", inputs: ["glass_shards", "tape"], name: "Smoke Bomb", costLabel: "glass shards + tape" },
  { output: "decoy_radio", inputs: ["wire", "tape"], name: "Decoy Radio", costLabel: "wire + tape" },
];

export function canCraft(
  slots: (InventorySlotItem | null)[],
  recipe: Recipe,
): boolean {
  const materialIds: MaterialId[] = [];
  for (const s of slots) {
    if (s !== null && s.kind === "material") materialIds.push(s.id);
  }
  const [a, b] = recipe.inputs;
  const pool = [...materialIds];
  const idxA = pool.indexOf(a);
  if (idxA === -1) return false;
  pool.splice(idxA, 1);
  return pool.indexOf(b) !== -1;
}

export function craft(
  slots: (InventorySlotItem | null)[],
  recipe: Recipe,
): boolean {
  if (!canCraft(slots, recipe)) return false;
  const [a, b] = recipe.inputs;
  // Remove material A from first matching slot
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s && s.kind === "material" && s.id === a) {
      slots[i] = null;
      break;
    }
  }
  // Remove material B from first matching slot
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s && s.kind === "material" && s.id === b) {
      slots[i] = null;
      break;
    }
  }
  // Place crafted item in first empty slot
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) {
      slots[i] = { kind: "crafted", id: recipe.output };
      return true;
    }
  }
  return false;
}
