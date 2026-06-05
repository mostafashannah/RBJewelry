export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION ?? "2024-10";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const mimeType = file.type || "image/jpeg";
  const filename = file.name || `inventory-${Date.now()}.jpg`;

  // Upload to Shopify as a custom collection image (re-used as CDN storage)
  // We use the Files API to store images on Shopify's CDN
  const stageRes = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({
        query: `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters { name value }
            }
            userErrors { field message }
          }
        }`,
        variables: {
          input: [{
            filename,
            mimeType,
            httpMethod: "POST",
            resource: "IMAGE",
          }],
        },
      }),
    }
  );

  const stageJson = await stageRes.json();
  const target = stageJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) {
    return NextResponse.json({ error: "Shopify stage upload failed", detail: stageJson }, { status: 500 });
  }

  // Upload the file to the staged URL
  const uploadForm = new FormData();
  for (const p of target.parameters) {
    uploadForm.append(p.name, p.value);
  }
  uploadForm.append("file", new Blob([buffer], { type: mimeType }), filename);

  const uploadRes = await fetch(target.url, { method: "POST", body: uploadForm });
  if (!uploadRes.ok) {
    return NextResponse.json({ error: "Upload to CDN failed", status: uploadRes.status }, { status: 500 });
  }

  // Create a Shopify file so it has a permanent CDN URL
  const fileRes = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({
        query: `mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files { ... on MediaImage { image { url } } }
            userErrors { field message }
          }
        }`,
        variables: {
          files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }],
        },
      }),
    }
  );

  const fileJson = await fileRes.json();
  const imageUrl = fileJson?.data?.fileCreate?.files?.[0]?.image?.url;

  if (imageUrl) {
    return NextResponse.json({ url: imageUrl });
  }

  // Fallback: return the resourceUrl directly (works for display)
  return NextResponse.json({ url: target.resourceUrl });
}
