import { Devvit } from '@devvit/public-api';

type NeonSplashProps = {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
};

export const NeonSplash: Devvit.BlockComponent<NeonSplashProps> = ({
  title = 'IMPOSSIBLE DODGE',
  subtitle = 'A fast neon survival game by GamingStunt',
  ctaLabel = 'Ready For Interactive Post',
}) => {
  return (
    <vstack
      alignment="center middle"
      padding="large"
      gap="large"
      backgroundColor="#0a0f1f"
      cornerRadius="medium"
    >
      <text size="xxlarge" weight="bold" color="#3affff">
        {title}
      </text>

      <text size="medium" color="#9ad9ff">
        {subtitle}
      </text>

      <button appearance="primary" size="large" textColor="#000000">
        {ctaLabel}
      </button>

      <text size="small" color="#6eaaff">
        Made by GamingStunt
      </text>
    </vstack>
  );
};
