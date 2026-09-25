import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Issues short-lived tokens so the browser uploads recordings straight to Blob storage.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["audio/*", "video/*"],
        maximumSizeInBytes: 300 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
