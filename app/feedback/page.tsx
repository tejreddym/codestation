import FeaturePage from "@/components/FeaturePage";
import FeedbackForm from "@/components/FeedbackForm";
import { metadataForPage } from "@/config/site";
export const metadata=metadataForPage("/feedback","Make the next version better.","A clear report helps improve the tools you use.");
export default function Page(){return <FeaturePage title="Make the next version better." intro="A clear report helps improve the tools you use."><FeedbackForm/></FeaturePage>;}
