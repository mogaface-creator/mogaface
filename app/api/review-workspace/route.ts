import {handleReviewWorkspace} from "@/lib/review-workspace/handler.ts";
export const runtime="nodejs";
export const maxDuration=180;
export async function GET(request:Request){return handleReviewWorkspace(request);}
export async function POST(request:Request){return handleReviewWorkspace(request);}
