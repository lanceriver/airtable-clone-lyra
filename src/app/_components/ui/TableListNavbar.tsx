"use client";
import { api } from "~/trpc/react";
import { Button } from "src/components/ui/button";
import { TableDropdown } from "./TableDropdown";
import { CreateTableForm } from "./CreateTable";
import { ChevronDown } from 'lucide-react';
import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

type Table = {
    baseId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    colCount: number;
    rowCount: number;
};

export function TableListNavbar({ baseId, initialTables }: { baseId: string, initialTables: Table[] }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { data: tables, isLoading } = api.table.getTables.useQuery({ baseId }, {
        initialData: initialTables,});
    return (
        <>
            <div className="w-full px-1 py-3 flex flex-row justify-between items-center border-b">
                <div className="flex flex-row items-center gap-x-6">
                    {tables?.map((table) => (             
                            <TableDropdown key={table.id} baseId={baseId} tableId={table.id} tableName={table.name} />
                    ))}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost">
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                                <Button variant="ghost">
                                    Create new table
                                </Button>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create new table</DialogTitle>
                        <DialogDescription>Build your table from scratch.</DialogDescription>
                    </DialogHeader>
                    <CreateTableForm baseId={baseId} onSuccess={() => setDialogOpen(false)} />
                        <DialogFooter className="flex justify-between w-full">
                        <div>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                        </div>
                        <div>
                            <Button className="bg-blue-800 text-white hover:bg-blue-400 hover:text-white" variant="outline" type="submit" form="create-table-form">
                                Create
                            </Button>
                        </div>   
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}