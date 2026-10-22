import { PrismaClient } from "@/generated/prisma-v2";

const globalForPrismaV2 = global as unknown as { prismaV2: PrismaClient };

export const prismaV2 =
  globalForPrismaV2.prismaV2 ||
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrismaV2.prismaV2 = prismaV2;
