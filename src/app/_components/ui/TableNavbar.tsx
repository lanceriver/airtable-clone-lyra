"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api, type RouterOutputs } from "~/trpc/react";
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

export function TableNavbar({
  baseId,
  initialTables,
}: {
  baseId: string;
  initialTables: TableListItem[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { tableId: currentTableId } = useParams<{ tableId?: string }>();

  const { data: tables } = api.table.list.useQuery(
    { baseId },
    {
      initialData: initialTables,
    },
  );

  return (
    <div className="flex flex-col">
      <div
        className={`flex h-8 items-center bg-[#c23d01] font-normal text-black`}
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
            <button className="ml-2 h-8 cursor-pointer text-white">
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
