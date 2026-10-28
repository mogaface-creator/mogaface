import type { AnalysisRecord } from "../analysis-session/types.ts";
import type { GeneratePdfReportInput } from "./pdfReport.ts";
export function protocolInput(record:AnalysisRecord, input:{name:string;id:string;front:Uint8Array;after?:Uint8Array|null;summary?:string}):GeneratePdfReportInput{
 return {clientName:input.name,referenceId:input.id,assessment:record.assessment,analysis:record.analysis,beforeImageBytes:input.front,
 leftImageBytes:record.reportPhotos ? Buffer.from(record.reportPhotos.leftFortyFive.base64,"base64") : null,
 rightImageBytes:record.reportPhotos ? Buffer.from(record.reportPhotos.rightFortyFive.base64,"base64") : null,
 afterImageBytes:input.after,...(input.after?{previewStatus:"quality_checked" as const}:{}),reportSummary:input.summary||"",detectedAreas:[],intakeConcerns:record.assessment.clinicIntake.places};
}
