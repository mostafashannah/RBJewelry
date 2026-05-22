import { graphGet } from "./graph-api";

const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID!;
const USER_TOKEN = process.env.META_USER_ACCESS_TOKEN;

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  insights?: {
    data: {
      spend: string;
      impressions: string;
      reach: string;
      clicks: string;
      ctr: string;
      cpc: string;
      actions?: { action_type: string; value: string }[];
    }[];
  };
}

export async function getCampaigns(datePreset = "last_30d"): Promise<MetaCampaign[]> {
  const fields = [
    "id", "name", "status", "objective",
    `insights.date_preset(${datePreset}){spend,impressions,reach,clicks,ctr,cpc,actions}`,
  ].join(",");

  const data = await graphGet<{ data: MetaCampaign[] }>(
    `/${AD_ACCOUNT}/campaigns`,
    USER_TOKEN,
    { fields, limit: "20" }
  );
  return data.data;
}

export async function getAdSets(campaignId: string, datePreset = "last_30d") {
  const fields = [
    "id", "name", "status", "daily_budget",
    `insights.date_preset(${datePreset}){spend,impressions,reach,clicks,ctr}`,
  ].join(",");

  const data = await graphGet<{ data: unknown[] }>(
    `/${campaignId}/adsets`,
    USER_TOKEN,
    { fields }
  );
  return data.data;
}
