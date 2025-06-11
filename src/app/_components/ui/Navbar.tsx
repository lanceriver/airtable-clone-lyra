"use client";
import { Input } from "~/components/ui/input";
import { UserDropdown } from "./UserDropdown";
import { CustomTrigger } from "./HomeSidebar";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Search, BellIcon, CircleHelp, Menu } from "lucide-react";

export type UserProps = {   
    userName: string;
    userImage? : string;
} 

export function Navbar({ userName, userImage }: UserProps  ) {
    return (
        <div className="w-full flex px-4 py-3 justify-between items-center bg-white border-b shadow-2xl">
            <div className="flex items-center gap-x-4">
                <Menu className="text-gray-400 cursor-pointer" />
                <img width="100" src="/assets/airtable_logo.svg" alt="AirTable Logo"/>
            </div>
            <div className="items-center">
                <form className="flex items-center relative">
                     <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                    <Input className="rounded-full w-80 h-8 pl-10" type="search" placeholder="Search...">
                    </Input>
                </form>
            </div>
            <div className="flex flex-row items-center gap-x-4">
                <button className="flex flex-row items-center gap-x-2 cursor-pointer rounded-full px-3 py-1 text-sm hover:bg-gray-200">
                    <CircleHelp className="w-4 h-4 cursor-pointer stroke-2" />
                    Help
                </button>
                <button className="cursor-pointer rounded-full hover:bg-gray-200 p-2 border-1">
                    <BellIcon className="w-4 h-4 stroke-1"></BellIcon>
                </button>
                <UserDropdown userName={userName} userImage={userImage} />  
            </div>
        </div>
    )
}