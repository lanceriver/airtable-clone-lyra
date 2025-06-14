"use client"
import { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { api } from "~/trpc/react";
import { Ellipsis } from "lucide-react";
import { set } from "zod";
import Link from "next/link";


export const getLastVisitedTable = (baseId: string): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`lastTable-${baseId}`);
};

export const setLastVisitedTable = (baseId: string, tableId: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`lastTable-${baseId}`, tableId);
};


export function BaseCard({ baseId, baseName }: { baseId: string; baseName: string}) {
    const [newName, setNewName] = useState(baseName);
    const [isEditing, setIsEditing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const utils = api.useUtils();
    const inputRef = useRef<HTMLInputElement>(null);
    const [defaultTable, setDefaultTable] = useState("");
    const { data: tables, isLoading } = api.table.getTables.useQuery({ baseId });
    useEffect(() => {
        if (tables && tables.length > 0) {
            setDefaultTable(tables[0]!.id);
    }
    }, [tables]);
    useEffect(() => {
    if (isEditing && inputRef.current) {
        inputRef.current.focus();
        }
    }, [isEditing]);
    const { mutate: updateBase } = api.base.updateBase.useMutation({
        onSuccess: () => {
            void utils.base.getBases.invalidate();
        },
        onError: (error) => {
            console.error("Error updating base:", error);
        }
    });
    const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
        setIsOpen(false);
        e.preventDefault();
        if (newName !== baseName) {
            void updateBase({baseId, name: newName});
        }
    }
    console.log("BaseCard render", { baseId, defaultTable, baseName });
    const { mutate: deleteBase } = api.base.deleteBase.useMutation({
        onSuccess: () => {
            void utils.base.getBases.invalidate();
        },
        onError: (error) => {
            console.error("Error deleting base:", error);
        }
    });
    const handleDelete = () => {
        void deleteBase({baseId});
    }
    const handleDropdownOpen = (open: boolean) => {
        if (!open) {
            if (newName !== baseName) {
                console.log("Updating base name to:", newName);
                void updateBase({baseId, name: newName});
            }
            setIsEditing(false);
            setNewName(baseName);
        }
        setIsOpen(open);
    }

    useEffect(() => {
        if (tables && tables.length > 0) {
            const lastVisited = getLastVisitedTable(baseId);
            if (lastVisited) {
                setDefaultTable(lastVisited);
            }
            else {
                setDefaultTable(tables[0]!.id);
            }
        }
    }, [tables, baseId]);

    return (
        <div className="relative group bg-white shadow-2xs border rounded-md p-5 my-5 flex items-center hover:shadow-lg transition-shadow duration-200">
            {!isEditing && (
            <Link href={`/${baseId}/${defaultTable}`} className="absolute inset-0" />
            )
            }
            
            <div className="w-15 h-15 bg-[#d54402] rounded-md text-white text-2xl font-normal flex items-center justify-center flex-shrink-0">
                {baseName.slice(0, 1).toUpperCase()}
                {baseName.slice(1, 2)}
            </div>
            <div className="flex flex-col ml-8 gap-y-1 flex-grow min-w-0">
                {isEditing ? (
                    <form onSubmit={handleUpdate}>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => {
                                setNewName(e.target.value);
                                console.log(newName);
                            }}
                            onBlur={() => {
                                if (newName !== baseName) {
                                    updateBase({ baseId, name: newName });
                                }
                                console.log("this is true");
                                setIsEditing(false);
                            }}
                            className="border border-blue-400 rounded-md p-1 text-sm font-semibold w-full"
                            autoFocus
                        />
                    </form>       
                ) : (
                    <p className="text-sm font-semibold">{baseName}</p>
                )}
                <p className="text-xs font-semibold text-gray-500">Base</p>
            </div>
            <DropdownMenu open={isOpen} onOpenChange={handleDropdownOpen}>
                <DropdownMenuTrigger asChild>
                    <Ellipsis className="absolute top-6 text-gray-400 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>
                        <Button variant="outline" onClick={() => {
                            setNewName(baseName);
                            setIsEditing(true);
                            setIsOpen(false);
                        }}>
                            Update base
                        </Button>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator>
                    </DropdownMenuSeparator>
                    <DropdownMenuItem>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete base
                        </Button>
                        </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}