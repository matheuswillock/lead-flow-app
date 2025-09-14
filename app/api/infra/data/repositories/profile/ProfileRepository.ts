import prisma from "@/app/api/infra/data/prisma";
import type { UserRole, Profile } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import type { IProfileRepository } from "./IProfileRepository";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);
class PrismaProfileRepository implements IProfileRepository {
    async findBySupabaseId(supabaseId: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findUnique({ where: { supabaseId } });
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile:", error);
            return null;
        }
    }

    async existingByEmailOrPhone(email: string, phone: string): Promise<boolean> {
        const found = await prisma.profile.findFirst({ where: { OR: [{ email }, { phone }] } });
        return found !== null;
    }

    async createProfile(
        fullName: string,
        phone: string,
        password: string,
        email: string,
        role: UserRole
    ): Promise<string | null> {
        try {
            const existingProfile = await prisma.profile.findFirst({
                where: { OR: [{ email }, { phone }] },
            });
            if (existingProfile) {
                console.error("Usuário já existe com o mesmo email ou telefone.");
                return null;
            }

            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
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
            return profile.id;
        } catch (error) {
            console.error("Error creating profile:", error);
            return null;
        }
    }

    async updateProfile(
        supabaseId: string,
        updates: { fullName?: string; phone?: string; role?: UserRole }
    ): Promise<Profile | null> {
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

    async deleteProfile(supabaseId: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.delete({ where: { supabaseId } });
            return profile;
        } catch (error) {
            console.error("Error deleting profile:", error);
            return null;
        }
    }
}

export const profileRepository: IProfileRepository = new PrismaProfileRepository();
export type { IProfileRepository };