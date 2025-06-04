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
import Link from "next/link";
import { cn } from "~/lib/utils";
import { useRouter } from "next/navigation";




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
    console.log(tableCount);
    const { mutate: deleteTable } = api.table.deleteTable.useMutation({
        onSuccess: () => {
            void utils.table.getTables.invalidate();
            router.push(`/${baseId}/${firstTableId}`);
        },
        onError: (error) => {
            console.error("Error deleting table:", error);
        }
    });
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
                <DropdownMenuItem>
                    <Button variant="ghost">
                        Rename table
                    </Button>
                </DropdownMenuItem>
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