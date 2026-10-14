type CentralEntry = { name: Uint8Array; crc: number; size: number; offset: number; time: number; date: number };
const encoder = new TextEncoder();

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


export function createStoredZip(produce:(add:(name:string,bytes:Uint8Array)=>Promise<void>)=>Promise<void>){
 const {readable,writable}=new TransformStream<Uint8Array,Uint8Array>();const writer=writable.getWriter();
 void (async()=>{
      let offset = 0;
      const central: CentralEntry[] = [];
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


  const add=async(name:string,bytes:Uint8Array)=>{const encoded=encoder.encode(name),entry=await startEntry(encoded,'2026-01-01T00:00:00Z');await push(bytes);await finishEntry(encoded,(updateCrc(0xffffffff,bytes)^0xffffffff)>>>0,bytes.byteLength,entry.localOffset,entry.time,entry.date);};
  try{await produce(add);
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
  }catch(error){try{await writer.abort(error);}catch{/* Consumer cancellation already closed the stream. */}}
 })();return readable;
}
