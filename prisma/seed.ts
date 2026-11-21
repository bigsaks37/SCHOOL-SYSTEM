import { PrismaClient } from "@prisma/client";
import { seedGhanaSchoolDemo } from "../src/lib/demoSeeder";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Sankofa Preparatory & JHS (Complete Ghanaian Basic SMS)...");
  const result = await seedGhanaSchoolDemo(prisma);
  console.log(
    `Seeding completed successfully (${result.departments} departments, ${result.classes} classes, ${result.teachers} teachers, ${result.students} students).`
  );
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
