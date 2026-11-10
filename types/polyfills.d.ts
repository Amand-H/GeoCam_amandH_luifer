// react-native no publica tipos para este archivo interno; se declara a mano.
declare module 'react-native/Libraries/Utilities/PolyfillFunctions' {
  export function polyfillGlobal<T>(name: string, getValue: () => T): void;
}
