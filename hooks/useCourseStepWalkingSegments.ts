import { useEffect, useState } from "react";
import type { MapRouteSegment } from "../components/mapTypes";
import { fetchWalkingSegmentsAroundStep } from "../data/googleDirectionsApi";

type MapPoint = { latitude: number; longitude: number };

export function useCourseStepWalkingSegments(
  points: MapPoint[] | null | undefined,
  selectedStepId: string | null,
  stepIds: string[],
): { walkSegments: MapRouteSegment[] | null; walkLoading: boolean } {
  const [walkSegments, setWalkSegments] = useState<MapRouteSegment[] | null>(
    null,
  );
  const [walkLoading, setWalkLoading] = useState(false);

  const stepIdsKey = stepIds.join("\0");

  useEffect(() => {
    if (!selectedStepId || !points || points.length < 2) {
      setWalkSegments(null);
      setWalkLoading(false);
      return;
    }

    const stepIndex = stepIds.indexOf(selectedStepId);
    if (stepIndex < 0) {
      setWalkSegments(null);
      setWalkLoading(false);
      return;
    }

    const ac = new AbortController();
    setWalkLoading(true);
    setWalkSegments(null);

    fetchWalkingSegmentsAroundStep({
      points,
      stepIndex,
      signal: ac.signal,
    })
      .then((segments) => {
        if (!ac.signal.aborted) {
          setWalkSegments(segments.length > 0 ? segments : null);
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) setWalkSegments(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setWalkLoading(false);
      });

    return () => ac.abort();
  }, [selectedStepId, points, stepIdsKey]);

  return { walkSegments, walkLoading };
}
