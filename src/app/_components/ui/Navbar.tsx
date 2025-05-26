"use client";
import { Input } from "~/components/ui/input";
import { UserDropdown } from "./UserDropdown";

export type UserProps = {
    userName: string;
    userImage? : string;
} 

export function Navbar({ userName, userImage }: UserProps  ) {
    return (
        <div className="w-full flex px-8 py-3 justify-between items-center border-b">
            <img src="/assets/airtable_logo.svg" alt="AirTable Logo" />
            <div className="items-center">
                <Input className="rounded-full" type="search" placeholder="Search..."/>
            </div>
            
            <div>
                <UserDropdown userName={userName} userImage={userImage} />  
            </div>
        </div>
    )
}