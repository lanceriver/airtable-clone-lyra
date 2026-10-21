"use client"

import { useState } from "react"
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react"
import { toast } from "sonner"
import {
  Calendar,
  LayoutGrid,
  List,
  Plus,
  Search,
  Check,
  TableCellsSplit
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Collapsible, CollapsibleContent } from "~/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"

type SidebarProps = {
  baseId: string;
  tableId: string;
  activeViewId: string;
};

export default function TableSidebar({ baseId, tableId, activeViewId }: SidebarProps) {
  const utils = api.useUtils();
  const router = useRouter();

  const [createExpanded, setCreateExpanded] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const goToView = (viewId: string) => {
    router.push(`/${baseId}/${tableId}?viewId=${viewId}`);
  };

  const { data: views } = api.view.list.useQuery({ tableId });

  const { mutate: createView } = api.view.create.useMutation({
    onSuccess: async (newView) => {
      await Promise.all([
        utils.view.list.invalidate({ tableId }),
        utils.table.get.invalidate({ tableId }),
      ]);
      setCreateOpen(false);
      setViewName("");
      goToView(newView.id);
      toast.success(`View "${newView.name}" created successfully!`);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const { mutate: renameView } = api.view.rename.useMutation({
    onSuccess: (view) => {
      void utils.view.list.invalidate({ tableId });
      void utils.table.get.invalidate({ tableId });
      void utils.view.get.invalidate({ viewId: view.id });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  })

  const { mutate: deleteView } = api.view.delete.useMutation({
    onSuccess: async (deleted) => {
      await Promise.all([
        utils.view.list.invalidate({ tableId }),
        utils.table.get.invalidate({ tableId }),
      ]);
      if (deleted.id === activeViewId) {
        const next = views?.find((view) => view.id !== deleted.id);
        if (next) goToView(next.id);
      }
      toast.success(`View deleted successfully!`);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  })

  const commitRename = () => {
    const name = editName.trim();
    const current = views?.find((view) => view.id === editingViewId);
    if (editingViewId && name !== "" && name !== current?.name) {
      renameView({ viewId: editingViewId, name });
    }
    setEditingViewId(null);
    setEditName("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createView({ tableId, name: viewName.trim() || undefined });
  };

  return (
    <div className="flex overflow-hidden">
        <div className="w-64 border-r flex flex-col h-screen">
          <div className="p-2">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Find a view" className="pl-8 h-9 text-sm" />
            </div>
            {/* Create section */}
          </div>
          <div className="flex-1 overflow-y-auto">
              {views?.map(view => (
                <div key={view.id} className="w-full gap-y-0">
                <ContextMenu>
                  <ContextMenuTrigger className="cursor-pointer flex items-center w-full">
                        <Button variant="ghost" className={`cursor-pointer w-full justify-start gap-x-2 ${view.id === activeViewId ? 'bg-blue-50' : ''} hover:bg-blue-100`}
                          onClick={() => goToView(view.id)}>
                          <TableCellsSplit className="h-4 w-4 font-light text-blue-600" />  
                              {editingViewId === view.id ? <form onSubmit={(e) => { e.preventDefault(); commitRename(); }}>
                                  <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={commitRename} onClick={(e) => e.stopPropagation()}></Input>
                                </form> : <span className="text-sm">{view.name}</span>}
                          {view.id === activeViewId && <Check className="ml-auto h-4 w-4 text-gray-600" />}
                        </Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onClick={() => { setEditName(view.name); setEditingViewId(view.id); }}>Rename view</ContextMenuItem>
                      <ContextMenuItem disabled={views.length <= 1} onClick={() => deleteView({ viewId: view.id })}>Delete view</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                
                </div>
              ))}
            </div>
        <div className="">
              <Collapsible open={createExpanded} onOpenChange={setCreateExpanded} className="border-t pt-4">
              <CollapsibleContent className="space-y-1 ml-2">
                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <TableCellsSplit className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Grid</span>
                  </div>
                  <Popover open={createOpen} onOpenChange={setCreateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" aria-label="Create grid view">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4">
                      <form onSubmit={handleCreate}>
                        <div className="mb-4">
                          <Input placeholder="Enter view name" className="w-full" value={viewName} onChange={(e) => setViewName(e.target.value)}/>
                        </div>
                        <div className="flex flex-2 gap-x-2">
                          <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" variant="default" className="bg-blue-400 text-white">
                            Create new view
                          </Button>
                        </div>
                      </form>
                    </PopoverContent>
                  </Popover>
                  
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Calendar</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Gallery</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-green-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                      </svg>
                    </div>
                    <span className="text-sm">Kanban</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-red-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <polyline points="8 7 3 12 8 17" />
                        <polyline points="16 7 21 12 16 17" />
                      </svg>
                    </div>
                    <span className="text-sm">Timeline</span>
                    
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">List</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-green-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <line x1="7" y1="4" x2="7" y2="20" />
                      </svg>
                    </div>
                    <span className="text-sm">Gantt</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">New section</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Separator className="my-2" />

                <div className="flex items-center justify-between px-1 py-1.5 hover:bg-accent rounded group">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 text-pink-600 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    </div>
                    <span className="text-sm">Form</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
            </div>
            
          </div>
    </div>
  )
}
