// Editor document state with undo/redo. Rapid edits to the same field are
// coalesced into one history step so undo feels natural while typing.
import type { Block, ProfileDocument } from "~/lib/blocks";

export interface HistoryState {
  past: ProfileDocument[];
  present: ProfileDocument;
  future: ProfileDocument[];
  lastKey: string | null;
  lastAt: number;
}

export type EditorAction =
  | { type: "change"; doc: ProfileDocument; key?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; doc: ProfileDocument };

const LIMIT = 100;
const COALESCE_MS = 1200;

export function initHistory(doc: ProfileDocument): HistoryState {
  return { past: [], present: doc, future: [], lastKey: null, lastAt: 0 };
}

export function historyReducer(state: HistoryState, action: EditorAction): HistoryState {
  switch (action.type) {
    case "change": {
      const now = Date.now();
      const coalesce = action.key != null && action.key === state.lastKey && now - state.lastAt < COALESCE_MS;
      return {
        past: coalesce ? state.past : [...state.past, state.present].slice(-LIMIT),
        present: action.doc,
        future: [],
        lastKey: action.key ?? null,
        lastAt: now,
      };
    }
    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], lastKey: null, lastAt: 0 };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest, lastKey: null, lastAt: 0 };
    }
    case "reset":
      return initHistory(action.doc);
  }
}

// Pure document helpers -------------------------------------------------------

export function updateBlock(doc: ProfileDocument, id: string, patch: Partial<Block>): ProfileDocument {
  return { ...doc, blocks: doc.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) };
}

export function moveBlock(doc: ProfileDocument, from: number, to: number): ProfileDocument {
  if (to < 0 || to >= doc.blocks.length || from === to) return doc;
  const blocks = [...doc.blocks];
  const [item] = blocks.splice(from, 1);
  blocks.splice(to, 0, item);
  return { ...doc, blocks };
}

export function insertBlock(doc: ProfileDocument, block: Block, index: number): ProfileDocument {
  const blocks = [...doc.blocks];
  blocks.splice(Math.max(0, Math.min(index, blocks.length)), 0, block);
  return { ...doc, blocks };
}

export function removeBlock(doc: ProfileDocument, id: string): ProfileDocument {
  return { ...doc, blocks: doc.blocks.filter((b) => b.id !== id) };
}
