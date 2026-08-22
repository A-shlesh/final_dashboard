import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateKengeriDataset,
  type SensorReading,
} from "@/lib/kengeri-simulation";
import {
  computeOverallWqi,
  triangulatePollutionSource,
  computeSpatialCoverage,
  detectAnomalies,
} from "@/lib/water-analytics";

export type PlaybackSpeed = 3000 | 1000 | 500 | 200 | 0;

export function useKengeriSimulation() {
  const allDataset = useMemo(() => generateKengeriDataset(), []);
  const [pointer, setPointer] = useState(30); // Initial 30 readings
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1000); // Default 1s per step

  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Active slice of readings
  const activeReadings = useMemo(() => {
    return allDataset.slice(0, pointer);
  }, [allDataset, pointer]);

  const currentReading = useMemo(() => {
    return activeReadings[activeReadings.length - 1] ?? allDataset[0]!;
  }, [activeReadings, allDataset]);

  const prevReading = useMemo(() => {
    return activeReadings.length > 1 ? activeReadings[activeReadings.length - 2] : undefined;
  }, [activeReadings]);

  // Analytical precomputations
  const overallWqi = useMemo(() => computeOverallWqi(activeReadings), [activeReadings]);
  const centroid = useMemo(() => triangulatePollutionSource(activeReadings), [activeReadings]);
  const coverage = useMemo(() => computeSpatialCoverage(activeReadings), [activeReadings]);
  const anomalies = useMemo(() => detectAnomalies(activeReadings), [activeReadings]);

  const hotspotsFound = useMemo(() => {
    return activeReadings.filter((r) => r.hotspot).length;
  }, [activeReadings]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || speed === 0) return;

    const interval = setInterval(() => {
      setPointer((prev) => {
        if (prev >= allDataset.length) {
          setIsPlaying(false);
          return prev;
        }
        return Math.min(allDataset.length, prev + 2); // Stream 2 readings per tick
      });
    }, speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, allDataset.length]);

  const togglePlay = () => setIsPlaying((prev) => !prev);
  const stepForward = () => setPointer((prev) => Math.min(allDataset.length, prev + 5));
  const stepBack = () => setPointer((prev) => Math.max(5, prev - 5));
  const reset = () => {
    setPointer(15);
    setIsPlaying(true);
  };
  const jumpTo = (index: number) => setPointer(Math.max(1, Math.min(allDataset.length, index)));

  return {
    allDataset,
    activeReadings,
    currentReading,
    prevReading,
    pointer,
    totalCount: allDataset.length,
    isPlaying,
    speed,
    setSpeed,
    togglePlay,
    stepForward,
    stepBack,
    reset,
    jumpTo,
    overallWqi,
    centroid,
    coverage,
    anomalies,
    hotspotsFound,
  };
}
