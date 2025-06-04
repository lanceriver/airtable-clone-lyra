"use client"

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { TableDropdown } from "./TableDropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "~/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { CreateTableForm } from "./CreateTable";
import { Plus } from "lucide-react";

type Table = {
    baseId: string;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    colCount: number;
    rowCount: number;
    seed: number | null;
    activeViewId: string | null;
};



export function TableNavbar({baseId, initialTables, navbarColor}: {baseId: string, initialTables: Table[], navbarColor?: string }) {

    const [dialogOpen, setDialogOpen] = useState(false);

    const [selectedTab, setSelectedTab] = useState(() => {
        return localStorage.getItem("selectedTab") ?? (initialTables[0]?.name ?? "Table 1");
      })
    
      useEffect(() => {
        localStorage.setItem("selectedTab", selectedTab);
      }, [selectedTab]);
      const [selectedTableId, setSelectedTableId] = useState(initialTables[0]?.id ?? "");
    
      const handleSelectTab = (tableName: string, tableId: string) => {
        setSelectedTab(tableName);
        setSelectedTableId(tableId);
      }
      const utils = api.useUtils();

      const { data: tables, isLoading } = api.table.getTables.useQuery({ baseId }, {
        initialData: initialTables,});

    const darkerColorMap: Record<string, string> = {
            "bg-blue-700": "bg-blue-900/90",
            "bg-red-700": "bg-[#d54402]/90",
            "bg-green-700": "bg-green-900/90",
            "bg-orange-700": "bg-orange-900/90",
            "bg-amber-700": "bg-amber-900/90",
            "bg-purple-700": "bg-purple-900/90",
    };
    const tableNavbarColor = navbarColor ? (darkerColorMap[navbarColor] ?? "bg-[#c23d04]") : "bg-[#c23d04]";
    return (
        <div className="flex flex-col">
            <div className={`flex items-center bg-[#c23d04] text-black font-normal h-8`}>
                {tables?.map((table) => (             
                                <TableDropdown key={table.id} baseId={baseId} tableId={table.id} tableName={table.name} selectedTab={selectedTab} tableCount={tables.length} firstTableId={tables?.[0]?.id ?? ""} handleSelectTab={handleSelectTab}/>
                          ))}
                <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 ml-2 cursor-pointer text-white">
                  <Plus className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                  <Button variant="ghost">
                      Create new table
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create new table</DialogTitle>
                                    <DialogDescription>Build your table from scratch.</DialogDescription>
                                </DialogHeader>
                                <CreateTableForm baseId={baseId} onSuccess={() => setDialogOpen(false)} handleSelectTab={handleSelectTab} 
                                    />
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
            </div>
            
        </div>
    )
}