import Link from "next/link";
import FeaturePage from "@/components/FeaturePage";
import PersonalTools from "@/components/PersonalTools";
import { metadataForPage } from "@/config/site";
export const metadata=metadataForPage("/workbench","Your tools. Within reach.","Keep your regular tools close and connect the steps you repeat.");
export default function Page(){return <FeaturePage title="Your tools. Within reach." intro="Keep your regular tools close and connect the steps you repeat."><PersonalTools always/><div className="feature-links"><Link href="/workflows"><strong>Connected workflows</strong><span>Run a repeatable sequence of data conversions.</span><b aria-hidden="true">↗</b></Link><Link href="/batch-images"><strong>Batch images</strong><span>Convert a queue of PNG files and download a ZIP.</span><b aria-hidden="true">↗</b></Link><Link href="/settings"><strong>Make it yours</strong><span>Detection, recent tools and offline access.</span><b aria-hidden="true">↗</b></Link><Link href="/feedback"><strong>Help shape Code Station</strong><span>Report an issue or suggest a feature.</span><b aria-hidden="true">↗</b></Link></div></FeaturePage>;}
