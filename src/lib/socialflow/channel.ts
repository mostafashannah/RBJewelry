import { Platform } from "@prisma/client";

export type SocialFlowChannel = "instagram" | "messenger" | "fb_comment" | "ig_comment" | "whatsapp";

const CHANNEL_TO_PLATFORM: Record<SocialFlowChannel, Platform> = {
  instagram: Platform.INSTAGRAM_DM,
  messenger: Platform.FACEBOOK_DM,
  fb_comment: Platform.FACEBOOK_COMMENT,
  ig_comment: Platform.INSTAGRAM_COMMENT,
  whatsapp: Platform.WHATSAPP,
};

const PLATFORM_TO_CHANNEL: Record<Platform, SocialFlowChannel | null> = {
  [Platform.INSTAGRAM_DM]: "instagram",
  [Platform.FACEBOOK_DM]: "messenger",
  [Platform.FACEBOOK_COMMENT]: "fb_comment",
  [Platform.INSTAGRAM_COMMENT]: "ig_comment",
  [Platform.WHATSAPP]: "whatsapp",
};

export function socialFlowChannelToPlatform(channel: string): Platform | null {
  return CHANNEL_TO_PLATFORM[channel as SocialFlowChannel] ?? null;
}

export function platformToSocialFlowChannel(platform: Platform): SocialFlowChannel | null {
  return PLATFORM_TO_CHANNEL[platform] ?? null;
}

export function isCommentChannel(channel: string): boolean {
  return channel === "fb_comment" || channel === "ig_comment";
}
