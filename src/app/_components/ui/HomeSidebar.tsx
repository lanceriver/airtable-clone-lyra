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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { HomeIcon, Menu, UsersIcon, SettingsIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
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
        <Sidebar className="bg-white w-64 mt-16 border-r flex flex-col h-screen" side="left" collapsible="icon">
            <SidebarContent className="flex-1 overflow-y-auto min-h-0">
                <SidebarGroup className="p-4">
                    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex flex-col">
                        <div className="flex justify-between items-center ">
                            <h1 className="text-lg font-medium">Home</h1>
                            <CollapsibleTrigger className="flex items-center justify-between p-4">
                                <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "transform rotate-90" : ""}`}/>
                            </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className="mt-2 text-xs">
                            <span>Your starred bases, interfaces, and workspaces will appear here.</span>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarGroup>
                <SidebarFooter className="position-fixed mt-120 shrink-0 border-t p-4">
                    <CreateBaseForm />
                </SidebarFooter>
            </SidebarContent>
        </Sidebar>
    )
}