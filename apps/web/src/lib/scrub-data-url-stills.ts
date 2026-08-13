import { prisma } from "@pool-design/db";

/**
 * Strip legacy data-URL stills in Postgres without shipping them to Vercel.
 * Neon egress is the bytes returned to the app — an in-database UPDATE avoids that.
 */
export async function scrubDataUrlStills(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ProjectShare"
    SET "previewImageUrl" = NULL
    WHERE "previewImageUrl" LIKE 'data:%'
  `;
  await prisma.$executeRaw`
    UPDATE "ProjectLiveSession"
    SET "stateJson" = regexp_replace(
      "stateJson",
      '"previewImageUrl":"data:[^"]*"',
      '"previewImageUrl":null',
      'g'
    )
    WHERE "stateJson" LIKE '%"previewImageUrl":"data:%'
  `;
}
