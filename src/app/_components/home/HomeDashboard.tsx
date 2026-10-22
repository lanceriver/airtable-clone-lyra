"use client";

import { useMemo, useState } from "react";
import { ChevronDown, LayoutGrid, List, Plus } from "lucide-react";

import { AirtableMark } from "~/components/at/AirtableMark";
import { NotInDemo } from "~/components/at/NotInDemo";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { BaseCard } from "./BaseCard";
import { CreateBaseDialog } from "./CreateBase";
import { HomeSidebar } from "./HomeSidebar";
import { HomeTopBar, type HomeUser } from "./HomeTopBar";
import { useBaseActions } from "./useBaseActions";

type Props = {
  initialBases: RouterOutputs["base"]["list"];
  user: HomeUser;
};

/** The whole home screen: top bar, sidebar and the main area (the only part that scrolls). */
export function HomeDashboard({ initialBases, user }: Props) {
  const { data: bases } = api.base.list.useQuery(undefined, {
    initialData: initialBases,
  });
  const actions = useBaseActions();

  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      query ? bases.filter((b) => b.name.toLowerCase().includes(query)) : bases,
    [bases, query],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <HomeTopBar
        user={user}
        search={search}
        onSearchChange={setSearch}
        onToggleSidebar={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-h-0 flex-1">
        <HomeSidebar
          collapsed={collapsed}
          onCreate={() => setCreateOpen(true)}
        />
        <main className="min-w-0 flex-1 overflow-y-auto bg-[#f9fafb]">
          <div className="px-12 pb-12">
            <h1 className="text-at-text pt-8 pb-5 text-[27px] leading-9 font-semibold">
              Home
            </h1>

            {bases.length === 0 ? (
              <EmptyState onCreate={() => setCreateOpen(true)} />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <NotInDemo>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-at-text-muted -ml-2"
                    >
                      Opened anytime
                      <ChevronDown />
                    </Button>
                  </NotInDemo>
                  <div className="flex items-center gap-1">
                    <LayoutToggle
                      label="List view"
                      pressed={layout === "list"}
                      onClick={() => setLayout("list")}
                    >
                      <List />
                    </LayoutToggle>
                    <LayoutToggle
                      label="Grid view"
                      pressed={layout === "grid"}
                      onClick={() => setLayout("grid")}
                    >
                      <LayoutGrid />
                    </LayoutToggle>
                  </div>
                </div>

                {visible.length === 0 ? (
                  <div
                    data-testid="no-matches"
                    className="text-at-text-muted flex flex-col items-center gap-1 py-20 text-center"
                  >
                    <p className="text-at-text text-[15px] font-semibold">
                      No bases match “{search.trim()}”
                    </p>
                    <p className="text-[13px]">Try a different name.</p>
                  </div>
                ) : (
                  <div
                    data-testid="base-list"
                    data-layout={layout}
                    className={cn(
                      layout === "grid"
                        ? "grid grid-cols-[repeat(auto-fill,minmax(286px,1fr))] gap-4"
                        : "border-at-border overflow-hidden rounded-md border bg-white",
                    )}
                  >
                    {visible.map((base) => (
                      <BaseCard
                        key={base.id}
                        base={base}
                        variant={layout}
                        onRename={(name) => actions.rename(base.id, name)}
                        onSetColor={(c) => actions.setColor(base.id, c)}
                        onDelete={() => actions.remove(base.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <CreateBaseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function LayoutToggle({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="toolbar"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center gap-4 py-24 text-center"
    >
      <AirtableMark size={48} />
      <p className="text-at-text text-lg font-semibold">
        You don&apos;t have any bases yet
      </p>
      <Button size="lg" onClick={onCreate}>
        <Plus />
        Create a base
      </Button>
    </div>
  );
}
