// Shapes modelled on public descriptions of YouTube player responses; NOT captured live traffic.
function playerResponse() {
  return {
    responseContext: { serviceTrackingParams: [{ service: 'GFEEDBACK', params: [{ key: 'e', value: '1' }] }] },
    playabilityStatus: { status: 'OK', playableInEmbed: true },
    streamingData: { expiresInSeconds: '21540', adaptiveFormats: [{ itag: 137, mimeType: 'video/mp4', url: 'https://r1---sn.googlevideo.com/videoplayback?id=abc' }] },
    videoDetails: { videoId: 'dQw4w9WgXcQ', title: 'Sample', lengthSeconds: '212', isLiveContent: false },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=x', languageCode: 'en' }] } },
    adPlacements: [{ adPlacementRenderer: { config: { adPlacementConfig: { kind: 'AD_PLACEMENT_KIND_START' } } } }],
    playerAds: [{ playerLegacyDesktopWatchAdsRenderer: { playerAdParams: { showContentThumbnail: true } } }],
    adSlots: [{ adSlotRenderer: { adSlotMetadata: { slotType: 'SLOT_TYPE_PLAYER_BYTES' } } }],
    adBreakHeartbeatParams: 'abc123',
  };
}

function nextResponse() {
  return {
    responseContext: { visitorData: 'v' },
    contents: { twoColumnWatchNextResults: { results: {} } },
    adSlots: [{ adSlotRenderer: { adSlotMetadata: { slotType: 'SLOT_TYPE_IN_FEED' } } }],
  };
}

module.exports = { playerResponse, nextResponse };
