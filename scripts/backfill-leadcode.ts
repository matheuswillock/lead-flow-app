import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const buildLeadCode = (name: string) => {
  const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const firstLetter = (clean[0] || "L").toUpperCase();
  const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();
  const digitsLength = 4 + Math.floor(Math.random() * 3);
  const digits = Array.from({ length: digitsLength }, () => Math.floor(Math.random() * 10)).join("");
  return `${firstLetter}${digits}${lastLetter}`;
};

const generateUniqueLeadCode = async (name: string) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = buildLeadCode(name);
    const existing = await prisma.lead.findUnique({ where: { leadCode: code } });
    if (!existing) return code;
  }

  const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const firstLetter = (clean[0] || "L").toUpperCase();
  const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();
  const fallbackDigits = Date.now().toString().slice(-6);
  return `${firstLetter}${fallbackDigits}${lastLetter}`;
};

const run = async () => {
  const leads = await prisma.lead.findMany({
    where: { 
      leadCode: ''
    },
    select: { id: true, name: true },
  });

  for (const lead of leads) {
    const code = await generateUniqueLeadCode(lead.name);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { leadCode: code },
    });
  }
};

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Lead code backfill failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
