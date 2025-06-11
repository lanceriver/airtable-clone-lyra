import { useState } from "react";
import {
  Sidebar,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenu,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "~/components/ui/sidebar"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { ChevronRight, Star, BookOpen, ShoppingBag, Upload } from "lucide-react";
import { useSidebar } from "~/components/ui/sidebar";
import { CreateBaseForm } from "./CreateBase";

export function CustomTrigger() {
    const { toggleSidebar } = useSidebar();
    return (
        <button onClick={toggleSidebar}>Toggle sidebar</button>
    )
}

export function HomeSidebar() {

    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="flex overflow-hidden">
            <Sidebar className="bg-white w-64 border-r flex flex-col mt-15 h-[calc(100vh-4rem)]" side="left" collapsible="icon">
                <SidebarContent className="flex-1 overflow-y-auto">
                    <SidebarGroup className="p-4">
                        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex flex-col">
                            <div className="flex justify-between items-center ">
                                <h1 className="text-lg font-medium">Home</h1>
                                <CollapsibleTrigger className="flex items-center justify-between p-4">
                                    <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "transform rotate-90" : ""}`}/>
                                </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent className="mt-2 text-xs flex flex-row items-center">
                                <Star className="h-8 w-8 border border-gray-300 text-gray-400 p-1 rounded"></Star>
                                <span className="text-[10px] ml-2">Your starred bases, interfaces, and workspaces will appear here.</span>
                            </CollapsibleContent>
                        </Collapsible>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter className="shrink-0 border-t">
                        <SidebarGroup className="gap-y-2">
                            <div className="hover:bg-gray-200 px-1 py-2 rounded-sm cursor-pointer">
                                <button className="flex flex-row items-center gap-x-2 cursor-pointer">
                                    <BookOpen className="stroke-1 size-4" />
                                    <span className="text-xs font-medium">Templates and apps</span>
                                </button>
                            </div>
                            <div className="hover:bg-gray-200 px-1 py-2 rounded-sm cursor-pointer">
                                <button className="flex flex-row items-center gap-x-2 cursor-pointer">
                                    <ShoppingBag className="stroke-1 size-4" />
                                    <span className="text-xs font-medium">Marketplace</span>
                                </button>
                            </div>
                            <div className="hover:bg-gray-200 px-1 py-2 rounded-sm cursor-pointer">
                                <button className="flex flex-row items-center gap-x-2">
                                    <Upload className="stroke-1 size-4" />
                                <span className="text-xs font-medium">Import</span>
                            </button>
                            </div>
                            
                        </SidebarGroup>
                        <CreateBaseForm />
                </SidebarFooter>
            </Sidebar>
        </div>
        
    )
}