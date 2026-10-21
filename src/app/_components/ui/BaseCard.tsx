"use client"
import { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { api } from "~/trpc/react";
import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";


type BaseCardProps = {
    baseId: string;
    baseName: string;
    firstTableId: string | null;
    firstViewId: string | null;
};

export function BaseCard({ baseId, baseName, firstTableId, firstViewId }: BaseCardProps) {
    const [newName, setNewName] = useState(baseName);
    const [isEditing, setIsEditing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const utils = api.useUtils();
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
    if (isEditing && inputRef.current) {
        inputRef.current.focus();
        }
    }, [isEditing]);
    const { mutate: renameBase } = api.base.rename.useMutation({
        onSuccess: () => {
            void utils.base.list.invalidate();
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });
    const { mutate: deleteBase } = api.base.delete.useMutation({
        onSuccess: () => {
            void utils.base.list.invalidate();
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    const commitName = () => {
        const name = newName.trim();
        setIsEditing(false);
        if (name !== "" && name !== baseName) {
            renameBase({ baseId, name });
        } else {
            setNewName(baseName);
        }
    };
    const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        commitName();
    }
    const handleDelete = () => {
        deleteBase({ baseId });
    }

    const href = firstTableId
        ? `/${baseId}/${firstTableId}${firstViewId ? `?viewId=${firstViewId}` : ""}`
        : `/${baseId}`;

    return (
        <div className="relative group bg-white shadow-2xs border rounded-md p-5 my-5 flex items-center hover:shadow-lg transition-shadow duration-200">
            {!isEditing && (
            <Link href={href} className="absolute inset-0" />
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
                            ref={inputRef}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={commitName}
                            className="border border-blue-400 rounded-md p-1 text-sm font-semibold w-full"
                            autoFocus
                        />
                    </form>       
                ) : (
                    <p className="text-sm font-semibold">{baseName}</p>
                )}
                <p className="text-xs font-semibold text-gray-500">Base</p>
            </div>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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