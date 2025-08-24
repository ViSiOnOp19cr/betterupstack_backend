import axios from "axios";
import { xAckBulk, xReadGroup } from "../redis";
import prisma from "../lib/db";
import { NotificationService } from "../services/notificationService";
import dotenv from 'dotenv';
dotenv.config();

const REGION_ID = process.env.REGION_ID!;
const WORKER_ID = process.env.WORKER_ID!;

if (!REGION_ID) {
    throw new Error("Region not provided");
}

if (!WORKER_ID) {
    throw new Error("worker not provided");
}

async function main() {
    while(1) {
        const response = await xReadGroup(REGION_ID, WORKER_ID);

        if (!response) {
            continue;
        }

        let promises = response.map(({message}: {message: {url: string; id: string}}) => fetchWebsite(message.url, message.id))
        await Promise.all(promises);


        xAckBulk(REGION_ID, response.map(({id}: {id: string}) => id));
    }
}



async function fetchWebsite(url: string, websiteId: string) {
  return new Promise<void>((resolve) => {
    const startTime = Date.now();

    axios.get(url, { timeout: 10000 }) 
      .then(async (response) => { 
        const endTime = Date.now();
        const status = response.status >= 200 && response.status < 300 ? "Up" : "Down";
        
        await prisma.website_tick.create({
          data: {
            response_time_ms: endTime - startTime,
            status,
            region_id: REGION_ID,
            website_id: websiteId
          }
        });

        await NotificationService.checkAndNotifyStatusChange(
          websiteId, 
          status, 
          REGION_ID
        );
        
        resolve();
      })
      .catch(async (error) => {
        const endTime = Date.now();
        
        await prisma.website_tick.create({
          data: {
            response_time_ms: endTime - startTime,
            status: "Down",
            region_id: REGION_ID,
            website_id: websiteId
          }
        });

        await NotificationService.checkAndNotifyStatusChange(
          websiteId, 
          "Down", 
          REGION_ID
        );
        
        resolve();
      });
  });
}

main();