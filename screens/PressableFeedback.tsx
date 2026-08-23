import React from 'react';
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
}

// Reemplazo directo de Pressable con feedback visual al tocar (opacidad),
// que hoy no tenía ninguno salvo la tab bar web. Acepta style como objeto
// o como función igual que Pressable, así que es un swap mecánico en
// cualquier uso existente.
export default function PressableFeedback({ style, ...props }: Props) {
  return (
    <Pressable
      {...props}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && { opacity: 0.6 },
      ]}
    />
  );
}
