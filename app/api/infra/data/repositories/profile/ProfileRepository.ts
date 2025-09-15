import prisma from "@/app/api/infra/data/prisma";
import type { UserRole, Profile } from "@prisma/client";
import { createClient } from "@supabase/supabase-js"
import type { IProfileRepository } from "./IProfileRepository";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
    throw new Error("Supabase URL or Service Key is not defined in environment variables.");
}

const supabase = createClient(url, serviceKey)

class PrismaProfileRepository implements IProfileRepository {
    async findBySupabaseId(supabaseId: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findUnique({ where: { supabaseId } });
            console.info("Fetched profile:", profile);
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile:", error);
            return null;
        }
    }

    async existingByEmailOrPhone(email: string, phone: string): Promise<boolean> {
        try {
            const profile = await prisma.profile.findFirst({
                where: { OR: [{ email }, { phone }] },
            });
            return !!profile;
        } catch (error) {
            console.error("Error checking existing profile:", error);
            return false;
        }

    }

    async createProfile(
        fullName: string,
        phone: string,
        password: string,
        email: string,
        role: UserRole
    ): Promise<string | null> {
        try {
            // 1) Tenta encontrar usuário existente no Auth (idempotente)
            const lookupByEmail = async (): Promise<string | null> => {
                let page = 1
                const perPage = 1000
                for (;;) {
                    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
                    if (error) break
                    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
                    if (found) return found.id
                    if (data.users.length < perPage) return null
                    page += 1
                }
                return null
            }

            let supabaseUserId = await lookupByEmail()

            if (!supabaseUserId) {
                try {
                    console.info("Creating user via admin.createUser...")
                    const { data, error } = await supabase.auth.admin.createUser({
                        email: email,
                        password: password,
                        email_confirm: true,
                    })

                    if (error) {
                        console.error("admin.createUser failed:", error)
                        return null
                    }

                    if (!data?.user?.id) {
                        console.error("No user ID returned from admin.createUser")
                        return null
                    }

                    supabaseUserId = data.user.id
                    console.info("User created successfully:", supabaseUserId)
                } catch (createError) {
                    console.error("Error creating user:", createError)
                    return null
                }
            }

            if (supabaseUserId) {
                console.info("Creating profile in database for user:", supabaseUserId)
                try {
                    const profile = await prisma.profile.upsert({
                        where: { supabaseId: supabaseUserId },
                        update: { fullName, phone, email, role },
                        create: {
                            supabaseId: supabaseUserId,
                            fullName,
                            phone,
                            email,
                            role,
                        },
                    })
                    
                    return profile.id
                } catch (prismaError) {
                    console.error("Error creating profile in database:", prismaError)
                    try {
                        await supabase.auth.admin.deleteUser(supabaseUserId)
                        console.info("Deleted Auth user due to profile creation failure")
                    } catch (deleteError) {
                        console.warn("Failed to cleanup Auth user:", deleteError)
                    }
                    return null
                }
            }

            return null
        } catch (error) {
            console.error("Error creating profile:", error);
            return null;
        }
    }

    async updateProfile(
        supabaseId: string,
        updates: { fullName?: string; phone?: string; email?: string }
    ): Promise<Profile | null> {
        try {
            const updateData: any = {};
            
            if (updates.fullName !== undefined) {
                updateData.fullName = updates.fullName;
            }
            
            if (updates.phone !== undefined) {
                updateData.phone = updates.phone;
            }
            
            if (updates.email !== undefined) {
                updateData.email = updates.email;
            }

            const profile = await prisma.profile.update({
                where: { supabaseId },
                data: updateData,
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