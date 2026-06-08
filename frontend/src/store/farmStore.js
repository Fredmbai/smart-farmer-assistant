import { create } from 'zustand';

const useFarmStore = create((set) => ({
  activeFarm:  null,
  activePlot:  null,
  activeCycle: null,

  setActiveFarm:  (farm)  => set({ activeFarm: farm }),
  setActivePlot:  (plot)  => set({ activePlot: plot }),
  setActiveCycle: (cycle) => set({ activeCycle: cycle }),
}));

export default useFarmStore;
