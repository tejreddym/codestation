import FeaturePage from '@/components/FeaturePage';
import BatchImages from '@/components/BatchImages';
import BannerAd from '@/components/BannerAd';
import { metadataForPage } from '@/config/site';

export const metadata = metadataForPage(
  '/batch-images',
  'Batch image conversion',
  'Convert PNG files to JPG or WebP locally and download a ZIP.'
);

export default function Page() {
  return (
    <FeaturePage
      title="One batch. Fewer clicks."
      intro="Convert a collection of PNG images using the existing image engine."
    >
      <BatchImages />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '36px 0 16px' }}>
        <BannerAd size="leaderboard" />
      </div>
    </FeaturePage>
  );
}
