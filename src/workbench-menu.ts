import { InventorySlotItem } from "./types";
import { RECIPES, canCraft } from "./crafting";

export interface CraftResult {
  recipeIndex: number;
}

export class WorkbenchMenu {
  private root: HTMLElement;
  private rows: HTMLElement[];
  private resolveFn: ((result: CraftResult | null) => void) | null = null;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.root = document.getElementById("workbench-menu")!;
    this.rows = Array.from(
      this.root.querySelectorAll(".recipe-row"),
    ) as HTMLElement[];

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.root.classList.contains("workbench-hidden")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.close(null);
      }
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(e.key, 10) - 1;
        if (
          this.rows[idx] &&
          !this.rows[idx].classList.contains("recipe-locked")
        ) {
          this.close({ recipeIndex: idx });
        }
      }
    };
    document.addEventListener("keydown", this.keyHandler);
  }

  show(slots: (InventorySlotItem | null)[]): Promise<CraftResult | null> {
    return new Promise((resolve) => {
      this.resolveFn = resolve;

      // Update row availability
      for (let i = 0; i < RECIPES.length; i++) {
        const available = canCraft(slots, RECIPES[i]);
        if (available) {
          this.rows[i].classList.remove("recipe-locked");
          this.rows[i].classList.add("recipe-available");
        } else {
          this.rows[i].classList.add("recipe-locked");
          this.rows[i].classList.remove("recipe-available");
        }
      }

      this.root.classList.remove("workbench-hidden");
    });
  }

  private close(result: CraftResult | null): void {
    this.root.classList.add("workbench-hidden");
    if (this.resolveFn) {
      this.resolveFn(result);
      this.resolveFn = null;
    }
  }

  destroy(): void {
    document.removeEventListener("keydown", this.keyHandler);
  }
}
