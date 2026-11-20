import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/server/auth";

export const maxDuration = 15;

export const { GET, POST } = toNextJsHandler(auth);
