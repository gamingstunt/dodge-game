import { Devvit } from '@devvit/public-api';

export const GameFrame: Devvit.BlockComponent = () => {
  return (
    <vstack grow width="100%" height="100%">
      <webview url="index.html" grow width="100%" height="100%" />
    </vstack>
  );
};
