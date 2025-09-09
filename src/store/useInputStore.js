import { create } from "zustand";

export const useInputStore = create((set) => ({
  keys: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    reset: false,
  },
  axis: { steer: 0, throttle: 0 },

  setKey: (name, value) =>
    set((s) => ({ keys: { ...s.keys, [name]: value } })),

  setAxis: (axis) =>
    set(() => ({ axis })),
}));