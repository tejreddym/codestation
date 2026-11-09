import FeaturePage from '@/components/FeaturePage';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import { metadataForPage } from '@/config/site';

export const metadata = metadataForPage(
  '/workflows',
  'Universal Recipe Pipeline Studio',
  'Chain compatible Code Station tools across JSON, Text, Encoding, and Markdown with step reordering, live intermediate previews, and local recipe management.'
);

export default function Page() {
  return (
    <FeaturePage
      title="Universal Recipe Pipeline Studio"
      intro="Chain compatible Code Station tools sequentially across data, text, encoding, and markdown with drag-to-reorder steps and live intermediate previews."
    >
      <WorkflowBuilder />
    </FeaturePage>
  );
}
