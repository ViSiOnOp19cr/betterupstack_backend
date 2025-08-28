import prisma from "../lib/db";
import { xAddBulk } from "../redis";

async function main() {
    let websites = await prisma.website.findMany({
        select: {
            url: true,
            id: true
        }
    })
  
    await xAddBulk(websites.map((w: { url: string; id: string }) => ({
        url: w.url,
        id: w.id
    })));
}

setInterval(() => {
    main()
}, 1 * 1000 * 60)

main()