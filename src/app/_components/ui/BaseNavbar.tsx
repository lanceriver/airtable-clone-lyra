import { UserDropdown } from "./UserDropdown";
import { Button } from "~/components/ui/button";
import Link from "next/link";

type BaseNavbarProps = {
    baseName: string;
    baseId: string;
}

export function BaseNavbar({ baseName, baseId }: BaseNavbarProps) {
    return (
        <div>
            <div className="bg-red-400 w-full px-5 py-3 flex flex-row justify-between items-center">
                {/* Left group */}
            <div className="flex flex-row items-center gap-x-6">
                <Link href="/"><h1 className="text-xl text-white font-semibold">{baseName}</h1></Link>
                <Button variant="ghost" className="text-sm rounded-md bg-inherit text-white">Data</Button>
                <Button variant="ghost" className="text-sm rounded-md bg-inherit  text-white">Automations</Button>
                <Button variant="ghost" className="text-sm rounded-md bg-inherit  text-white">Interfaces</Button>
                <Button variant="ghost" className="text-sm rounded-md bg-inherit  text-white">Forms</Button>
            </div>
            {/* Right group */}
            <div className="flex flex-row items-center gap-x-6">
                <Button variant="ghost" className="text-sm rounded-md bg-inherit  text-white">Share</Button>
                <Button variant="ghost" className="text-sm rounded-md bg-inherit  text-white">Settings</Button>
                <UserDropdown userName="John Doe" userImage="/assets/user_image.png" />
            </div>
            </div>
        </div>
    );
}