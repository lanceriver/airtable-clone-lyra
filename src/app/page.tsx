import { HomeDashboard } from "./_components/home/HomeDashboard";
import { SignInPage } from "./_components/auth/SignInPage";
import SuperJSON from "superjson";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
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
    );
  }

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: { session, db, headers: new Headers() },
    transformer: SuperJSON,
  });

  const bases = await helpers.base.list.fetch();

  return (
    <HydrateClient>
      <main className="text-at-text h-screen overflow-hidden">
        <HomeDashboard
          initialBases={bases}
          user={{
            name: session.user.name ?? "",
            email: session.user.email,
            image: session.user.image,
          }}
        />
      </main>
    </HydrateClient>
  );
}
