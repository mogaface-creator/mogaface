import type {DetailedReview,ReviewImage} from "./types.ts";
import {renderReviewPortal,type PortalContext} from "./portal.ts";
export interface ExportVersion {label:string;image:ReviewImage;targets:string[];notes:string}
/** One offline, responsive report portal; no credentials or image receipts are serialized. */
export function exportReviewHtml(name:string,original:ReviewImage,review:DetailedReview|null,versions:ExportVersion[],active:number,context?:PortalContext):string{
 return renderReviewPortal(name,original,review,versions,active,context);
}
