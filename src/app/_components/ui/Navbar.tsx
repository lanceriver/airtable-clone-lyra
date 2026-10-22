"use client";
import { Input } from "~/components/ui/input";
import { UserDropdown } from "./UserDropdown";
import { CustomTrigger } from "./HomeSidebar";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Search, BellIcon, CircleHelp, Menu } from "lucide-react";

export type UserProps = {
  userName: string;
  userImage?: string;
};

export function Navbar({ userName, userImage }: UserProps) {
  return (
    <div className="flex w-full items-center justify-between border-b bg-white px-4 py-3 shadow-2xl">
      <div className="flex items-center gap-x-4">
        <Menu className="cursor-pointer text-gray-400" />
        <img width="100" src="/assets/airtable_logo.svg" alt="AirTable Logo" />
      </div>
      <div className="items-center">
        <form className="relative flex items-center">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-black" />
          <Input
            className="h-8 w-80 rounded-full pl-10"
            type="search"
            placeholder="Search..."
          ></Input>
        </form>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <button className="flex cursor-pointer flex-row items-center gap-x-2 rounded-full px-3 py-1 text-sm hover:bg-gray-200">
          <CircleHelp className="h-4 w-4 cursor-pointer stroke-2" />
          Help
        </button>
        <button className="cursor-pointer rounded-full border-1 p-2 hover:bg-gray-200">
          <BellIcon className="h-4 w-4 stroke-1"></BellIcon>
        </button>
        <UserDropdown userName={userName} userImage={userImage} />
      </div>
    </div>
  );
}
