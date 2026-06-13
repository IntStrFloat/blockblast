import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const ROOT_BACKGROUND = '#0f1b33';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru" style={{ backgroundColor: ROOT_BACKGROUND }}>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                min-height: 100%;
                background: ${ROOT_BACKGROUND};
              }
              body {
                margin: 0;
                overflow: hidden;
              }
            `,
          }}
        />
      </head>
      <body style={{ margin: 0, backgroundColor: ROOT_BACKGROUND }}>{children}</body>
    </html>
  );
}
