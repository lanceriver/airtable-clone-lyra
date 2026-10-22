"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api, type RouterOutputs } from "~/trpc/react";
import { getBaseColor } from "~/lib/baseColors";
import { TableDropdown } from "./TableDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { CreateTableForm } from "./CreateTable";
import { Plus } from "lucide-react";

type TableListItem = RouterOutputs["table"]["list"][number];

export type TableTabsProps = {
  baseId: string;
  initialTables: TableListItem[];
  /** The base's colour name (`Base.color`); the bar is tinted with it. */
  color: string;
};

export function TableTabs({ baseId, initialTables, color }: TableTabsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { tableId: currentTableId } = useParams<{ tableId?: string }>();

  const { tint } = getBaseColor(color);

  const { data: tables } = api.table.list.useQuery(
    { baseId },
    {
      initialData: initialTables,
    },
  );

  return (
    <div className="flex-none">
      <div
        className="text-at-text flex h-8 items-end text-[13px]"
        style={{ backgroundColor: tint }}
      >
        {tables.map((table) => (
          <TableDropdown
            key={table.id}
            baseId={baseId}
            tableId={table.id}
            tableName={table.name}
            isSelected={table.id === currentTableId}
            tableCount={tables.length}
          />
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-at-text-muted hover:text-at-text ml-2 h-8 cursor-pointer">
              <Plus className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <Button variant="ghost">Create new table</Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new table</DialogTitle>
              <DialogDescription>
                Build your table from scratch.
              </DialogDescription>
            </DialogHeader>
            <CreateTableForm
              baseId={baseId}
              onSuccess={() => setDialogOpen(false)}
            />
            <DialogFooter className="flex w-full justify-between">
              <div>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
              <div>
                <Button
                  className="bg-blue-800 text-white hover:bg-blue-400 hover:text-white"
                  variant="outline"
                  type="submit"
                  form="create-table-form"
                >
                  Create
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
