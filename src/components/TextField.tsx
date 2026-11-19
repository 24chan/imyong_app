import { ComponentRef, forwardRef } from 'react';
import { TextInput as RNTextInput, TextInputProps } from 'react-native';

type InputRef = ComponentRef<typeof RNTextInput>;

/** 글 입력칸: 앱 글꼴(Pretendard)을 기본으로 */
export const TextInput = forwardRef<InputRef, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} {...rest} style={[{ fontFamily: 'Pretendard-Regular' }, style]} />;
});
