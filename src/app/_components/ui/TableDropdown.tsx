import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type TableDropdownProps = {
    baseId: string;
    tableId: string;
    tableName: string;
    isSelected: boolean;
    tableCount: number;
}

export function TableDropdown({ baseId, tableId, tableName, isSelected, tableCount }: TableDropdownProps) {
    const router = useRouter();
    const utils = api.useUtils();

    const [menuOpen, setMenuOpen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [newName, setNewName] = useState(tableName);

    const { mutate: renameTable } = api.table.rename.useMutation({
        onSuccess: () => {
            void utils.table.list.invalidate({ baseId });
            setIsOpen(false);
            setMenuOpen(false);
        },
        onError: (error) => {
            toast.error(error.message);
        }
    })

    const { mutate: deleteTable } = api.table.delete.useMutation({
        onSuccess: async () => {
            await utils.table.list.invalidate({ baseId });
            const tables = await utils.table.list.fetch({ baseId });
            const next = tables.find((table) => table.id !== tableId);
            router.push(next ? `/${baseId}/${next.id}` : `/${baseId}`);
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    const handleRename = (name: string) => {
        const trimmed = name.trim();
        if (trimmed === "") {
            toast.error("Please enter a valid table name!");
            return;
        }
        renameTable({ tableId, name: trimmed });
    }

    const handleDelete = () => {
        deleteTable({ tableId });
    }
    return (
        <div className="flex flex-row items-center">
            <Link href={`/${baseId}/${tableId}`} className="text-xs text-gray-600 hover:text-blue-500">
                <button
                    className={cn(
                    "px-4 py-2 h-8 font-semibold hover:text-white rounded-none cursor-pointer transition-colors rounded-tl-sm",  
                    isSelected ? "bg-white text-black" : "text-white hover:bg-white/10 hover:bg-opacity-20",
                )}
                >
                    {tableName}
                </button>
            </Link>
            {isSelected && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <button className="bg-white h-8 px-2 rounded-tr-sm flex items-center border-blue-100">
                            <ChevronDown className="text-gray-500 ml-1 h-4 w-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <Popover open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open);
                        if (open) setNewName(tableName);
                    }}>
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
                                    handleRename(newName);
                                }}>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)}/>
                                </form>  
                            </div>
                            <Button className="w-1/4 bg-blue-500" disabled={newName.trim() === ""} onClick={() => handleRename(newName)}>Save</Button>
                            
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
