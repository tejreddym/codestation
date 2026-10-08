import FeaturePage from '@/components/FeaturePage';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import { metadataForPage } from '@/config/site';
export const metadata=metadataForPage('/workflows','Connected workflows','Chain supported data tools and share recipes without sharing input.');
export default function Page(){return <FeaturePage title="Less repetition. More flow." intro="Connect existing data tools into a repeatable recipe."><WorkflowBuilder/></FeaturePage>;}
