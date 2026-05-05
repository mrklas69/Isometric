// =============================================================================
// Inventory — globální stav nasbíraných resource (Fáze 2.2.6).
//
// Sdílený mutable objekt — vytvořený v main.ts, předaný do input (mutace
// při sběru) a HUD (display). Klíče = `name` z RESOURCE_TYPES.
//
// Pokud později přidáme lifetime stats, decay timery nebo capacity limity,
// rozšíříme typ tady — zachová single source of truth pro inventory shape.
// =============================================================================

export type Inventory = {
  tree: number;
  iron: number;
  stone: number;
};

export function createInventory(): Inventory {
  return { tree: 0, iron: 0, stone: 0 };
}
