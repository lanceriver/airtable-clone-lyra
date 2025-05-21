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
    selectedTab?: string;
    setSelectedTab?: (tab: string) => void;
    tableCount: number;
    firstTableId: string;
}

export function TableDropdown({ baseId, tableId, tableName, selectedTab, setSelectedTab, tableCount, firstTableId }: TableDropdownProps) {
    const router = useRouter();
    const utils = api.useUtils();
    console.log(tableCount);
    const { mutate: deleteTable } = api.table.deleteTable.useMutation({
        onSuccess: () => {
            utils.table.getTables.invalidate();
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
            <Link href={`/${baseId}/${tableId}`} className="text-sm text-gray-600 hover:text-blue-500">
                <Button
                    variant="ghost"
                    className={cn(
                    "px-4 py-2 h-10 rounded-none text-white hover:text-white",
                    selectedTab === "Table 1" ? "bg-blue-700" : "hover:bg-blue-700",
                )}
                    onClick={() => setSelectedTab(tableName)}
                >
                    {tableName}
                </Button>
            </Link>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost">
                        <ChevronDown className="text-white ml-1 h-4 w-4" />
                    </Button>
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
        </div>
    )
}