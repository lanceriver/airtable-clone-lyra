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
    setSelectedTab: (tab: string) => void;
    tableCount: number;
    firstTableId: string;
}

export function TableDropdown({ baseId, tableId, tableName, selectedTab, setSelectedTab, tableCount, firstTableId }: TableDropdownProps) {
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
                <Button
                    variant="ghost"
                    className={cn(
                    "px-4 py-2 h-10 text-black hover:text-white rounded-none",  
                    selectedTab === tableName ? "bg-white text-blue-700" : "text-white hover:bg-blue-700 hover:text-white",
                )}
                    onClick={() => setSelectedTab(tableName)}
                >
                    {tableName}
                </Button>
            </Link>
            {selectedTab === tableName && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="bg-white h-10 px-2 flex items-center border-blue-100">
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