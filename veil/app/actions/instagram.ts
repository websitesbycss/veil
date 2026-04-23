"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const generateCaptionSchema = z.object({
  weddingId: z.string().uuid(),
  imageUrls: z.string().max(5000),
  vibe: z.string().max(500).optional(),
});

const createPostSchema = z.object({
  weddingId: z.string().uuid(),
  caption: z.string().max(2200),
  hashtags: z.string().max(500).optional(),
  imageUrls: z.string().max(5000),
  scheduledAt: z.string().optional(),
});

const deletePostSchema = z.object({
  postId: z.string().uuid(),
});

async function getPhotographerAndWedding(weddingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, studio_name, style_notes, ig_access_token")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return null;

  type WeddingWithClients = {
    id: string;
    wedding_date: string | null;
    venue_name: string | null;
    style_vibe: string | null;
    client1: { first_name: string; last_name: string } | null;
    client2: { first_name: string; last_name: string } | null;
  };
  const { data: wedding } = (await supabase
    .from("weddings")
    .select(
      `id, wedding_date, venue_name, style_vibe,
       client1:clients!weddings_client1_id_fkey(first_name, last_name),
       client2:clients!weddings_client2_id_fkey(first_name, last_name)`
    )
    .eq("id", weddingId)
    .eq("photographer_id", photographer.id)
    .single()) as { data: WeddingWithClients | null };
  if (!wedding) return null;

  return { supabase, photographer, wedding };
}

export async function generateIgCaption(formData: FormData) {
  const parsed = generateCaptionSchema.safeParse({
    weddingId: formData.get("weddingId"),
    imageUrls: formData.get("imageUrls") ?? "",
    vibe: formData.get("vibe") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getPhotographerAndWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const { photographer, wedding } = ctx;

  const c1 = wedding.client1;
  const c2 = wedding.client2;
  const firstNames =
    [c1, c2]
      .filter(Boolean)
      .map((c) => c!.first_name)
      .join(" & ") || "the couple";

  const studioName = photographer.studio_name ?? "the studio";
  const venueName = wedding.venue_name ?? "";
  const styleVibe = wedding.style_vibe ?? parsed.data.vibe ?? "";

  const systemPrompt = `You are writing Instagram captions for ${studioName}, a wedding photography studio.
${photographer.style_notes ? `Studio voice: ${photographer.style_notes}\n` : ""}
Craft a single Instagram caption for a wedding photo carousel. Requirements:
- Warm, story-first, never generic
- 80–200 words for the caption body
- Address the couple by first names
- End with 2–3 blank lines then a row of 12–20 hashtags mixing: venue-specific tag, city tag (if implied), and wedding photography tags
- No emojis unless the studio style notes call for them
- Output the caption only — no preamble`;

  const userPrompt = `Write a caption for a wedding carousel post:
- Couple: ${firstNames}
- Venue: ${venueName || "not specified"}
- Vibe: ${styleVibe || "not specified"}
- Number of photos in carousel: ${
    parsed.data.imageUrls.split(/[\n,]+/).filter((s) => s.trim()).length
  }`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  if (!content) return { error: "AI returned an empty response." };

  // Split caption from trailing hashtag block
  const hashtagMatches = content.match(/#[\w\d_]+/g) ?? [];
  const hashtags = hashtagMatches.join(" ");
  const caption = content.replace(/#[\w\d_]+/g, "").trim();

  return { caption, hashtags };
}

export async function createIgPost(formData: FormData) {
  const parsed = createPostSchema.safeParse({
    weddingId: formData.get("weddingId"),
    caption: formData.get("caption"),
    hashtags: formData.get("hashtags") || undefined,
    imageUrls: formData.get("imageUrls") ?? "",
    scheduledAt: formData.get("scheduledAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getPhotographerAndWedding(parsed.data.weddingId);
  if (!ctx) return { error: "Not authorized." };

  const imageArr = parsed.data.imageUrls
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (imageArr.length === 0) return { error: "At least one image URL is required." };

  const status = parsed.data.scheduledAt ? "scheduled" : "draft";

  const { data: post, error } = await ctx.supabase
    .from("ig_posts")
    .insert({
      wedding_id: parsed.data.weddingId,
      photographer_id: ctx.photographer.id,
      caption: parsed.data.caption,
      hashtags: parsed.data.hashtags ?? null,
      image_urls: imageArr,
      status,
      scheduled_at: parsed.data.scheduledAt ?? null,
    })
    .select("id")
    .single();

  if (error || !post) {
    console.error("IG post insert error:", error?.code);
    return { error: "Failed to save post." };
  }

  revalidatePath(`/weddings/${parsed.data.weddingId}/instagram`);
  return { postId: post.id };
}

export async function publishIgPost(formData: FormData) {
  const parsed = deletePostSchema.safeParse({
    postId: formData.get("postId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id, ig_access_token")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return { error: "Not authorized." };
  if (!photographer.ig_access_token) {
    return { error: "Instagram is not connected. Connect your account first." };
  }

  const { data: post } = await supabase
    .from("ig_posts")
    .select("id, wedding_id, caption, hashtags, image_urls, status")
    .eq("id", parsed.data.postId)
    .eq("photographer_id", photographer.id)
    .single();
  if (!post) return { error: "Post not found." };
  if (post.status === "published") return { error: "Already published." };

  let creds: { ig_user_id: string; access_token: string };
  try {
    creds = JSON.parse(decrypt(photographer.ig_access_token));
  } catch {
    return { error: "Could not read Instagram credentials." };
  }

  const images = (post.image_urls ?? []) as string[];
  if (images.length === 0) return { error: "Post has no images." };

  const fullCaption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");

  try {
    let creationId: string;

    if (images.length === 1) {
      // Single image
      const createRes = await fetch(
        `https://graph.instagram.com/v21.0/${creds.ig_user_id}/media`,
        {
          method: "POST",
          body: new URLSearchParams({
            image_url: images[0],
            caption: fullCaption,
            access_token: creds.access_token,
          }),
        }
      );
      const createJson = (await createRes.json()) as { id?: string; error?: unknown };
      if (!createJson.id) {
        console.error("IG single create error:", createJson.error);
        return { error: "Instagram rejected the media container." };
      }
      creationId = createJson.id;
    } else {
      // Carousel
      const childIds: string[] = [];
      for (const url of images) {
        const childRes = await fetch(
          `https://graph.instagram.com/v21.0/${creds.ig_user_id}/media`,
          {
            method: "POST",
            body: new URLSearchParams({
              image_url: url,
              is_carousel_item: "true",
              access_token: creds.access_token,
            }),
          }
        );
        const childJson = (await childRes.json()) as { id?: string };
        if (!childJson.id) {
          return { error: "Instagram rejected one of the carousel images." };
        }
        childIds.push(childJson.id);
      }
      const carouselRes = await fetch(
        `https://graph.instagram.com/v21.0/${creds.ig_user_id}/media`,
        {
          method: "POST",
          body: new URLSearchParams({
            media_type: "CAROUSEL",
            children: childIds.join(","),
            caption: fullCaption,
            access_token: creds.access_token,
          }),
        }
      );
      const carouselJson = (await carouselRes.json()) as { id?: string };
      if (!carouselJson.id) {
        return { error: "Instagram rejected the carousel container." };
      }
      creationId = carouselJson.id;
    }

    // Publish
    const publishRes = await fetch(
      `https://graph.instagram.com/v21.0/${creds.ig_user_id}/media_publish`,
      {
        method: "POST",
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: creds.access_token,
        }),
      }
    );
    const publishJson = (await publishRes.json()) as { id?: string; error?: unknown };
    if (!publishJson.id) {
      console.error("IG publish error:", publishJson.error);
      await supabase
        .from("ig_posts")
        .update({ status: "failed" })
        .eq("id", post.id);
      return { error: "Instagram publish step failed." };
    }

    await supabase
      .from("ig_posts")
      .update({
        status: "published",
        ig_media_id: publishJson.id,
      })
      .eq("id", post.id);

    revalidatePath(`/weddings/${post.wedding_id}/instagram`);
    return { success: true, mediaId: publishJson.id };
  } catch (err) {
    console.error("IG publish exception:", err);
    return { error: "Instagram request failed." };
  }
}

export async function deleteIgPost(formData: FormData) {
  const parsed = deletePostSchema.safeParse({
    postId: formData.get("postId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!photographer) return { error: "Not authorized." };

  const { data: post } = await supabase
    .from("ig_posts")
    .select("id, wedding_id")
    .eq("id", parsed.data.postId)
    .eq("photographer_id", photographer.id)
    .single();
  if (!post) return { error: "Post not found." };

  await supabase
    .from("ig_posts")
    .delete()
    .eq("id", parsed.data.postId)
    .eq("photographer_id", photographer.id);

  revalidatePath(`/weddings/${post.wedding_id}/instagram`);
  return { success: true };
}
