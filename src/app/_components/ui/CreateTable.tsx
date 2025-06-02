"use client"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { useState } from "react"
import { api } from "~/trpc/react"
import { generateFakeData, Table } from "./Table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEffect } from "react";

const DEFAULT_COL_COUNT = 4;
const DEFAULT_ROW_COUNT = 5;

export function CreateTableForm({ baseId, onSuccess, handleSelectTab }: { baseId: string, onSuccess?: () => void, handleSelectTab: (tableName: string, tableId: string) => void }) {
    const router = useRouter();
    const [tableName, setTableName] = useState("");
    const [colCount, setColCount] = useState(DEFAULT_COL_COUNT);
    const [rowCount, setRowCount] = useState(DEFAULT_ROW_COUNT);
    const [error, setError] = useState(false);
    const [errorType, setErrorType] = useState("");
    const utils = api.useUtils();
    const { mutate: createTable } = api.table.createTable.useMutation({
        onSuccess: () => {
            void utils.table.getTables.invalidate();
        },
        onError: (error) => {
            setError(true);
            console.log(error);
            console.error("Error creating table:", error);
        }
    }); 

    const { mutate: createView } = api.view.createView.useMutation({
        onSuccess: () => {
            void utils.view.getViews.invalidate();
        },
        onError: (error) => {
            toast.error(`Failed to create view: ${error.message}`);
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const seed = Math.floor(Math.random() * 1000000);
        
        createTable({ baseId, name: tableName, colCount, rowCount, seed }, {
            onSuccess: (createdTable) => {
                setTableName("");
                handleSelectTab(tableName, createdTable.id);
                router.push(`/${baseId}/${createdTable.id}?seed=${seed}`);
                onSuccess?.();
            },
            onError: (error) => {
                console.log(error.data);
            }
        });
    };
    useEffect(() => {
    if (error) {
        toast("Please enter a valid and unique table name.");
        const timer = setTimeout(() => setError(false), 3000); // 3 seconds
        return () => clearTimeout(timer);
    }
    }, [error]);
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