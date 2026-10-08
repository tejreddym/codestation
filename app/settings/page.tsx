import FeaturePage from "@/components/FeaturePage";
import WorkbenchSettings from "@/components/WorkbenchSettings";
import { metadataForPage } from "@/config/site";
export const metadata=metadataForPage("/settings","A workspace that fits.","Control clipboard suggestions, saved shortcuts and offline access.");
export default function Page(){return <FeaturePage title="A workspace that fits." intro="Control clipboard suggestions, saved shortcuts and offline access."><WorkbenchSettings/></FeaturePage>;}
