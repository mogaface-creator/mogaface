import type { AnalysisRecord } from "../analysis-session/types.ts";
import type { GeneratePdfReportInput } from "./pdfReport.ts";
function previewMessage(summary:string, hasAfter:boolean):string{
 if(hasAfter)return "A quality-screened AI illustration is included. It is not a predicted treatment result.";
 const marker=/\[PREVIEW_STATUS:([^\]]+)\]/.exec(summary)?.[1];
 switch(marker){
  case "not_requested": return "You chose not to include an illustrative after photo. The report uses your original photo.";
  case "no_ai_consent": return "You selected clinic review only, so your photo was not sent to the AI image service.";
  case "geometry_unavailable": return "The after photo could not be safely prepared from this portrait. A new, clear, front-facing photo may be needed.";
  case "quality_review": return "The generated draft did not pass the image identity and quality review, so it was excluded.";
  case "review_unavailable": return "The generated draft could not be verified, so it was excluded.";
  case "provider_unavailable": return "The image service could not generate a preview this time. The written report is ready.";
  case "generation_failed": return "The after photo could not be generated reliably this time. The written report is ready.";
  default: return "No after photo was included. The report uses your original photo.";
 }
}

export function protocolInput(record:AnalysisRecord, input:{name:string;id:string;front:Uint8Array;after?:Uint8Array|null;summary?:string}):GeneratePdfReportInput{
 const summary=input.summary||"";
 return {clientName:input.name,referenceId:input.id,assessment:record.assessment,analysis:record.analysis,beforeImageBytes:input.front,
 leftImageBytes:record.reportPhotos ? Buffer.from(record.reportPhotos.leftFortyFive.base64,"base64") : null,
 rightImageBytes:record.reportPhotos ? Buffer.from(record.reportPhotos.rightFortyFive.base64,"base64") : null,
 afterImageBytes:input.after,...(input.after?{previewStatus:"quality_checked" as const}:{}),previewMessage:previewMessage(summary,!!input.after),reportSummary:summary,detectedAreas:[],intakeConcerns:record.assessment.clinicIntake.places};
}
