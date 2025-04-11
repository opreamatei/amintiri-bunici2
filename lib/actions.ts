"use server";

import { auth } from "@/auth";
import { parseServerActionResponse } from "@/lib/utils";
import slugify from "slugify";
import { writeClient } from "@/sanity/lib/write-client";

export const createPitch = async (
  state: any,
  form: FormData,
  pitch: string,
) => {
  const session = await auth();

  if (!session)
    return parseServerActionResponse({
      error: "Not signed in",
      status: "ERROR",
    });

  const { title, description, category, link } = Object.fromEntries(
    Array.from(form).filter(([key]) => key !== "pitch"),
  );

  const slug = slugify(title as string, { lower: true, strict: true });

  try {
    const startup = {
      title,
      description,
      category,
      image: link,
      slug: {
        _type: slug,
        current: slug,
      },
      author: {
        _type: "reference",
        _ref: session?.id,
      },
      pitch,
    };

    const result = await writeClient.create({ _type: "startup", ...startup });

    return parseServerActionResponse({
      ...result,
      error: "",
      status: "SUCCESS",
    });
  } catch (error) {
    console.log(error);

    return parseServerActionResponse({
      error: JSON.stringify(error),
      status: "ERROR",
    });
  }
};

export const deleteMemory = async (memoryId: string) => {
  // 1) Check session
  const session = await auth();
  if (!session) {
    return parseServerActionResponse({
      error: "Not signed in",
      status: "ERROR",
    });
  }

  try {
    const result = await writeClient.delete(memoryId);
    return parseServerActionResponse({
      ...result,
      error: "",
      status: "SUCCESS",
    });
  } catch (error) {
    return parseServerActionResponse({
      error: JSON.stringify(error),
      status: "ERROR",
    });
  }
};

export const likePost = async (postId: string) => {
  const session = await auth();
  if (!session) {
    return parseServerActionResponse({
      error: "Not signed in",
      status: "ERROR",
    });
  }

  try {
    // 2) Get the post with its likes
    const post = await writeClient.getDocument(postId);
    if (!post) {
      return parseServerActionResponse({
        error: "Post not found",
        status: "ERROR",
      });
    }

    // 3) Check if the user already liked it
    const alreadyLiked = post.likes?.some(
      (likeRef: { _ref: string }) => likeRef._ref === session.user?.id,
    );

    // 4) If liked, remove user from likes; otherwise, add them
    if (alreadyLiked) {
      await writeClient
        .patch(postId)
        .unset([`likes[_ref=="${session.user?.id}"]`])
        .commit();
    } else {
      await writeClient
        .patch(postId)
        .setIfMissing({ likes: [] })
        .append("likes", [{ _type: "reference", _ref: session.user?.id }])
        .commit();
    }

    return parseServerActionResponse({
      error: "",
      status: "SUCCESS",
    });
  } catch (error) {
    return parseServerActionResponse({
      error: JSON.stringify(error),
      status: "ERROR",
    });
  }
}