// src/components/controls/KeyboardBridge.jsx
import { useEffect } from 'react';
import { useKeyboardControls } from '@react-three/drei';
import { useInputStore } from '@/store/useInputStore';

export default function KeyboardBridge() {
  const [, getKeys] = useKeyboardControls(); // getKeys()로 현재 키 상태 가져오기
  const setKeys = useInputStore((s) => s.setKeys);

  useEffect(() => {
    let raf;
    const loop = () => {
      const k = getKeys();
      setKeys({
        forward: !!(k.forward),
        backward: !!(k.back || k.backward),
        left: !!(k.left),
        right: !!(k.right),
        brake: !!(k.brake),
        reset: !!(k.reset),
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [getKeys, setKeys]);

  return null; // 화면에 그릴 건 없음 (브릿지 전용)
}