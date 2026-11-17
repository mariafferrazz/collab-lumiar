import "server-only";

import { io } from "next/cache";

import { getRequiredServerEnvironmentVariable } from "@/lib/server/env";
import type {
  InstagramFeedResult,
  InstagramMediaType,
  InstagramPost,
} from "@/types/instagram";

const INSTAGRAM_API_VERSION = "v27.0";
const MAX_POSTS = 6;
const MEDIA_FIELDS = [
  "id",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "caption",
  "timestamp",
].join(",");

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function parseMediaType(value: string | null): InstagramMediaType | null {
  if (value === "IMAGE" || value === "VIDEO" || value === "CAROUSEL_ALBUM") {
    return value;
  }

  return null;
}

function parsePost(value: unknown): InstagramPost | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const id = readString(record, "id");
  const mediaType = parseMediaType(readString(record, "media_type"));
  const mediaUrl = readString(record, "media_url");
  const thumbnailUrl = readString(record, "thumbnail_url");
  const permalink = readString(record, "permalink");
  const caption = readString(record, "caption");
  const timestamp = readString(record, "timestamp");
  const imageUrl = mediaType === "VIDEO" ? thumbnailUrl || mediaUrl : mediaUrl;

  if (!id || !mediaType || !imageUrl || !permalink || !timestamp) {
    return null;
  }

  const publishedAt = new Date(timestamp);

  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  return {
    id,
    mediaType,
    imageUrl,
    permalink,
    caption,
    publishedAt: publishedAt.toISOString(),
  };
}

function hasExpiredToken(payload: unknown, status: number): boolean {
  if (status === 401) {
    return true;
  }

  const payloadRecord = asRecord(payload);
  const errorRecord = payloadRecord ? asRecord(payloadRecord.error) : null;

  if (!errorRecord) {
    return false;
  }

  const code = readNumber(errorRecord, "code");
  const subcode = readNumber(errorRecord, "error_subcode");

  return code === 102 || code === 190 || subcode === 463 || subcode === 467;
}

export async function getLatestInstagramPosts(
  limit = MAX_POSTS,
): Promise<InstagramFeedResult> {
  await io();

  let accessToken: string;
  let userId: string;

  try {
    accessToken = getRequiredServerEnvironmentVariable(
      "INSTAGRAM_ACCESS_TOKEN",
    );
    userId = getRequiredServerEnvironmentVariable("INSTAGRAM_USER_ID");
  } catch {
    return { status: "unconfigured", posts: [] };
  }

  if (!/^\d+$/.test(userId)) {
    return { status: "error", posts: [] };
  }

  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), MAX_POSTS);
  const url = new URL(
    `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${userId}/media`,
  );
  url.searchParams.set("fields", MEDIA_FIELDS);
  url.searchParams.set("limit", String(safeLimit));
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      return { status: "error", posts: [] };
    }

    if (!response.ok) {
      return hasExpiredToken(payload, response.status)
        ? { status: "token-expired", posts: [] }
        : { status: "error", posts: [] };
    }

    const payloadRecord = asRecord(payload);
    const data = payloadRecord?.data;

    if (!Array.isArray(data) || data.length === 0) {
      return { status: "empty", posts: [] };
    }

    const posts = data
      .map(parsePost)
      .filter((post): post is InstagramPost => post !== null)
      .slice(0, safeLimit);

    return posts.length > 0
      ? { status: "ready", posts }
      : { status: "empty", posts: [] };
  } catch {
    return { status: "error", posts: [] };
  }
}
