"use server";

import { signIn } from "~/server/auth";

/** Starts the Google OAuth flow directly, skipping NextAuth's sign-in page. */
export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}
