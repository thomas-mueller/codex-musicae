import { DOCUMENT } from '@angular/common';
import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { TUNABLES } from '../../../config/tunables';

export function provideAppIdentity(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const document = inject(DOCUMENT);
    const appName = TUNABLES.identity.appName;
    document.title = appName;

    for (const metaName of ['application-name', 'apple-mobile-web-app-title']) {
      const selector = `meta[name="${metaName}"]`;
      const meta = document.head.querySelector<HTMLMetaElement>(selector) ?? document.createElement('meta');
      meta.name = metaName;
      meta.content = appName;
      if (!meta.parentElement) {
        document.head.append(meta);
      }
    }
  });
}
