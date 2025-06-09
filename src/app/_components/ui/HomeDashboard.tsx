"use client"

import { api } from "~/trpc/react"
import { CreateBaseForm } from "./CreateBase"
import { BaseCard } from "./BaseCard"
import type { Base } from "@prisma/client"
import { SidebarTrigger } from "~/components/ui/sidebar";
import { HomeSidebar, CustomTrigger } from "./HomeSidebar"


type Props = {
    initialBases: Base[];
}

export function HomeDashboard({ initialBases }: Props) {
const { data: bases, isLoading } = api.base.getBases.useQuery(undefined, {
    initialData: initialBases,
});


    return (
        <div className="flex h-screen">
            <HomeSidebar />
            <main className="flex-1 overflow-auto bg-gray-50">
                <div className="max-w-7xl mx-12">
                    <h1 className="text-3xl font-semibold py-10">
                        Home
                    </h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {bases?.map((base) => (
                            <BaseCard 
                                key={base.id} 
                                baseId={base.id} 
                                baseName={base.name} 
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
        
    )
}