import { AirtableMark } from "~/components/at/AirtableMark";

import { signInWithGoogle } from "./actions";
import { GoogleSignInButton } from "./GoogleSignInButton";

const REPO_URL = "https://github.com/lanceriver/airtable-clone-lyra";

const FACTS = [
  "1,000,000 rows that scroll without lag",
  "Search, filter and sort run in Postgres",
  "Keyboard editing like a spreadsheet",
];

export function SignInPage() {
  return (
    <div className="text-at-text flex min-h-screen bg-white">
      <div className="flex min-h-screen w-full flex-col justify-center p-12 lg:w-1/2 lg:flex-none">
        <div className="mx-auto flex w-full max-w-[500px] flex-1 flex-col justify-center">
          <AirtableMark size={40} aria-label="Airtable" />
          <h1 className="mt-6 text-[32px] leading-10 font-semibold">
            Sign in to Airtable
          </h1>
          <form action={signInWithGoogle} className="mt-8">
            <GoogleSignInButton />
          </form>
        </div>
        <p className="text-at-text-muted mx-auto w-full max-w-[500px] text-xs">
          A portfolio clone of Airtable built with the T3 stack. Not affiliated
          with Airtable.{" "}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-at-blue hover:underline"
          >
            View on GitHub
          </a>
        </p>
      </div>
      <aside className="hidden flex-1 items-center justify-center bg-gradient-to-br from-[#e5f0ff] via-[#d4e6ff] to-[#b9d5fb] p-12 lg:flex">
        <ul className="flex max-w-[420px] flex-col gap-4">
          {FACTS.map((fact) => (
            <li
              key={fact}
              className="rounded-md bg-white/80 px-6 py-5 text-[18px] leading-6 font-semibold shadow-sm"
            >
              {fact}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
