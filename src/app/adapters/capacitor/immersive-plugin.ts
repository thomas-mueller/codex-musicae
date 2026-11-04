import { registerPlugin } from '@capacitor/core';

/** The native `ImmersivePlugin` (android/app/src/main/java/app/web/codexmusicae/ImmersivePlugin.java, ios/App/App/ImmersivePlugin.swift). */
export interface ImmersivePluginApi {
  enter(): Promise<void>;
  exit(): Promise<void>;
  setKeepAwake(options: { on: boolean }): Promise<void>;
}

export const ImmersivePlugin = registerPlugin<ImmersivePluginApi>('Immersive');
