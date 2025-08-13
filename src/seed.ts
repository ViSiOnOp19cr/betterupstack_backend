import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import prisma from './lib/db';

dotenv.config();

async function main() {
    const passwordAlice = await bcrypt.hash('password123', 10);
    const passwordBob = await bcrypt.hash('password123', 10);

    // Clean existing data (order matters because of FKs)
    await prisma.website_tick.deleteMany({});
    await prisma.website.deleteMany({});
    await prisma.region.deleteMany({});
    await prisma.user.deleteMany({});

    // Users
    const alice = await prisma.user.create({
        data: {
            username: 'alice',
            password: passwordAlice
        }
    });
    const bob = await prisma.user.create({
        data: {
            username: 'bob',
            password: passwordBob
        }
    });

    // Regions
    const usEast = await prisma.region.create({ data: { name: 'us-east-1' } });
    const euWest = await prisma.region.create({ data: { name: 'eu-west-1' } });

    // Websites
    const aliceSite1 = await prisma.website.create({
        data: {
            url: 'https://example.com',
            user_id: alice.id,
            time_added: new Date()
        }
    });
    const aliceSite2 = await prisma.website.create({
        data: {
            url: 'https://httpstat.us/200',
            user_id: alice.id,
            time_added: new Date()
        }
    });
    const bobSite1 = await prisma.website.create({
        data: {
            url: 'https://httpstat.us/503',
            user_id: bob.id,
            time_added: new Date()
        }
    });

    // Seed a couple of ticks
    await prisma.website_tick.createMany({
        data: [
            {
                response_time_ms: 123,
                status: 'Up',
                region_id: usEast.id,
                website_id: aliceSite1.id
            },
            {
                response_time_ms: 456,
                status: 'Down',
                region_id: euWest.id,
                website_id: bobSite1.id
            }
        ]
    });

    console.log('Seed completed:', {
        users: [alice.username, bob.username],
        regions: [usEast.name, euWest.name],
        websites: [aliceSite1.url, aliceSite2.url, bobSite1.url]
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });


