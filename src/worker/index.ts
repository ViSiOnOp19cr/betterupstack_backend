import https from "https";
import http from "http";
import { URL } from "url";
import { xAckBulk, xReadGroup } from "../redis";
import prisma from "../lib/db";
import { NotificationService } from "../services/notificationService";
import dotenv from "dotenv";
dotenv.config();

const REGION_ID = process.env.REGION_ID!;
const WORKER_ID = process.env.WORKER_ID!;
if (!REGION_ID) throw new Error("Region not provided");
if (!WORKER_ID) throw new Error("worker not provided");


const now = () => process.hrtime.bigint(); // ns
const diffMs = (start?: bigint, end?: bigint) => {
  if (!start || !end) return 0;
  const n = Number(end - start) / 1_000_000;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

async function main() {
  while (true) {
    const items = await xReadGroup(REGION_ID, WORKER_ID);

    if (!items || items.length === 0) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    await Promise.all(
      items.map(({ message }: { message: { url: string; id: string } }) =>
        fetchWebsite(message.url, message.id)
      )
    );

    xAckBulk(
      REGION_ID,
      items.map(({ id }: { id: string }) => id)
    );
  }
}
async function fetchWebsite(url: string, websiteId: string) {
  return new Promise<void>((resolve) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === "https:" ? https : http;

    const agent =
      urlObj.protocol === "https:"
        ? new https.Agent({ keepAlive: false })
        : new http.Agent({ keepAlive: false });

    let t_start: bigint = now();
    let t_socket: bigint | undefined;
    let t_lookup: bigint | undefined;
    let t_connect: bigint | undefined;
    let t_secure: bigint | undefined;
    let t_response: bigint | undefined;
    let t_end: bigint | undefined;

    const req = transport.get(
      url,
      {
        agent,
        headers: { "User-Agent": "BetterUpStack-Worker/1.0" },
      },
      (res) => {
        res.on("data", () => {}); // drain
        res.on("end", async () => {
          t_end = now();

          const status =
            res.statusCode && res.statusCode >= 200 && res.statusCode < 400
              ? "Up"
              : "Down";
          const connection_time_ms = diffMs(t_socket, t_connect);
          const tls_handshake_time_ms =
            urlObj.protocol === "https:" ? diffMs(t_connect, t_secure) : 0;
          const data_transfer_time_ms = diffMs(t_response, t_end);
          const total_response_time_ms = diffMs(t_start, t_end);
          try {
            await prisma.website_tick.create({
              data: {
                connection_time_ms,
                tls_handshake_time_ms,
                data_transfer_time_ms,
                total_response_time_ms,
                status,                 
                region_id: REGION_ID,   
                website_id: websiteId,  
              },
            });
            await NotificationService.checkAndNotifyStatusChange(
              websiteId,
              status,
              REGION_ID
            );
          } catch (e) {
            console.error("DB/Notify error:", e);
          }

          resolve();
        });
      }
    );

    req.on("socket", (socket) => {
      t_socket = now();

      socket.on("lookup", () => {
        t_lookup = now();
      });
      socket.on("connect", () => {
        t_connect = now();
      });
      socket.on("secureConnect", () => {
        t_secure = now();
      });
    });req.on("response", () => {
      t_response = now();
    });

    req.on("error", async (err) => {
      const t_errEnd = now();
      const total_response_time_ms = diffMs(t_start, t_errEnd);

      try {
        await prisma.website_tick.create({
          data: {
            connection_time_ms: 0,
            tls_handshake_time_ms: 0,
            data_transfer_time_ms: 0,
            total_response_time_ms,
            status: "Down",
            region_id: REGION_ID,
            website_id: websiteId,
          },
        });
        await NotificationService.checkAndNotifyStatusChange(
          websiteId,
          "Down",
          REGION_ID
        );
      } catch (e) {
        console.error("DB/Notify error (on failure path):", e);
      }

      resolve();
    });

    req.end();
  });
}

main().catch((e) => {
  console.error("Worker crashed:", e);
  process.exit(1);
});