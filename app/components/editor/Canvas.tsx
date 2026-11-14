// The editor canvas: the real renderer with selectable, draggable blocks.
// Drag a block to reorder it; drop components from the library between blocks.
import type { CSSProperties, ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BLOCK_REGISTRY } from "~/lib/block-registry";
import type { Block, ProfileDocument } from "~/lib/blocks";
import { ProfileView } from "~/components/profile/ProfileView";
import { IconButton, Icons } from "./controls";

interface Props {
  doc: ProfileDocument;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

export function Canvas({ doc, selectedId, onSelect, onMove, onDuplicate, onRemove }: Props) {
  const ids = doc.blocks.map((b) => `c:${b.id}`);
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div
        className="editor-canvas min-h-full"
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        <ProfileView
          doc={doc}
          mode="preview"
          renderBlock={(block, index, node) => (
            <CanvasBlock
              block={block}
              index={index}
              count={doc.blocks.length}
              selected={block.id === selectedId}
              onSelect={() => onSelect(block.id)}
              onMove={(d) => onMove(index, index + d)}
              onDuplicate={() => onDuplicate(block.id)}
              onRemove={() => onRemove(block.id)}
            >
              {node}
            </CanvasBlock>
          )}
          after={<CanvasEnd empty={doc.blocks.length === 0} />}
        />
      </div>
    </SortableContext>
  );
}

function CanvasBlock({
  block, index, count, selected, onSelect, onMove, onDuplicate, onRemove, children,
}: {
  block: Block; index: number; count: number; selected: boolean;
  onSelect: () => void; onMove: (d: number) => void; onDuplicate: () => void; onRemove: () => void; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active } = useSortable({ id: `c:${block.id}` });
  const label = BLOCK_REGISTRY[block.type].label;
  const dropping = isOver && typeof active?.id === "string" && active.id.startsWith("lib:");
  return (
    <div
      ref={setNodeRef}
      className="rp-b editor-block"
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      data-dropping={dropping || undefined}
      style={{ "--i": index, transform: CSS.Translate.toString(transform), transition } as CSSProperties}
      {...attributes}
      {...listeners}
      aria-label={`${label}, block ${index + 1} of ${count}. Press Enter to edit, Space to pick up and move.`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onSelect();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
    >
      <span className="editor-block-tag" aria-hidden="true">{label}</span>
      {selected ? (
        <div className="editor-toolbar" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <IconButton label={`Move ${label} up`} onClick={() => onMove(-1)} disabled={index === 0}>{Icons.up}</IconButton>
          <IconButton label={`Move ${label} down`} onClick={() => onMove(1)} disabled={index === count - 1}>{Icons.down}</IconButton>
          <IconButton label={`Duplicate ${label}`} onClick={onDuplicate}>{Icons.copy}</IconButton>
          <IconButton label={`Delete ${label}`} tone="danger" onClick={onRemove}>{Icons.trash}</IconButton>
        </div>
      ) : null}
      <div className="editor-block-inner">{children}</div>
    </div>
  );
}

function CanvasEnd({ empty }: { empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-end" });
  return (
    <div ref={setNodeRef} className="editor-dropzone" data-over={isOver || undefined}>
      {empty ? "Drag components here from the library" : "Drop here to add at the end"}
    </div>
  );
}
