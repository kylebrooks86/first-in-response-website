import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
const encoder = new TextEncoder();

type PhotoRow = {
  id: string;
  customerId: string;
  category: string;
  caption: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  createdAt: string;
};

type CentralEntry = { name: Uint8Array; crc: number; size: number; offset: number; time: number; date: number };

async function authorized() {
  const user = await getOwnerUser();
  return Boolean(user && user.email.toLowerCase() === OWNER_EMAIL);
}

function crcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
}

const CRC_TABLE = crcTable();
function updateCrc(crc: number, bytes: Uint8Array) {
  let next = crc;
  for (const byte of bytes) next = CRC_TABLE[(next ^ byte) & 0xff] ^ (next >>> 8);
  return next >>> 0;
}

function dosDateTime(value: string) {
  const date = new Date(value);
  const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
  return {
    time: ((date.getUTCHours() & 31) << 11) | ((date.getUTCMinutes() & 63) << 5) | ((Math.floor(date.getUTCSeconds() / 2)) & 31),
    date: (((year - 1980) & 127) << 9) | (((date.getUTCMonth() + 1) & 15) << 5) | (date.getUTCDate() & 31),
  };
}

function header(size: number, write: (view: DataView) => void) {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "photo";
}

export async function GET() {
  if (!await authorized()) return new Response("Unauthorized", { status: 401 });
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable." }, { status: 503 });

  const result = await env.DB.prepare(`SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,object_key AS objectKey,created_at AS createdAt FROM customer_photos ORDER BY created_at`).all<PhotoRow>();
  const photos = result.results ?? [];
  const expectedBytes = photos.reduce((sum, photo) => sum + Number(photo.sizeBytes || 0), 0);
  if (expectedBytes > 2_000_000_000) return Response.json({ error: "The photo library is too large for one archive. A managed export is required." }, { status: 413 });
  if (photos.length > 65_000) return Response.json({ error: "The photo library contains too many files for one archive. A managed export is required." }, { status: 413 });

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  void (async () => {
      let offset = 0;
      const central: CentralEntry[] = [];
      const missingPhotoIds: string[] = [];
      const push = async (bytes: Uint8Array) => { await writer.write(bytes); offset += bytes.byteLength; };

      const startEntry = async (name: Uint8Array, timestamp: string) => {
        const localOffset = offset;
        const { time, date } = dosDateTime(timestamp);
        await push(header(30, (view) => {
          view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0808, true);
          view.setUint16(8, 0, true); view.setUint16(10, time, true); view.setUint16(12, date, true);
          view.setUint16(26, name.byteLength, true); view.setUint16(28, 0, true);
        }));
        await push(name);
        return { localOffset, time, date };
      };

      const finishEntry = async (name: Uint8Array, crc: number, size: number, localOffset: number, time: number, date: number) => {
        await push(header(16, (view) => {
          view.setUint32(0, 0x08074b50, true); view.setUint32(4, crc, true);
          view.setUint32(8, size, true); view.setUint32(12, size, true);
        }));
        central.push({ name, crc, size, offset: localOffset, time, date });
      };

      try {
        for (const photo of photos) {
          const object = await env.BUCKET.get(photo.objectKey);
          if (!object) { missingPhotoIds.push(photo.id); continue; }
          const name = encoder.encode(`photos/${photo.customerId}/${photo.id}-${safeName(photo.filename)}`);
          const entry = await startEntry(name, photo.createdAt);
          const reader = object.body.getReader();
          let crc = 0xffffffff;
          let size = 0;
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            crc = updateCrc(crc, chunk.value); size += chunk.value.byteLength; await push(chunk.value);
          }
          await finishEntry(name, (crc ^ 0xffffffff) >>> 0, size, entry.localOffset, entry.time, entry.date);
        }

        const manifestBytes = encoder.encode(JSON.stringify({
          format: "fire-app-photo-archive",
          version: 1,
          exportedAt: new Date().toISOString(),
          photoCount: photos.length - missingPhotoIds.length,
          missingPhotoIds,
          photos,
        }, null, 2));
        const manifestName = encoder.encode("manifest.json");
        const manifestEntry = await startEntry(manifestName, new Date().toISOString());
        const manifestCrc = (updateCrc(0xffffffff, manifestBytes) ^ 0xffffffff) >>> 0;
        await push(manifestBytes);
        await finishEntry(manifestName, manifestCrc, manifestBytes.byteLength, manifestEntry.localOffset, manifestEntry.time, manifestEntry.date);

        const centralOffset = offset;
        for (const entry of central) {
          await push(header(46, (view) => {
            view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
            view.setUint16(8, 0x0808, true); view.setUint16(10, 0, true); view.setUint16(12, entry.time, true); view.setUint16(14, entry.date, true);
            view.setUint32(16, entry.crc, true); view.setUint32(20, entry.size, true); view.setUint32(24, entry.size, true);
            view.setUint16(28, entry.name.byteLength, true); view.setUint32(42, entry.offset, true);
          }));
          await push(entry.name);
        }
        const centralSize = offset - centralOffset;
        await push(header(22, (view) => {
          view.setUint32(0, 0x06054b50, true); view.setUint16(8, central.length, true); view.setUint16(10, central.length, true);
          view.setUint32(12, centralSize, true); view.setUint32(16, centralOffset, true);
        }));
        await writer.close();
      } catch (error) {
        await writer.abort(error);
      }
  })();

  const date = new Date().toISOString().slice(0, 10);
  return new Response(readable, { headers: {
    "cache-control": "no-store",
    "content-disposition": `attachment; filename=fire-app-photo-archive-${date}.zip`,
    "content-type": "application/zip",
  } });
}
