const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanParticipantData() {
  console.log('🧹 Purging participant submissions and code drafts...');
  const deletedSubmissions = await prisma.submission.deleteMany();
  const deletedDrafts = await prisma.codeDraft.deleteMany();
  console.log(`✅ Deleted ${deletedSubmissions.count} submissions.`);
  console.log(`✅ Deleted ${deletedDrafts.count} code drafts.`);
  console.log('✨ Participant tables are completely clean!');
}

cleanParticipantData()
  .catch((e) => {
    console.error('Error cleaning participant data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
