import { NextResponse } from "next/server";
import { getCampaignData } from "@/lib/data";

export const revalidate = 300;

export async function GET() {
  try {
    const data = await getCampaignData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch campaign data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
