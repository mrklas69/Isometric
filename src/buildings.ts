// =============================================================================
// Buildings — centrální registr všech budov ve světě (Fáze 5.1).
//
// Architektura:
//   - `Buildings` (tady) = primary data: `Map<id, Building>`. Single source
//     of truth — co jsou všechny budovy, kde stojí, jakého typu jsou.
//   - `Grid.tileBuilding[i][j]` = spatial index: tile → buildingId. Lookup
//     "kdo stojí na (5, 7)" je O(1) bez iterace přes všechny budovy.
//
// Grid drží referenci na Buildings (předá v konstruktoru z main.ts) a volá
// `register()` / `unregister()` při placeBuilding / removeBuilding.
//
// Sdílený mutable state (jako `inventory.ts`) — vytvořený jednou v main.ts,
// předaný do Gridu.
// =============================================================================

import type { Building } from './building.js';

export class Buildings {
  // ID generátor — monotónně rostoucí, nikdy se nerecykluje (= bezpečné, i když
  // budova bude smazána a později přidána, nová id != stará).
  private nextId = 1;

  // Primary store — Map kvůli rychlému lookup po id (= O(1) get / delete).
  private readonly byId: Map<number, Building> = new Map();

  /**
   * Zaregistruje novou budovu. Volá Grid.placeBuilding po validaci.
   * Vrátí Building s nově přiděleným unikátním id.
   *
   * **Pozor**: Buildings nedělá placement validaci (canPlaceBuilding je
   * separátně volaná funkce). Caller je odpovědný za platná data.
   */
  register(i: number, j: number, typeId: number): Building {
    const id = this.nextId++;
    const b: Building = { id, typeId, i, j };
    this.byId.set(id, b);
    return b;
  }

  /**
   * Odregistruje budovu po id. Vrátí true, pokud existovala.
   * Nezpůsobí žádné změny v Gridu (= caller musí uklidit sprite + tileBuilding).
   */
  unregister(id: number): boolean {
    return this.byId.delete(id);
  }

  /** Získá Building po id, nebo undefined. */
  get(id: number): Building | undefined {
    return this.byId.get(id);
  }

  /** Počet všech zaregistrovaných budov ve světě. */
  count(): number {
    return this.byId.size;
  }
}
