import { Devvit } from '@devvit/public-api';
import { GameFrame } from './src/components/GameFrame.js';

Devvit.addCustomPostType({
  name: 'GamingStunt: Impossible Dodge',
  description: 'Play the GamingStunt Impossible Dodge HTML5 arcade challenge inside a Reddit interactive post.',
  height: 'tall',
  render: () => <GameFrame />,
});

/*
// Menu (optional, backup way)
Devvit.addMenuItem({
  location: 'subreddit',
  label: '🔥 Create Impossible Dodge Post',
  onPress: async (_e, ctx) => {
    await ctx.reddit.submitCustomPost({
      subredditName: ctx.subredditName!,
      title: '🔥 IMPOSSIBLE DODGE — Neon Survival Challenge (Play Now!)',
      entry: 'default'
    });
  }
});
*/

export default Devvit;
