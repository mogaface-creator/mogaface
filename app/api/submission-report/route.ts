import {downloadSubmissionReport} from "@/lib/submissions/reportDownload";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request){return downloadSubmissionReport(request); }
