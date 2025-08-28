import { performance } from 'perf_hooks';
import https from 'https';
import http from 'http'; // Import the http module
import { URL } from 'url';
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
    const urlObj = new URL(url);
    // Choose the correct transport (http or https) based on the URL protocol
    const transport = urlObj.protocol === 'https:' ? https : http;

    const timings = {
      start: 0,
      socket: 0,
      lookup: 0,
      connect: 0,
      secureConnect: 0,
      response: 0,
      end: 0,
    };

    const req = transport.get(url, { // Use the selected transport
      headers: { 'User-Agent': 'BetterUpStack-Worker/1.0' }
    }, (res) => {
      res.on('data', () => {}); // Consume data to fire 'end' event
      res.on('end', async () => {
        timings.end = performance.now();
        const status = res.statusCode && res.statusCode >= 200 && res.statusCode < 400 ? "Up" : "Down";

        const connection_time_ms = Math.round(timings.connect - timings.socket);
        // For http, secureConnect is 0, so TLS handshake will be 0.
        const tls_handshake_time_ms = Math.round(timings.secureConnect - timings.connect);
        const data_transfer_time_ms = Math.round(timings.end - timings.response);
        const total_response_time_ms = Math.round(timings.end - timings.start);
        
        await prisma.website_tick.create({
          data: {
            connection_time_ms,
            tls_handshake_time_ms,
            data_transfer_time_ms,
            total_response_time_ms,
            status,
            region_id: REGION_ID,
            website_id: websiteId
          }
        });

        await NotificationService.checkAndNotifyStatusChange(websiteId, status, REGION_ID);
        resolve();
      });
    });

    req.on('socket', (socket) => {
      timings.start = performance.now();
      timings.socket = performance.now();

      socket.on('lookup', () => { timings.lookup = performance.now(); });
      socket.on('connect', () => { timings.connect = performance.now(); });
      socket.on('secureConnect', () => { timings.secureConnect = performance.now(); });
    });

    req.on('response', () => {
        timings.response = performance.now();
    });

    req.on('error', async (err) => {
        const total_response_time_ms = Math.round(performance.now() - timings.start);
        await prisma.website_tick.create({
          data: {
            connection_time_ms: 0,
            tls_handshake_time_ms: 0,
            data_transfer_time_ms: 0,
            total_response_time_ms,
            status: "Down",
            region_id: REGION_ID,
            website_id: websiteId
          }
        });
        await NotificationService.checkAndNotifyStatusChange(websiteId, "Down", REGION_ID);
        resolve();
    });
    
    req.end();
  });
}

main();