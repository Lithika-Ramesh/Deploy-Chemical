import { open, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSV_NAME = "multiclass_champion_probabilities.csv";

async function resolveCsvPath(): Promise<string | null> {
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const candidates = [
    path.join(cwd, "public", "data", CSV_NAME),
    path.join(cwd, CSV_NAME),
    path.join(cwd, "..", CSV_NAME),
  ];
  for (const p of candidates) {
    try {
      await stat(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  return line.trim().split(",").map((c) => c.trim());
}

function parseTailDataLine(text: string): string | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i]!;
    if (/^sample[,]/i.test(ln)) continue;
    if (ln.split(",").length >= 10) return ln;
  }
  return null;
}

export async function GET() {
  const path = await resolveCsvPath();
  if (!path) {
    return NextResponse.json(
      {
        generated_at: undefined as string | undefined,
        classes: [] as Array<{ id: number; pct: number }>,
        source: null,
        error: "multiclass_champion_probabilities.csv not found",
      },
      { status: 404 },
    );
  }

  try {
    const st = await stat(path);
    const maxTail = 256_000;
    const fh = await open(path, "r");
    try {
      const size = st.size;
      const start = Math.max(0, size - maxTail);
      const len = size - start;
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, start);
      const tail = buf.toString("utf8");
      const headBuf = Buffer.alloc(Math.min(8192, size));
      await fh.read(headBuf, 0, headBuf.length, 0);
      const headText = headBuf.toString("utf8");
      const headerLine = headText.split(/\r?\n/)[0] ?? "";
      const header = parseCsvLine(headerLine);
      const dataLine = parseTailDataLine(tail);
      if (!dataLine) {
        return NextResponse.json(
          {
            generated_at: st.mtime.toISOString().slice(0, 10),
            classes: [],
            source: path,
            error: "no_data_row",
          },
          { status: 422 },
        );
      }
      const cells = parseCsvLine(dataLine);
      const idx = (name: string) => header.indexOf(name);
      const classes: Array<{ id: number; pct: number }> = [];
      let sum = 0;
      for (let id = 1; id <= 20; id++) {
        const j = idx(`prob_fault_${id}`);
        const raw = j >= 0 ? cells[j] : undefined;
        const v = raw != null ? Number.parseFloat(raw) : NaN;
        if (!Number.isFinite(v)) continue;
        sum += v;
        classes.push({
          id,
          pct: Math.round(v * 10_000) / 100,
        });
      }
      const rest = Math.max(0, 1 - sum);
      classes.unshift({
        id: 0,
        pct: Math.round(rest * 10_000) / 100,
      });
      classes.sort((a, b) => b.pct - a.pct);

      return NextResponse.json({
        generated_at: st.mtime.toISOString().slice(0, 10),
        classes,
        source: path,
      });
    } finally {
      await fh.close();
    }
  } catch (e) {
    return NextResponse.json(
      {
        generated_at: undefined as string | undefined,
        classes: [] as Array<{ id: number; pct: number }>,
        source: path,
        error: e instanceof Error ? e.message : "read_failed",
      },
      { status: 500 },
    );
  }
}
