import { NextResponse } from "next/server";

export function jsonOk(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function jsonError(status: number, error: string, details?: unknown): NextResponse {
  return NextResponse.json(
    {
      error,
      ...(details !== undefined ? { details } : {})
    },
    { status }
  );
}