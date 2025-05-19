import Link from "next/link";

export function SignInPage() {
    return (
        <div className="w-full flex flex-col items-center justify-center gap-12 px-4 py-20">
          <img src="/assets/airtable_logo.svg" alt="AirTable Logo" />
            <Link
                href="/api/auth/signin"
                className="rounded-full bg-white border border-gray-200 px-10 py-3 font-semibold no-underline transition hover:bg-gray-200">
                Sign in with Google
              </Link>
        </div>
    )
}