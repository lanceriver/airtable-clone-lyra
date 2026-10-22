"use client";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useState } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CreateTableForm({
  baseId,
  onSuccess,
}: {
  baseId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [tableName, setTableName] = useState("");
  const utils = api.useUtils();
  const { mutate: createTable } = api.table.create.useMutation({
    onSuccess: (table) => {
      void utils.table.list.invalidate({ baseId });
      setTableName("");
      router.push(`/${baseId}/${table.id}?viewId=${table.viewId}`);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTable({ baseId, name: tableName.trim() || undefined });
  };

  return (
    <form id="create-table-form" onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">
            Table name
          </Label>
          <Input
            id="name"
            placeholder="Table name"
            className="col-span-3"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          />
        </div>
      </div>
    </form>
  );
}
