"use client"
import { use } from "react";
import TableSidebar from "../_components/ui/TableSidebar";
import { useSearchParams } from "next/navigation";


export default function BasePage({params} : {params: Promise<{baseName: string, baseId: string}>}) {
    const searchParams = useSearchParams();
    const baseName = searchParams.get("name") ?? "";
    return (
        <div>
        </div>
    )
}