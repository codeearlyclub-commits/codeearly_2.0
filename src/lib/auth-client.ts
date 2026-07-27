"use client";

/**
 * Better Auth browser client.
 *
 * Same endpoints the Capacitor app calls with a bearer token; here the browser
 * uses cookies. baseURL stays relative so the client works unchanged on
 * localhost, on a preview host, and in production without a rebuild.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
