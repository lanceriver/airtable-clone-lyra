import { Navbar } from "./_components/ui/Navbar";
import { HomeDashboard } from "./_components/ui/HomeDashboard";
import { SignInPage } from "./_components/ui/SignInPage";
import SuperJSON from "superjson";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { createServerSideHelpers } from '@trpc/react-query/server';
import { appRouter } from "~/server/api/root";
import { db } from "~/server/db";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <HydrateClient>
        <main className="text-black">
          <SignInPage />
        </main>
      </HydrateClient>
    )
  }

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: { session, db, headers: new Headers() },
    transformer: SuperJSON
  });

  const bases = await helpers.base.getBases.fetch()
  const baseIds = bases.map((base) => base.id);
  console.log("Bases: ", bases);

  return (
    <HydrateClient>
      <main className="text-black">
        {session && 
        <div className="h-screen overflow-hidden">
          <Navbar userName={session.user?.name ?? ""} userImage={session.user?.image ?? ""}/>
          <div className="bg-gray-50 min-h-screen">
            <HomeDashboard initialBases={bases}/>
          </div>
        </div>
        }
      </main>
    </HydrateClient>
  );
}
