import {Suspense} from "react";
import {ReviewWorkspace} from "@/components/review-workspace/ReviewWorkspace";
export const metadata={title:"Your appearance review — Moga",robots:{index:false,follow:false}};
export default function ReviewPage(){return <Suspense fallback={<main className="mx-auto max-w-6xl p-8">Opening your private review…</main>}><ReviewWorkspace/></Suspense>;}
