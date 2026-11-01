const AD_MARKUP = {
  overlay: () => '<div class="ad-overlay"><span>Sponsored</span><a href="#">Learn more</a></div>',
  banner: () => '<div class="ad-banner"><span>Ad</span></div>',
  breakIndicator: () => '<div class="ad-break-indicator">Ad break</div>',
  slot: () => '<div id="ad-slot-1"></div>',
  container: () => '<div class="ad-container"><span>ad</span></div>',
  unknown: () => '<div class="x7f2 promo-slot">Sponsored</div>',
};

const AD_HOSTS = {
  'prime-video': {
    iframe: 'https://securepubads.g.doubleclick.net/gampad/ads?iu=/1/pv',
    video: 'https://aiv-cdn.amazon.com/ads/preroll/ad_1.mp4',
  },
  'jio-hotstar': {
    iframe: 'https://ads.jiohotstar.com/render/1',
    video: 'https://cdn-1.hotstar.com/ads/preroll/ad_1.mp4',
  },
};

const PLAYER_HTML =
  '<video class="content-video" src="blob:content"></video>' +
  '<div class="player-controls">' +
  '<button class="play-pause" aria-label="Play">Play</button>' +
  '<div class="progress-bar" role="slider" aria-valuenow="0"></div>' +
  '<button class="volume-button" aria-label="Volume">Vol</button></div>' +
  '<div class="subtitles" aria-live="polite"></div>';

function subtitleFor(position) {
  return `Line ${Math.floor(position / 5)}`;
}

// Mocked player with a deterministic clock. Content position only advances while playing;
// the frame is "blank" when the content video is detached or hidden.
export function createMockPlayer(doc, platform) {
  const root = doc.createElement('div');
  root.className = 'player-root';
  root.innerHTML = PLAYER_HTML;
  doc.body.appendChild(root);
  const video = root.querySelector('video');
  // Integer milliseconds avoid floating point drift in position arithmetic.
  const state = {
    playing: true,
    positionMs: 0,
    get position() {
      return this.positionMs / 1000;
    },
    volume: 1,
    blankMs: 0,
    longestBlankMs: 0,
  };

  root.querySelector('.play-pause').addEventListener('click', () => {
    state.playing = !state.playing;
  });
  root.querySelector('.volume-button').addEventListener('click', () => {
    state.volume = state.volume ? 0 : 1;
  });

  const frameIsBlank = () => !video.isConnected || video.hidden;

  function advance(ms, stepMs = 100) {
    for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
      if (state.playing) state.positionMs += stepMs;
      state.blankMs = frameIsBlank() ? state.blankMs + stepMs : 0;
      state.longestBlankMs = Math.max(state.longestBlankMs, state.blankMs);
    }
    const slider = root.querySelector('.progress-bar');
    if (slider) slider.setAttribute('aria-valuenow', String(Math.floor(state.position)));
    const subtitles = root.querySelector('.subtitles');
    if (subtitles) subtitles.textContent = subtitleFor(state.position);
  }

  function injectAd(kind) {
    if (AD_MARKUP[kind]) {
      root.insertAdjacentHTML('beforeend', AD_MARKUP[kind]());
      return root.lastElementChild;
    }
    const tag = kind === 'video' ? 'video' : 'iframe';
    const el = doc.createElement(tag);
    el.setAttribute('src', AD_HOSTS[platform][kind]);
    el.setAttribute('width', '640');
    el.setAttribute('height', '360');
    root.appendChild(el);
    return el;
  }

  return {
    root,
    video,
    state,
    advance,
    injectAd,
    frameIsBlank,
    pressPlayPause: () => root.querySelector('.play-pause')?.click(),
    pressVolume: () => root.querySelector('.volume-button')?.click(),
    progressValue: () => Number(root.querySelector('.progress-bar')?.getAttribute('aria-valuenow')),
    subtitleText: () => root.querySelector('.subtitles')?.textContent ?? null,
    controlsPresent: () =>
      Boolean(root.querySelector('.play-pause, .progress-bar, .volume-button')) &&
      root.querySelectorAll('.play-pause, .progress-bar, .volume-button').length === 3,
    adKinds: [...Object.keys(AD_MARKUP), 'iframe', 'video'],
  };
}
