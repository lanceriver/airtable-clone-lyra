"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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

export function BaseCard({
  baseId,
  baseName,
  firstTableId,
  firstViewId,
}: BaseCardProps) {
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
    },
  });
  const { mutate: deleteBase } = api.base.delete.useMutation({
    onSuccess: () => {
      void utils.base.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
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
  };
  const handleDelete = () => {
    deleteBase({ baseId });
  };

  const href = firstTableId
    ? `/${baseId}/${firstTableId}${firstViewId ? `?viewId=${firstViewId}` : ""}`
    : `/${baseId}`;

  return (
    <div className="group relative my-5 flex items-center rounded-md border bg-white p-5 shadow-2xs transition-shadow duration-200 hover:shadow-lg">
      {!isEditing && <Link href={href} className="absolute inset-0" />}

      <div className="flex h-15 w-15 flex-shrink-0 items-center justify-center rounded-md bg-[#d54402] text-2xl font-normal text-white">
        {baseName.slice(0, 1).toUpperCase()}
        {baseName.slice(1, 2)}
      </div>
      <div className="ml-8 flex min-w-0 flex-grow flex-col gap-y-1">
        {isEditing ? (
          <form onSubmit={handleUpdate}>
            <input
              type="text"
              value={newName}
              ref={inputRef}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={commitName}
              className="w-full rounded-md border border-blue-400 p-1 text-sm font-semibold"
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
          <Ellipsis className="absolute top-6 right-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <Button
              variant="outline"
              onClick={() => {
                setNewName(baseName);
                setIsEditing(true);
                setIsOpen(false);
              }}
            >
              Update base
            </Button>
          </DropdownMenuItem>
          <DropdownMenuSeparator></DropdownMenuSeparator>
          <DropdownMenuItem>
            <Button variant="destructive" onClick={handleDelete}>
              Delete base
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
