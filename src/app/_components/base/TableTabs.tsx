"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import { getBaseColor } from "~/lib/baseColors";
import { api, type RouterOutputs } from "~/trpc/react";
import { TableAddPopover } from "./TableAddPopover";
import { TableListMenu } from "./TableListMenu";
import { TableTab } from "./TableTab";

type TableListItem = RouterOutputs["table"]["list"][number];

export type TableTabsProps = {
  baseId: string;
  initialTables: TableListItem[];
  /** The base's colour name (`Base.color`); the bar is tinted with it. */
  color: string;
};

/**
 * The 32 px table tabs bar in the base tint: one tab per table (scrolling
 * sideways when they don't fit), the all-tables list, "+ Add or import", and
 * the decorative Extensions and Tools on the right.
 */
export function TableTabs({ baseId, initialTables, color }: TableTabsProps) {
  const { tableId: activeTableId } = useParams<{ tableId?: string }>();
  const { tint } = getBaseColor(color);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data: tables } = api.table.list.useQuery(
    { baseId },
    { initialData: initialTables },
  );

  // Keep the active tab in view (switching, creating, or picking from the list).
  const activeIndex = tables.findIndex((t) => t.id === activeTableId);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !activeTableId) return;
    const tab = scroller.querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(activeTableId)}"]`,
    );
    if (!tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < scroller.scrollLeft) {
      scroller.scrollTo({ left, behavior: "smooth" });
    } else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({
        left: right - scroller.clientWidth,
        behavior: "smooth",
      });
    }
  }, [activeTableId, activeIndex, tables.length]);

  return (
    <div
      className="text-at-text flex h-8 flex-none items-end pl-3 text-[13px]"
      style={{ backgroundColor: tint }}
    >
      <div
        ref={scrollerRef}
        className="relative flex h-8 min-w-0 items-end overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(e) => {
          // A plain mouse wheel scrolls the tabs sideways.
          if (e.deltaX === 0) e.currentTarget.scrollLeft += e.deltaY;
        }}
      >
        {tables.map((table, index) => {
          const isActive = table.id === activeTableId;
          const nextIsActive = tables[index + 1]?.id === activeTableId;
          return (
            <TableTab
              key={table.id}
              baseId={baseId}
              table={table}
              tables={tables}
              isActive={isActive}
              hideSeparator={
                isActive || nextIsActive || index === tables.length - 1
              }
            />
          );
        })}
      </div>
      <div className="flex h-8 flex-none items-center gap-0.5 pl-1">
        <TableListMenu
          baseId={baseId}
          tables={tables}
          activeTableId={activeTableId}
        />
        <TableAddPopover baseId={baseId} tables={tables} />
      </div>

      <div className="ml-auto flex h-8 flex-none items-center gap-1 pr-3">
        <NotInDemo>
          <Button
            variant="ghost"
            size="toolbar"
            className="text-at-text hover:bg-black/5"
          >
            Extensions
          </Button>
        </NotInDemo>
        <NotInDemo>
          <Button
            variant="ghost"
            size="toolbar"
            className="text-at-text hover:bg-black/5"
          >
            Tools
            <ChevronDown />
          </Button>
        </NotInDemo>
      </div>
    </div>
  );
}
