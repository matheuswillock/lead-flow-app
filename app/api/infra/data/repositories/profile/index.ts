import prisma from "@/app/api/infra/data/prisma";
import type { UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "",
);

export const findProfileBySupabaseId = async (
  supabaseId: string
) => {
    try {
        const profile = await prisma.profile.findUnique({
            where: { supabaseId },
        });
        return profile ?? null;
    } catch (error) {
        console.error("Error fetching profile:", error);
        return null;
    }
}

export const existingTeacher = async (
    fullName: string,
    phone: string,
    email: string,
): Promise<boolean> => {
  const teacher = await prisma.profile.findFirst({
    where: {
      fullName: fullName,
      phone: phone,
      email: email,
    },
  });
  return teacher !== null;
};

export const createProfile = async (
    fullName: string,
    phone: string,
    password: string,
    email: string,
    role: UserRole
) => {
    try {
        // Verifica se já existe um perfil com o mesmo nome, email ou telefone
        const existingProfile = await prisma.profile.findFirst({
            where: {
                OR: [
                    { fullName },
                    { phone },
                    { email },
                ],
            },
        });

        if (existingProfile) {
            console.error("Usuário já existe com o mesmo nome, email ou telefone.");
            return null;
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
        });

        if (error || !data.user) {
            console.error("Error creating user in Supabase:", error);
            return null;
        }

        const profile = await prisma.profile.create({
            data: {
                id: crypto.randomUUID(),
                supabaseId: data.user.id,
                fullName,
                phone,
                email,
                role,
            },
        });
        return profile;
    } catch (error) {
        console.error("Error creating profile:", error);
        return null;
    }
}

export const updateProfile = async (
  supabaseId: string,
    updates: { fullName?: string; phone?: string; role?: UserRole }
) => {
    try {
            const profile = await prisma.profile.update({
            where: { supabaseId },
            data: {
                fullName: updates.fullName,
                phone: updates.phone,
                    role: updates.role,
            },
        });
        return profile;
    } catch (error) {
        console.error("Error updating profile:", error);
        return null;
    }
}

export const deleteProfile = async (supabaseId: string) => {
    try {
        const profile = await prisma.profile.delete({
            where: { supabaseId },
        });
        return profile;
    } catch (error) {
        console.error("Error deleting profile:", error);
        return null;
    }
}