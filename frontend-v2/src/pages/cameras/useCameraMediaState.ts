/* eslint-disable react-hooks/set-state-in-effect -- media preview state intentionally reconciles URLs and timers based on source changes. */
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { fetchCameraMediaFile, type CameraMedia } from '@/shared/api/configCenter';

type UseCameraMediaStateParams = {
  cameraId: string | null;
  mediaItems: CameraMedia[];
  activeRecordingMedia: CameraMedia | null;
  onPreviewError: (error: unknown) => void;
};

function revokeObjectUrl(url?: string | null) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function revokeObjectUrlMap(urlMap: Record<string, string>) {
  for (const objectUrl of Object.values(urlMap)) {
    URL.revokeObjectURL(objectUrl);
  }
}

function getThumbnailTargets(mediaItems: CameraMedia[], thumbnailUrls: Record<string, string>) {
  return mediaItems
    .filter((item) => item.status !== 'recording')
    .slice(0, 12)
    .filter((item) => !thumbnailUrls[item.id]);
}

function getRecordingCountdownValue(
  activeRecordingMedia: CameraMedia | null,
  recordingNowTs: number | null,
) {
  if (!activeRecordingMedia?.started_at || !activeRecordingMedia.duration_seconds || recordingNowTs === null) {
    return null;
  }

  const startedAtMs = new Date(activeRecordingMedia.started_at).getTime();
  if (Number.isNaN(startedAtMs)) {
    return null;
  }

  const elapsedSeconds = Math.floor((recordingNowTs - startedAtMs) / 1000);
  return Math.max(activeRecordingMedia.duration_seconds - elapsedSeconds, 0);
}

function clearThumbnailUrlState(
  setThumbnailUrls: Dispatch<SetStateAction<Record<string, string>>>,
) {
  setThumbnailUrls((previous) => {
    revokeObjectUrlMap(previous);
    return {};
  });
}

function replacePreviewUrl(
  setPreviewUrl: Dispatch<SetStateAction<string | null>>,
  nextUrl: string | null,
) {
  setPreviewUrl((previous) => {
    revokeObjectUrl(previous);
    return nextUrl;
  });
}

export function useCameraMediaState({
  cameraId,
  mediaItems,
  activeRecordingMedia,
  onPreviewError,
}: UseCameraMediaStateParams) {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<CameraMedia | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingNowTs, setRecordingNowTs] = useState<number | null>(null);

  useEffect(() => {
    if (!activeRecordingMedia) {
      setRecordingNowTs(null);
      return;
    }
    setRecordingNowTs(Date.now());
    const timer = window.setInterval(() => {
      setRecordingNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeRecordingMedia]);

  useEffect(() => {
    return () => {
      revokeObjectUrlMap(thumbnailUrls);
      revokeObjectUrl(previewUrl);
    };
  }, [previewUrl, thumbnailUrls]);

  useEffect(() => {
    clearThumbnailUrlState(setThumbnailUrls);
  }, [cameraId]);

  useEffect(() => {
    if (!cameraId || !mediaItems.length) {
      return;
    }

    let cancelled = false;
    const loadThumbnails = async () => {
      const targets = getThumbnailTargets(mediaItems, thumbnailUrls);

      for (const item of targets) {
        try {
          const blob = await fetchCameraMediaFile(cameraId, item.id);
          if (cancelled) {
            return;
          }
          const objectUrl = URL.createObjectURL(blob);
          setThumbnailUrls((previous) => {
            if (previous[item.id]) {
              URL.revokeObjectURL(objectUrl);
              return previous;
            }
            return { ...previous, [item.id]: objectUrl };
          });
        } catch {
          // Ignore single thumbnail failures.
        }
      }
    };

    void loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [cameraId, mediaItems, thumbnailUrls]);

  const handlePreviewMedia = async (media: CameraMedia) => {
    if (!cameraId) {
      return;
    }
    try {
      const blob = await fetchCameraMediaFile(cameraId, media.id);
      setPreviewMedia(media);
      setPreviewOpen(true);
      replacePreviewUrl(setPreviewUrl, URL.createObjectURL(blob));
    } catch (error) {
      onPreviewError(error);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewMedia(null);
    replacePreviewUrl(setPreviewUrl, null);
  };

  const recordingCountdown = useMemo(
    () => getRecordingCountdownValue(activeRecordingMedia, recordingNowTs),
    [activeRecordingMedia, recordingNowTs],
  );

  return {
    thumbnailUrls,
    previewOpen,
    previewMedia,
    previewUrl,
    recordingCountdown,
    handlePreviewMedia,
    closePreview,
  };
}
