"use client"
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";


export function BaseCard({ baseId, baseName }: { baseId: string; baseName: string}) {
    const utils = api.useUtils();
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

    return (
        <div className="relative group bg-white shadow-2xs border rounded-md ml-8 mr-8 p-4 my-5 flex items-center hover:shadow-lg transition-shadow duration-200">
            <Button variant="destructive" className="absolute top-4 right-4 text-sm opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleDelete}>
                Delete
            </Button>
            <div className="w-10 h-10 bg-purple-500 rounded-md text-white text-sm font-semibold flex items-center justify-center">
                {baseName.slice(0, 2).toUpperCase()}
            </div>
            <p className="text-sm font-semibold ml-3">{baseName}</p>
        </div>
    )
}