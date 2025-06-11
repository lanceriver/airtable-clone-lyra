import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ChevronDown } from 'lucide-react';
import { Button } from "~/components/ui/button"
import { api } from "~/trpc/react"
import { useState } from "react"
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";
import { Input } from "~/components/ui/input";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { Label } from "~/components/ui/label";
import { E } from "node_modules/@faker-js/faker/dist/airline-BUL6NtOJ";




type TableDropdownProps = {
    baseId: string;
    tableId: string;
    tableName: string;
    selectedTab: string;
    tableCount: number;
    firstTableId: string;
    handleSelectTab?: (tableName: string, tableId: string) => void;
}

export function TableDropdown({ baseId, tableId, tableName, selectedTab, tableCount, firstTableId, handleSelectTab }: TableDropdownProps) {
    const router = useRouter();
    const utils = api.useUtils();

    const [isOpen, setIsOpen] = useState(false);
    const [newName, setNewName] = useState("");

    const { mutate: updateTable } = api.table.updateTable.useMutation({
        onSuccess: () => {
            void utils.table.getTables.invalidate();
            handleSelectTab?.(newName, tableId);
        },
        onError: (error) => {
            toast.error(`Error updating table! Please make sure you provide a unique table name.`);
        }
    })

    const { mutate: deleteTable } = api.table.deleteTable.useMutation({
        onSuccess: async () => {
            await utils.table.getTables.invalidate();
            
            const tables = await utils.table.getTables.fetch({ baseId });

            handleSelectTab?.(tables[0]!.name, tables[0]!.id);
            router.push(`/${baseId}/${firstTableId}`);
            
        },
        onError: (error) => {
            toast.error(`Error deleting table! ${error.message}`);
        }
    });

    const handleUpdate = (name: string) => {
        if (name === "") {
            toast.error("Please enter a valid table name!");
            return;
        }
        updateTable({ id: tableId, name: name});
    }

    const handleDelete = () => {
        deleteTable({ id: tableId});
    }
    return (
        <div className="flex flex-row items-center">
            <Link href={`/${baseId}/${tableId}`} className="text-xs text-gray-600 hover:text-blue-500">
                <button
                    className={cn(
                    "px-4 py-2 h-8 font-semibold hover:text-white rounded-none cursor-pointer transition-colors rounded-tl-sm",  
                    selectedTab === tableName ? "bg-white text-black" : "text-white hover:bg-white/10 hover:bg-opacity-20",
                )}
                    onClick={() => {
                        handleSelectTab?.(tableName, tableId);
                    }
                    }
                >
                    {tableName}
                </button>
            </Link>
            {selectedTab === tableName && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="bg-white h-8 px-2 rounded-tr-sm flex items-center border-blue-100">
                            <ChevronDown className="text-gray-500 ml-1 h-4 w-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <Popover open={isOpen} onOpenChange={() => setIsOpen(!isOpen)}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost">
                                Rename table
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="flex flex-col gap-y-5">
                            <div className="flex flex-col gap-y-5">
                                <Label>Enter new table name:</Label>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    handleUpdate(newName);
                                }}>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)}/>
                                </form>  
                            </div>
                            <Button className="w-1/4 bg-blue-500" disabled={newName === ""} onClick={() => handleUpdate(newName)}>Save</Button>
                            
                        </PopoverContent>
                    </Popover>
                <DropdownMenuSeparator>
                </DropdownMenuSeparator>
                <DropdownMenuItem>
                    <Button variant="ghost" className="bg-red-600 text-white disabled:bg-gray-100 disabled:text-black" onClick={handleDelete} disabled={tableCount <= 1}>
                        Delete table
                    </Button>
                </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
                )}
            
                
        </div>
    )
}