import { RECIPES } from '../ui/CraftingMenu';

const SAVE_KEY = 'mouseinthehouse_save';
const INVENTORY_KEY = 'inventory';
const PLACEMENTS_KEY = 'nestPlacements';

export interface SaveData {
  crumbs: number;
  thread: number;
}

export interface PlacementData {
  id: string;
  gx: number;
  gy: number;
}

export class SaveSystem {
  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save game data:', e);
    }
  }

  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<SaveData>;
        return {
          crumbs: data.crumbs ?? 0,
          thread: data.thread ?? 0,
        };
      }
    } catch (e) {
      console.warn('Failed to load game data:', e);
    }
    return { crumbs: 0, thread: 0 };
  }

  static clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(INVENTORY_KEY);
      localStorage.removeItem(PLACEMENTS_KEY);
    } catch (e) {
      console.warn('Failed to clear game data:', e);
    }
  }

  // Inventory management (item counts)
  static getInventory(): Record<string, number> {
    try {
      const raw = localStorage.getItem(INVENTORY_KEY);
      if (raw) {
        return JSON.parse(raw) as Record<string, number>;
      }
    } catch (e) {
      console.warn('Failed to load inventory:', e);
    }
    return {};
  }

  static getItemCount(itemId: string): number {
    const inventory = this.getInventory();
    return inventory[itemId] || 0;
  }

  static addItem(itemId: string, count: number = 1): void {
    try {
      const inventory = this.getInventory();
      inventory[itemId] = (inventory[itemId] || 0) + count;
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
    } catch (e) {
      console.warn('Failed to add item:', e);
    }
  }

  static removeItem(itemId: string, count: number = 1): boolean {
    try {
      const inventory = this.getInventory();
      if ((inventory[itemId] || 0) >= count) {
        inventory[itemId] -= count;
        if (inventory[itemId] <= 0) {
          delete inventory[itemId];
        }
        localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
        return true;
      }
    } catch (e) {
      console.warn('Failed to remove item:', e);
    }
    return false;
  }

  static hasItem(itemId: string): boolean {
    return this.getItemCount(itemId) > 0;
  }

  // Nest placements management
  static getPlacements(): PlacementData[] {
    try {
      const raw = localStorage.getItem(PLACEMENTS_KEY);
      if (raw) {
        return JSON.parse(raw) as PlacementData[];
      }
    } catch (e) {
      console.warn('Failed to load placements:', e);
    }
    return [];
  }

  static addPlacement(placement: PlacementData): void {
    try {
      const placements = this.getPlacements();
      placements.push(placement);
      localStorage.setItem(PLACEMENTS_KEY, JSON.stringify(placements));
    } catch (e) {
      console.warn('Failed to save placement:', e);
    }
  }

  static isGridOccupied(gx: number, gy: number): boolean {
    const placements = this.getPlacements();
    return placements.some(p => {
      const recipe = RECIPES.find(r => r.id === p.id);
      if (!recipe) return p.gx === gx && p.gy === gy;

      // Check if (gx, gy) falls within the item's footprint
      const width = recipe.width || 1;
      const height = recipe.height || 1;
      return gx >= p.gx && gx < p.gx + width && gy >= p.gy && gy < p.gy + height;
    });
  }

  static hasPlacedItem(itemId: string): boolean {
    const placements = this.getPlacements();
    return placements.some(p => p.id === itemId);
  }
}
