export type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

export interface InstagramPost {
  id: string;
  mediaType: InstagramMediaType;
  imageUrl: string;
  permalink: string;
  caption: string | null;
  publishedAt: string;
}

export type InstagramFeedResult =
  | { status: "ready"; posts: InstagramPost[] }
  | {
      status: "unconfigured" | "empty" | "token-expired" | "error";
      posts: [];
    };
