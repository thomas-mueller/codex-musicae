import type { SystemLanguages } from '../../ports/system-languages';

/** `navigator.languages`, in the browser and in the native web view. I18-004 */
export const webSystemLanguages: SystemLanguages = () => navigator.languages ?? [];
