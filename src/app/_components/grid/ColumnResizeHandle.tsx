"use client";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_COLUMN_WIDTH, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "./gridConstants";
import type { GridColumn } from "./gridTypes";
import { useGridColumnTools } from "./GridColumnTools";

type Drag = {
  pointerId: number;
  startX: number;
  startWidth: number;
  width: number;
};

/**
 * A 6 px strip on the right edge of a header cell. Dragging it resizes the
 * column live (through the table's `columnSizing` state, which the grid reads
 * its widths from); releasing saves the widths once. A double-click resets
 * the column to the default width.
 */
export function ColumnResizeHandle({ column }: { column: GridColumn }) {
  const tools = useGridColumnTools();
  const [active, setActive] = useState(false);
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const widths = tools?.widths;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  if (!widths) return null;

  const resizeTo = (width: number) => {
    widths.onColumnSizingChange((old) => ({ ...old, [column.id]: width }));
  };

  const finish = () => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    document.body.style.removeProperty("cursor");
    setActive(false);
    if (current.width !== current.startWidth) {
      resizeTo(current.width);
    }
    widths.commit();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${column.name}`}
      data-testid="column-resize-handle"
      data-resizing={active ? "true" : undefined}
      className="group/resize absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: column.width,
          width: column.width,
        };
        document.body.style.cursor = "col-resize";
        widths.begin();
        setActive(true);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) return;
        current.width = Math.min(
          MAX_COLUMN_WIDTH,
          Math.max(
            MIN_COLUMN_WIDTH,
            Math.round(current.startWidth + event.clientX - current.startX),
          ),
        );
        // At most one update per frame.
        if (frame.current) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          if (drag.current) resizeTo(drag.current.width);
        });
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        widths.reset(column.id);
      }}
      title={`Drag to resize, double-click to reset to ${DEFAULT_COLUMN_WIDTH}px`}
    >
      <div
        className={`mx-auto h-full w-0.5 transition-colors ${
          active ? "bg-[#166ee1]" : "group-hover/resize:bg-[#166ee1]/60"
        }`}
      />
    </div>
  );
}
