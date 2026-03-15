"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { clearLocalSession, createLocalSession } from "@/lib/auth/local-session";
import { AccountStatus, ThemePreference, UserRole } from "@prisma/client";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(50),
});

export async function registerAction(formData: FormData) {
  const raw = {
    email: String(formData.get("email") ?? "").toLowerCase(),
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid registration details.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("Email is already in use.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      passwordHash,
      settings: {
        create: {
          themePreference: ThemePreference.LIGHT,
        },
      },
    },
  });

  await createLocalSession(parsed.data.email);
  redirect("/home");
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      email: true,
      passwordHash: true,
      accountStatus: true,
      role: true,
    },
  });

  if (!user || !user.passwordHash || user.accountStatus !== AccountStatus.ACTIVE) {
    redirect("/login?error=credentials");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    redirect("/login?error=credentials");
  }

  await createLocalSession(user.email);
  redirect(user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? "/admin" : "/home");
}

export async function signInWithGoogleAction() {
  await clearLocalSession();
  await signIn("google", { redirectTo: "/home" });
}

export async function signOutAction() {
  await clearLocalSession();

  try {
    await signOut({ redirectTo: "/" });
  } catch {
    redirect("/");
  }
}
