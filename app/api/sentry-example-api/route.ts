import { NextResponse } from "next/server";

const responseBody = {
  isValid: false,
  successMessages: [],
  errorMessages: [
    "This Sentry example API route is not available.",
    "Use the Sentry example page instead of calling this public route."
  ],
  result: null,
};

const responseOptions = {
  status: 410,
};

export async function GET() {
  return NextResponse.json(responseBody, responseOptions);
}

export async function POST() {
  return NextResponse.json(responseBody, responseOptions);
}

export async function PUT() {
  return NextResponse.json(responseBody, responseOptions);
}

export async function PATCH() {
  return NextResponse.json(responseBody, responseOptions);
}

export async function DELETE() {
  return NextResponse.json(responseBody, responseOptions);
}

export async function OPTIONS() {
  return NextResponse.json(responseBody, responseOptions);
}
