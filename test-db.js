require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    // Try creating a test user
    const user = await prisma.user.create({
        data: {
            name: "Test Company",
            ebsId: "EBS-001",
            brn: "BRN123456",
            tan: "TAN789",
            userName: "testuser",
        },
    });
    console.log("Created user:", user);

    // Read it back
    const allUsers = await prisma.user.findMany();
    console.log("All users:", allUsers);

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
    console.log("Test passed and cleaned up.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());