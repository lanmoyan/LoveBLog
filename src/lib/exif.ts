import { open } from 'node:fs/promises';
import path from 'node:path';
import { uploadNameFromPublicPath } from '@/lib/uploads';

const EXIF_SCAN_BYTES = 2 * 1024 * 1024;

function trimNumber(n: number, digits = 2) {
  if (!Number.isFinite(n)) return '';
  return Number(n.toFixed(digits)).toString();
}

function formatExifDateTime(raw: unknown) {
  const match = String(raw || '').match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return {};
  const [, y, mo, d, h, mi, s] = match;
  return {
    date: `${y}-${mo}-${d}`,
    time: `${h}:${mi}:${s}`,
    taken_at: `${y}-${mo}-${d} ${h}:${mi}:${s}`
  };
}

function formatExposure(v: number | null) {
  if (!Number.isFinite(v) || !v || v <= 0) return '';
  if (v < 1) return `1/${Math.round(1 / v)}s`;
  return `${trimNumber(v, 1)}s`;
}

function firstNumber(value: unknown) {
  const next = Array.isArray(value) ? value[0] : value;
  return typeof next === 'number' && Number.isFinite(next) ? next : null;
}

function labelFromMap(value: unknown, map: Record<number, string>) {
  const next = firstNumber(value);
  if (next === null) return '';
  return map[next] || String(next);
}

function formatMaxAperture(value: unknown) {
  const next = firstNumber(value);
  if (next === null) return '';
  return `f/${trimNumber(Math.sqrt(2 ** next), 1)}`;
}

function formatResolution(value: unknown) {
  const next = firstNumber(value);
  return next === null ? '' : trimNumber(next, 1);
}

function formatGpsPart(value: unknown, ref: unknown) {
  if (!Array.isArray(value) || value.length < 3) return '';
  const [deg, min, sec] = value.map((item) => typeof item === 'number' ? item : 0);
  const suffix = String(ref || '').trim();
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec) || !suffix) return '';
  return `${Math.trunc(deg)}°${String(Math.trunc(min)).padStart(2, '0')}'${trimNumber(sec, 2)}"${suffix}`;
}

function formatGpsDecimal(latValue: unknown, latRef: unknown, lonValue: unknown, lonRef: unknown) {
  function decimal(value: unknown, ref: unknown) {
    if (!Array.isArray(value) || value.length < 3) return null;
    const [deg, min, sec] = value.map((item) => typeof item === 'number' ? item : 0);
    if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
    const sign = ['S', 'W'].includes(String(ref || '').trim().toUpperCase()) ? -1 : 1;
    return sign * (Math.abs(deg) + min / 60 + sec / 3600);
  }
  const lat = decimal(latValue, latRef);
  const lon = decimal(lonValue, lonRef);
  return lat === null || lon === null ? '' : `${trimNumber(lat, 6)}, ${trimNumber(lon, 6)}`;
}

export function parseExifBuffer(buf: Buffer) {
  if (!Buffer.isBuffer(buf) || buf.length < 12 || buf[0] !== 0xff || buf[1] !== 0xd8) return {};

  let pos = 2;
  while (pos + 4 < buf.length) {
    if (buf[pos] !== 0xff) {
      pos += 1;
      continue;
    }
    const marker = buf[pos + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = buf.readUInt16BE(pos + 2);
    const start = pos + 4;
    const end = pos + 2 + len;
    if (len < 2 || end > buf.length) break;

    if (marker === 0xe1 && buf.slice(start, start + 6).toString('ascii') === 'Exif\0\0') {
      return parseTiff(buf, start + 6, end);
    }
    pos = end;
  }
  return {};
}

function parseTiff(buf: Buffer, tiffStart: number, limit: number) {
  const endian = buf.slice(tiffStart, tiffStart + 2).toString('ascii');
  const little = endian === 'II';
  if (!little && endian !== 'MM') return {};

  const read16 = (p: number) => (little ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const read32 = (p: number) => (little ? buf.readUInt32LE(p) : buf.readUInt32BE(p));
  const readS32 = (p: number) => (little ? buf.readInt32LE(p) : buf.readInt32BE(p));
  const typeSize: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

  if (read16(tiffStart + 2) !== 42) return {};

  function inBounds(p: number, len = 1) {
    return p >= tiffStart && p + len <= limit && p + len <= buf.length;
  }

  function rationalAt(p: number, signed = false) {
    if (!inBounds(p, 8)) return null;
    const num = signed ? readS32(p) : read32(p);
    const den = signed ? readS32(p + 4) : read32(p + 4);
    return den ? num / den : null;
  }

  function valueAt(entry: number): unknown {
    const type = read16(entry + 2);
    const count = read32(entry + 4);
    const bytes = (typeSize[type] || 0) * count;
    if (!bytes || count > 2048) return null;
    const valuePos = bytes <= 4 ? entry + 8 : tiffStart + read32(entry + 8);
    if (!inBounds(valuePos, bytes)) return null;

    if (type === 2) return buf.slice(valuePos, valuePos + count).toString('utf8').replace(/\0+$/, '').trim();
    if (type === 3) return count === 1 ? read16(valuePos) : Array.from({ length: count }, (_, i) => read16(valuePos + i * 2));
    if (type === 4) return count === 1 ? read32(valuePos) : Array.from({ length: count }, (_, i) => read32(valuePos + i * 4));
    if (type === 5) return count === 1 ? rationalAt(valuePos) : Array.from({ length: count }, (_, i) => rationalAt(valuePos + i * 8));
    if (type === 9) return count === 1 ? readS32(valuePos) : Array.from({ length: count }, (_, i) => readS32(valuePos + i * 4));
    if (type === 10) return count === 1 ? rationalAt(valuePos, true) : Array.from({ length: count }, (_, i) => rationalAt(valuePos + i * 8, true));
    return null;
  }

  function parseIfd(offset: number) {
    const ifd = tiffStart + offset;
    if (!inBounds(ifd, 2)) return {};
    const count = read16(ifd);
    if (count > 512 || !inBounds(ifd + 2, count * 12)) return {};
    const out: Record<number, unknown> = {};
    for (let i = 0; i < count; i += 1) {
      const entry = ifd + 2 + i * 12;
      out[read16(entry)] = valueAt(entry);
    }
    return out;
  }

  const ifd0 = parseIfd(read32(tiffStart + 4));
  const exifOffset = ifd0[0x8769];
  const exifIfd = Number.isInteger(exifOffset) ? parseIfd(exifOffset as number) : {};
  const gpsOffset = ifd0[0x8825];
  const gpsIfd = Number.isInteger(gpsOffset) ? parseIfd(gpsOffset as number) : {};
  const dateParts = formatExifDateTime(exifIfd[0x9003] || ifd0[0x0132]);
  const iso = Array.isArray(exifIfd[0x8827]) ? exifIfd[0x8827][0] : exifIfd[0x8827];
  const latitude = formatGpsPart(gpsIfd[0x0002], gpsIfd[0x0001]);
  const longitude = formatGpsPart(gpsIfd[0x0004], gpsIfd[0x0003]);
  const gps = latitude && longitude ? `${latitude} ${longitude}` : '';

  const meta = {
    make: String(ifd0[0x010f] || '').trim(),
    model: String(ifd0[0x0110] || '').trim(),
    ...dateParts,
    aperture: Number.isFinite(exifIfd[0x829d]) ? `f/${trimNumber(exifIfd[0x829d] as number, 1)}` : '',
    iso: Number.isFinite(iso) ? `ISO${iso}` : '',
    exposure: formatExposure(exifIfd[0x829a] as number | null),
    focal_length: Number.isFinite(exifIfd[0x920a]) ? `${trimNumber(exifIfd[0x920a] as number, 1)}mm` : '',
    focal_length_35mm: Number.isFinite(exifIfd[0xa405]) ? `${trimNumber(exifIfd[0xa405] as number, 1)}mm` : '',
    max_aperture: formatMaxAperture(exifIfd[0x9205]),
    color_space: labelFromMap(exifIfd[0xa001], { 1: 'sRGB', 65535: '未校准' }),
    exposure_program: labelFromMap(exifIfd[0x8822], {
      0: '未定义',
      1: '手动',
      2: '程序自动曝光',
      3: '光圈优先',
      4: '快门优先',
      5: '创意程序',
      6: '动作程序',
      7: '人像',
      8: '风景'
    }),
    exposure_mode: labelFromMap(exifIfd[0xa402], { 0: '自动', 1: '手动', 2: '自动包围' }),
    metering_mode: labelFromMap(exifIfd[0x9207], {
      0: '未知',
      1: '平均测光',
      2: '中央重点平均测光',
      3: '点测光',
      4: '多点测光',
      5: '多区测光',
      6: '局部测光',
      255: '其他'
    }),
    white_balance: labelFromMap(exifIfd[0xa403], { 0: '自动', 1: '手动' }),
    flash: (() => {
      const value = firstNumber(exifIfd[0x9209]);
      if (value === null) return '';
      return value & 1 ? '已闪光' : '关闭，未闪光';
    })(),
    brightness: Number.isFinite(exifIfd[0x9203]) ? `${trimNumber(exifIfd[0x9203] as number, 2)} EV` : '',
    orientation: labelFromMap(ifd0[0x0112], {
      1: '正常',
      2: '水平翻转',
      3: '旋转 180°',
      4: '垂直翻转',
      5: '逆时针 90°并翻转',
      6: '顺时针 90°',
      7: '顺时针 90°并翻转',
      8: '逆时针 90°'
    }),
    software: String(ifd0[0x0131] || '').trim(),
    x_resolution: formatResolution(ifd0[0x011a]),
    y_resolution: formatResolution(ifd0[0x011b]),
    resolution_unit: labelFromMap(ifd0[0x0128], { 2: '英寸', 3: '厘米' }),
    pixel_width: Number.isFinite(exifIfd[0xa002]) ? String(exifIfd[0xa002]) : '',
    pixel_height: Number.isFinite(exifIfd[0xa003]) ? String(exifIfd[0xa003]) : '',
    digital_zoom_ratio: Number.isFinite(exifIfd[0xa404]) ? trimNumber(exifIfd[0xa404] as number, 2) : '',
    sensing_method: labelFromMap(exifIfd[0xa217], {
      1: '未定义',
      2: '单芯片彩色区域传感器',
      3: '双芯片彩色区域传感器',
      4: '三芯片彩色区域传感器',
      5: '连续彩色区域传感器',
      7: '三线性传感器',
      8: '连续彩色线性传感器'
    }),
    latitude,
    longitude,
    gps,
    gps_decimal: formatGpsDecimal(gpsIfd[0x0002], gpsIfd[0x0001], gpsIfd[0x0004], gpsIfd[0x0003])
  };

  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value));
}

export async function readLocalImageMeta(publicPath: string | null | undefined) {
  const name = uploadNameFromPublicPath(publicPath);
  if (!name) return {};
  const ext = path.extname(name).toLowerCase();
  if (!['.jpg', '.jpeg'].includes(ext)) return {};
  const { findUploadFile } = await import('@/lib/upload-storage');
  const file = await findUploadFile(publicPath);
  if (!file) return {};
  const handle = await open(file, 'r');
  try {
    const info = await handle.stat();
    const length = Math.min(info.size, EXIF_SCAN_BYTES);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return parseExifBuffer(buffer.subarray(0, bytesRead));
  } catch {
    return {};
  } finally {
    await handle.close().catch(() => {});
  }
}
