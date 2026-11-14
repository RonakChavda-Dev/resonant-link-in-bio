// Layers: a compact, keyboard-friendly outline of the page. Drag rows to
// reorder, or use the move buttons. Selecting a row opens it in the inspector.
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BLOCK_REGISTRY } from "~/lib/block-registry";
import type { Block } from "~/lib/blocks";
import { blockErrors, blockSummary } from "./BlockForms";
import { IconButton, Icons } from "./controls";

interface Props {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
}

export function Layers({ blocks, selectedId, onSelect, onMove }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "layers-end" });
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <ol className="grid min-w-0 gap-1.5" aria-label="Page blocks">
        {blocks.map((block, index) => (
          <LayerRow
            key={block.id}
            block={block}
            index={index}
            count={blocks.length}
            selected={block.id === selectedId}
            onSelect={() => onSelect(block.id)}
            onMove={(d) => onMove(index, index + d)}
          />
        ))}
      </ol>
      <div ref={setNodeRef} className={`rounded-xl border border-dashed px-3 py-3 text-center text-[0.75rem] ${isOver ? "border-volt text-volt" : "border-line text-faint"}`}>
        {blocks.length ? "Drop here to add at the end" : "Drag a component here, or pick one in Add"}
      </div>
    </div>
  );
}

function LayerRow({ block, index, count, selected, onSelect, onMove }: { block: Block; index: number; count: number; selected: boolean; onSelect: () => void; onMove: (d: number) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver, active } = useSortable({ id: `l:${block.id}` });
  const meta = BLOCK_REGISTRY[block.type];
  const hasErrors = Object.keys(blockErrors(block)).length > 0;
  const dropping = isOver && typeof active?.id === "string" && active.id.startsWith("lib:");
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative min-w-0 rounded-[0.8rem] border bg-panel transition-colors ${isDragging ? "z-10 border-volt shadow-2xl shadow-black/60" : selected ? "border-volt/60 bg-volt/[0.05]" : "border-line"}`}
    >
      {dropping ? <span aria-hidden="true" className="absolute -top-1 left-2 right-2 h-0.5 rounded bg-volt" /> : null}
      <div className="flex min-w-0 items-center gap-1 p-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-faint hover:bg-white/[0.06] hover:text-fg active:cursor-grabbing"
          aria-label={`Drag to reorder ${meta.label}, position ${index + 1} of ${count}`}
          {...attributes}
          {...listeners}
        >
          {Icons.grip}
        </button>
        <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/[0.03]">
          <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-wider text-faint">{meta.label}</span>
          <span className="min-w-0 truncate text-[0.84rem]">{blockSummary(block)}</span>
          {hasErrors ? <span className="ml-auto size-2 shrink-0 rounded-full bg-danger" aria-label="Needs attention" /> : null}
        </button>
        <div className="flex shrink-0">
          <IconButton label={`Move ${meta.label} up`} onClick={() => onMove(-1)} disabled={index === 0}>{Icons.up}</IconButton>
          <IconButton label={`Move ${meta.label} down`} onClick={() => onMove(1)} disabled={index === count - 1}>{Icons.down}</IconButton>
        </div>
      </div>
    </li>
  );
}
