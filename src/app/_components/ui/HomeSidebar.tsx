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
} from "~/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "~/components/ui/collapsible";
import {
  ChevronRight,
  Star,
  BookOpen,
  ShoppingBag,
  Upload,
} from "lucide-react";
import { useSidebar } from "~/components/ui/sidebar";
import { CreateBaseForm } from "./CreateBase";

export function CustomTrigger() {
  const { toggleSidebar } = useSidebar();
  return <button onClick={toggleSidebar}>Toggle sidebar</button>;
}

export function HomeSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex overflow-hidden">
      <Sidebar
        className="mt-15 flex h-[calc(100vh-4rem)] w-64 flex-col border-r bg-white"
        side="left"
        collapsible="icon"
      >
        <SidebarContent className="flex-1 overflow-y-auto">
          <SidebarGroup className="p-4">
            <Collapsible
              open={isOpen}
              onOpenChange={setIsOpen}
              className="flex flex-col"
            >
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-medium">Home</h1>
                <CollapsibleTrigger className="flex items-center justify-between p-4">
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90 transform" : ""}`}
                  />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-2 flex flex-row items-center text-xs">
                <Star className="h-8 w-8 rounded border border-gray-300 p-1 text-gray-400"></Star>
                <span className="ml-2 text-[10px]">
                  Your starred bases, interfaces, and workspaces will appear
                  here.
                </span>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="shrink-0 border-t">
          <SidebarGroup className="gap-y-2">
            <div className="cursor-pointer rounded-sm px-1 py-2 hover:bg-gray-200">
              <button className="flex cursor-pointer flex-row items-center gap-x-2">
                <BookOpen className="size-4 stroke-1" />
                <span className="text-xs font-medium">Templates and apps</span>
              </button>
            </div>
            <div className="cursor-pointer rounded-sm px-1 py-2 hover:bg-gray-200">
              <button className="flex cursor-pointer flex-row items-center gap-x-2">
                <ShoppingBag className="size-4 stroke-1" />
                <span className="text-xs font-medium">Marketplace</span>
              </button>
            </div>
            <div className="cursor-pointer rounded-sm px-1 py-2 hover:bg-gray-200">
              <button className="flex flex-row items-center gap-x-2">
                <Upload className="size-4 stroke-1" />
                <span className="text-xs font-medium">Import</span>
              </button>
            </div>
          </SidebarGroup>
          <CreateBaseForm />
        </SidebarFooter>
      </Sidebar>
    </div>
  );
}
