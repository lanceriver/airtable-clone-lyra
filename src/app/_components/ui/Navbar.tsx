"use client";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import Link  from "next/link";

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
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Avatar className="rounded-full w-10 h-10">
                            <AvatarImage src={userImage} alt="Profile" />
                            <AvatarFallback>
                                {userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>
                            {userName}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator>
                        </DropdownMenuSeparator>
                        <DropdownMenuItem>
                            <Link href="/api/auth/signout">
                                Log out
                            </Link>
                            </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}